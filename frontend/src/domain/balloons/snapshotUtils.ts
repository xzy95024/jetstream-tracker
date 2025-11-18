// src/domain/balloons/snapshotUtils.ts

import type { Snapshot, BalloonSnapshotItem } from "./types";

// Enable debug logs by toggling this to true
const DEBUG = false;

/**
 * If (lat, lon) appear to be swapped, automatically correct them.
 */
function normalizeLonLat(rawLon: number, rawLat: number): { lon: number; lat: number } {
    let lon = rawLon;
    let lat = rawLat;

    // Detect potential swap: lat is outside [-90, 90] while lon is within reasonable range.
    if (Math.abs(lat) > 90 && Math.abs(lon) <= 90 && Math.abs(lat) <= 180) {
        if (DEBUG) {
            console.warn("Swapping lat/lon due to suspicious ranges:", { rawLon, rawLat });
        }
        const tmp = lon;
        lon = rawLat;
        lat = tmp;
    }

    return { lon, lat };
}

/**
 * Convert the raw rows of a given hour into a Snapshot:
 *  - Automatically fix potentially swapped lon/lat
 *  - Discard invalid entries
 *  - Assign IDs as "B0", "B1", ...
 */
export function toSnapshot(hour: string, rows: number[][]): Snapshot {
    const items: BalloonSnapshotItem[] = [];
    let dropped = 0;

    rows.forEach((row, index) => {
        if (!Array.isArray(row) || row.length < 3) {
            dropped++;
            return;
        }

        const [rawLon, rawLat, rawAltKm] = row;

        if (
            !Number.isFinite(rawLon) ||
            !Number.isFinite(rawLat) ||
            !Number.isFinite(rawAltKm)
        ) {
            dropped++;
            return;
        }

        const { lon, lat } = normalizeLonLat(rawLon, rawLat);
        const altKm = rawAltKm;

        // Validate coordinate ranges
        if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
            dropped++;
            return;
        }

        if (!Number.isFinite(altKm)) {
            dropped++;
            return;
        }

        items.push({
            id: `B${index}`,
            lon,
            lat,
            altKm,
        });
    });

    if (DEBUG) {
        console.log(
            `toSnapshot hour=${hour}: total=${rows.length}, kept=${items.length}, dropped=${dropped}`
        );
    }

    return {
        t: hour,
        items,
    };
}

/**
 * Pick the snapshot corresponding to “N hours ago”:
 *  - 0  => "00"
 *  - 1  => "01"
 *  - ...
 *  - 23 => "23"
 */
export function pickSnapshotForAge(
    snapshots: Snapshot[],
    ageHours: number
): Snapshot {
    if (!snapshots.length) {
        // Should not happen, but return an empty fallback for safety
        return { t: "00", items: [] };
    }

    const label = ageHours === 0 ? "00" : String(ageHours).padStart(2, "0");
    const found = snapshots.find((s) => s.t === label);
    return found ?? snapshots[snapshots.length - 1];
}
