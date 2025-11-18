// src/domain/wind/gridField.ts
import type { WindSamplePoint } from "../../api/fetchWindGrid";

export type WindField = {
    getWind(lon: number, lat: number): { u: number; v: number };
};

type Grid = {
    lats: number[];
    lons: number[];
    u: number[][]; // [latIndex][lonIndex]
    v: number[][];
};

function meteoToVector(speed: number, directionDeg: number): { u: number; v: number } {
    const dirRad = (directionDeg * Math.PI) / 180;

    // Meteorological direction -> physical vector direction
    const u_ms = -speed * Math.sin(dirRad);
    const v_ms = -speed * Math.cos(dirRad);

    // Scale factor converting m/s to “per-frame lon/lat displacement”
    const SCALE = 0.01;
    return { u: u_ms * SCALE, v: v_ms * SCALE };
}

function buildGrid(samples: WindSamplePoint[]): Grid | null {
    if (samples.length === 0) return null;

    const uniqueLats = Array.from(new Set(samples.map((s) => s.lat))).sort(
        (a, b) => a - b
    );
    const uniqueLons = Array.from(new Set(samples.map((s) => s.lon))).sort(
        (a, b) => a - b
    );

    const latIndex = new Map<number, number>();
    const lonIndex = new Map<number, number>();
    uniqueLats.forEach((lat, idx) => latIndex.set(lat, idx));
    uniqueLons.forEach((lon, idx) => lonIndex.set(lon, idx));

    const rows = uniqueLats.length;
    const cols = uniqueLons.length;

    const u: number[][] = Array.from({ length: rows }, () =>
        Array<number>(cols).fill(0)
    );
    const v: number[][] = Array.from({ length: rows }, () =>
        Array<number>(cols).fill(0)
    );

    let filled = 0;

    for (const s of samples) {
        const i = latIndex.get(s.lat);
        const j = lonIndex.get(s.lon);
        if (i == null || j == null) continue;

        const vec = meteoToVector(s.speed, s.directionDeg);
        u[i][j] = vec.u;
        v[i][j] = vec.v;
        filled++;
    }

    // If the grid is not fully filled (some points failed), consider fallback
    if (filled < rows * cols * 0.6) {
        console.warn("[WindGrid] too many missing points, fallback later");
    }

    return { lats: uniqueLats, lons: uniqueLons, u, v };
}

function findInterval(arr: number[], x: number): [number, number] {
    // Return indices [i0, i1] such that arr[i0] <= x <= arr[i1]
    // Clamp to boundaries if out of range
    if (x <= arr[0]) return [0, 0];
    if (x >= arr[arr.length - 1]) {
        const last = arr.length - 1;
        return [last, last];
    }

    for (let i = 0; i < arr.length - 1; i++) {
        if (x >= arr[i] && x <= arr[i + 1]) {
            return [i, i + 1];
        }
    }
    const last = arr.length - 1;
    return [last - 1, last];
}

export function createWindFieldFromSamples(samples: WindSamplePoint[]): WindField | null {
    const grid = buildGrid(samples);
    if (!grid) return null;

    const { lats, lons, u, v } = grid;

    return {
        getWind(lon: number, lat: number): { u: number; v: number } {
            // If the grid only has one point, return it directly
            if (lats.length === 1 && lons.length === 1) {
                return { u: u[0][0], v: v[0][0] };
            }

            const [i0, i1] = findInterval(lats, lat);
            const [j0, j1] = findInterval(lons, lon);

            const lat0 = lats[i0];
            const lat1 = lats[i1];
            const lon0 = lons[j0];
            const lon1 = lons[j1];

            const t =
                lat1 === lat0 ? 0 : (lat - lat0) / (lat1 - lat0); // 0..1
            const s =
                lon1 === lon0 ? 0 : (lon - lon0) / (lon1 - lon0); // 0..1

            const u00 = u[i0][j0];
            const u10 = u[i1][j0];
            const u01 = u[i0][j1];
            const u11 = u[i1][j1];

            const v00 = v[i0][j0];
            const v10 = v[i1][j0];
            const v01 = v[i0][j1];
            const v11 = v[i1][j1];

            // Bilinear interpolation
            const u0 = u00 * (1 - s) + u01 * s;
            const u1 = u10 * (1 - s) + u11 * s;
            const v0 = v00 * (1 - s) + v01 * s;
            const v1 = v10 * (1 - s) + v11 * s;

            const uu = u0 * (1 - t) + u1 * t;
            const vv = v0 * (1 - t) + v1 * t;

            return { u: uu, v: vv };
        },
    };
}
