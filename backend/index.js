import express from "express";
import cors from "cors";
import { fetch } from "undici";
import { setTimeout as sleep } from "timers/promises";

const app = express();
app.use(cors());

const ORIGIN = "https://a.windbornesystems.com/treasure";

/** 调试：只测一小时是否可达，以及返回体前几百字符 */
app.get("/api/ping", async (_req, res) => {
    const url = `${ORIGIN}/00.json`;
    try {
        const r = await fetch(url, { headers: { accept: "application/json,*/*" } });
        const head = await r.text();
        res.json({
            url,
            status: r.status,
            ok: r.ok,
            sample: head.slice(0, 300)
        });
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

/** 调试：透传某小时原始 JSON，便于观察真实结构 */
app.get("/api/raw", async (req, res) => {
    const h = String(req.query.h || "00").padStart(2, "0");
    const url = `${ORIGIN}/${h}.json`;
    try {
        const r = await fetch(url, { headers: { accept: "application/json,*/*" } });
        const txt = await r.text();
        // 可能不是严格 JSON，尽量别直接 JSON.parse，这里原样透传
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.send(txt);
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

/** 工具：深度遍历对象的所有子节点 */
function* walkAll(obj) {
    const stack = [obj];
    const seen = new Set();
    while (stack.length) {
        const cur = stack.pop();
        if (!cur || typeof cur !== "object") continue;
        if (seen.has(cur)) continue;
        seen.add(cur);
        yield cur;
        if (Array.isArray(cur)) {
            for (const v of cur) stack.push(v);
        } else {
            for (const k of Object.keys(cur)) stack.push(cur[k]);
        }
    }
}

/** 工具：尝试从任意节点提取 {id, lat, lon, ts, alt} */
function tryExtract(node) {
    if (!node || typeof node !== "object") return null;

    // 多种可能的 id
    const id = node.id || node.balloon_id || node.name || node.serial || node.uuid || node._id;

    // 直接字段
    let lat = node.lat ?? node.latitude;
    let lon = node.lon ?? node.lng ?? node.longitude;
    let ts  = node.ts ?? node.timestamp ?? node.time ?? node.t ?? null;
    let alt = node.alt ?? node.altitude ?? null;

    // 嵌套字段：position / coords / geojson
    if ((!Number.isFinite(lat) || !Number.isFinite(lon))) {
        if (node.position && typeof node.position === "object") {
            lat = node.position.lat ?? node.position.latitude ?? lat;
            lon = node.position.lon ?? node.position.lng ?? node.position.longitude ?? lon;
            alt = node.position.alt ?? node.position.altitude ?? alt;
            ts  = node.position.ts  ?? node.position.time ?? ts;
        }
    }
    if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && Array.isArray(node.coords) && node.coords.length >= 2) {
        // 假设 coords: [lon, lat] 或 [lat, lon]，优先按 [lon,lat]
        const [a,b] = node.coords;
        if (Number.isFinite(a) && Number.isFinite(b)) {
            // 选择经度在 [-180,180] 且纬度在 [-90,90] 的组合
            const asLonLat = Math.abs(a) <= 180 && Math.abs(b) <= 90;
            lon = asLonLat ? a : b;
            lat = asLonLat ? b : a;
        }
    }
    if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && node.geometry && Array.isArray(node.geometry.coordinates)) {
        const c = node.geometry.coordinates;
        if (c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
            lon = c[0]; lat = c[1];
        }
    }

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
        // ts 兜底：没有时间就用 0（稍后再按加入顺序补时间）
        return { id: id ?? "unknown", lat: +lat, lon: +lon, ts: ts ? +ts : null, alt: alt ? +alt : null };
    }
    return null;
}

/** 主路由：聚合近 24 小时 → GeoJSON(线) + 最新点(点) */
app.get("/api/windborne", async (_req, res) => {
    try {
        const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));

        const pages = await Promise.all(hours.map(async (hh, idx) => {
            await sleep(idx * 20);
            const url = `${ORIGIN}/${hh}.json`;
            try {
                const r = await fetch(url, { headers: { accept: "application/json,*/*" } });
                if (!r.ok) throw new Error(`${url} -> ${r.status}`);
                // 不直接 JSON.parse，部分小时可能“看起来像 JSON 但有小瑕疵”
                const text = await r.text();
                try {
                    return JSON.parse(text);
                } catch {
                    // 尝试粗修（去除 BOM/末尾逗号等），实在不行就跳过
                    const fixed = text.replace(/^\uFEFF/, "").replace(/,\s*([}\]])/g, "$1");
                    try { return JSON.parse(fixed); } catch { return null; }
                }
            } catch {
                return null;
            }
        }));

        // 深度遍历所有页面，尽可能多地抓点
        const rawPoints = [];
        for (const page of pages) {
            if (!page) continue;
            for (const node of walkAll(page)) {
                const p = tryExtract(node);
                if (p) rawPoints.push(p);
            }
        }

        // 按 id 分组；没有 ts 的按加入顺序赋一个自增时间
        const byId = new Map();
        let seqTs = Date.now() - 24 * 3600 * 1000; // 给没 ts 的点一个相对时间
        for (const p of rawPoints) {
            if (p.ts == null || !Number.isFinite(p.ts)) {
                p.ts = seqTs; seqTs += 1000;
            }
            if (!byId.has(p.id)) byId.set(p.id, []);
            byId.get(p.id).push(p);
        }

        const lines = [];
        const latest = [];
        for (const [id, pts] of byId.entries()) {
            if (pts.length < 2) continue; // 至少两个点才画线
            pts.sort((a,b) => a.ts - b.ts);

            // 去除明显异常点（经纬超界）
            const coords = pts
                .filter(p => Math.abs(p.lon) <= 180 && Math.abs(p.lat) <= 90)
                .map(p => [p.lon, p.lat]);

            if (coords.length >= 2) {
                lines.push({
                    type: "Feature",
                    properties: { id, points: coords.length, latest: pts.at(-1).ts },
                    geometry: { type: "LineString", coordinates: coords }
                });
                const last = pts.at(-1);
                latest.push({
                    type: "Feature",
                    properties: { id, ts: last.ts, alt: last.alt ?? null },
                    geometry: { type: "Point", coordinates: [last.lon, last.lat] }
                });
            }
        }

        res.json({
            type: "FeatureCollection",
            features: lines,
            latest: { type: "FeatureCollection", features: latest }
        });
    } catch (e) {
        res.status(500).json({ error: e.message || String(e) });
    }
});

/** 代理 Open-Meteo：取风速/风向 */
app.get("/api/wind", async (req, res) => {
    try {
        const { lat, lon } = req.query;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m`;
        const r = await fetch(url);
        const j = await r.json();
        res.json(j);
    } catch (e) {
        res.status(500).json({ error: e.message || String(e) });
    }
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log("Backend listening on :" + PORT));
