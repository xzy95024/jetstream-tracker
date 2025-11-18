import express from "express";
import cors from "cors";
import { fetch } from "undici";
import { setTimeout as sleep } from "timers/promises";

const app = express();
app.use(cors());

const ORIGIN = "https://a.windbornesystems.com/treasure";

/**
 * Simple connectivity test: request hour-00 raw JSON
 */
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

/**
 * Fetch raw hourly data (00–23)
 * We DO NOT JSON.parse because the source sometimes contains malformed JSON.
 * We return raw text directly.
 */
app.get("/api/raw", async (req, res) => {
    const h = String(req.query.h || "00").padStart(2, "0");
    const url = `${ORIGIN}/${h}.json`;
    try {
        const r = await fetch(url, { headers: { accept: "application/json,*/*" } });
        const txt = await r.text();
        // Might not be strict JSON; return as-is.
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.send(txt);
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

/**
 * Depth-first traversal through ANY nested object structure.
 * This is used to aggressively extract coordinates from messy / unknown schemas.
 */
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

/**
 * Attempt to extract a balloon point (lon/lat/id/ts/alt) from an arbitrary object node.
 * This tries many possible field names, including nested structures.
 */
function tryExtract(node) {
    if (!node || typeof node !== "object") return null;

    // Possible ID fields
    const id =
        node.id ||
        node.balloon_id ||
        node.name ||
        node.serial ||
        node.uuid ||
        node._id;

    // Direct fields
    let lat = node.lat ?? node.latitude;
    let lon = node.lon ?? node.lng ?? node.longitude;
    let ts = node.ts ?? node.timestamp ?? node.time ?? node.t ?? null;
    let alt = node.alt ?? node.altitude ?? null;

    // Nested fields: position / coords / geojson
    if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && node.position) {
        if (typeof node.position === "object") {
            lat = node.position.lat ?? node.position.latitude ?? lat;
            lon = node.position.lon ?? node.position.lng ?? node.position.longitude ?? lon;
            alt = node.position.alt ?? node.position.altitude ?? alt;
            ts = node.position.ts ?? node.position.time ?? ts;
        }
    }

    // coords array: might be [lon, lat] or [lat, lon]
    if ((!Number.isFinite(lat) || !Number.isFinite(lon)) &&
        Array.isArray(node.coords) &&
        node.coords.length >= 2) {
        const [a, b] = node.coords;
        if (Number.isFinite(a) && Number.isFinite(b)) {
            // Choose the valid lon/lat combo
            const asLonLat = Math.abs(a) <= 180 && Math.abs(b) <= 90;
            lon = asLonLat ? a : b;
            lat = asLonLat ? b : a;
        }
    }

    // GeoJSON-style geometry.coordinates
    if ((!Number.isFinite(lat) || !Number.isFinite(lon)) &&
        node.geometry &&
        Array.isArray(node.geometry.coordinates)) {
        const c = node.geometry.coordinates;
        if (c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
            lon = c[0];
            lat = c[1];
        }
    }

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
        // Fallback: if no timestamp, assign a sequence timestamp later
        return {
            id: id ?? "unknown",
            lat: +lat,
            lon: +lon,
            ts: ts ? +ts : null,
            alt: alt ? +alt : null,
        };
    }
    return null;
}

/**
 * Main route:
 *   - Fetch raw data for the last 24 hours
 *   - Extract all possible coordinates from messy JSON
 *   - Group by ID
 *   - Construct:
 *       • A FeatureCollection of LineStrings (full 24h track per ID)
 *       • A FeatureCollection of Points (latest position per ID)
 */
app.get("/api/windborne", async (_req, res) => {
    try {
        const hours = Array.from({ length: 24 }, (_, i) =>
            i.toString().padStart(2, "0")
        );

        // Fetch 24 pages (00–23), spaced by 20ms to avoid hammering the source
        const pages = await Promise.all(
            hours.map(async (hh, idx) => {
                await sleep(idx * 20);
                const url = `${ORIGIN}/${hh}.json`;
                try {
                    const r = await fetch(url, { headers: { accept: "application/json,*/*" } });
                    if (!r.ok) throw new Error(`${url} -> ${r.status}`);
                    const text = await r.text();

                    // Try direct parse
                    try {
                        return JSON.parse(text);
                    } catch {
                        // Attempt minor cleanup (remove BOM, trailing commas)
                        const fixed = text
                            .replace(/^\uFEFF/, "")
                            .replace(/,\s*([}\]])/g, "$1");
                        try {
                            return JSON.parse(fixed);
                        } catch {
                            return null;
                        }
                    }
                } catch {
                    return null;
                }
            })
        );

        // Traverse all pages and extract all candidate points
        const rawPoints = [];
        for (const page of pages) {
            if (!page) continue;
            for (const node of walkAll(page)) {
                const p = tryExtract(node);
                if (p) rawPoints.push(p);
            }
        }

        // Group by ID, and assign fallback timestamps where missing
        const byId = new Map();
        let seqTs = Date.now() - 24 * 3600 * 1000;
        for (const p of rawPoints) {
            if (p.ts == null || !Number.isFinite(p.ts)) {
                p.ts = seqTs;
                seqTs += 1000;
            }
            if (!byId.has(p.id)) byId.set(p.id, []);
            byId.get(p.id).push(p);
        }

        const lines = [];
        const latest = [];

        for (const [id, pts] of byId.entries()) {
            if (pts.length < 2) continue; // need ≥2 points to form a line
            pts.sort((a, b) => a.ts - b.ts);

            // Filter obviously invalid coordinates
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

/**
 * Proxy for Open-Meteo:
 * Fetch current wind speed + direction at (lat, lon)
 */
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
