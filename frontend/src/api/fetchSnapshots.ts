// src/api/fetchSnapshots.ts

import { fetchHour } from "./fetchHour";

// Import Snapshot type from domain
import type { Snapshot } from "../domain/balloons/types";

// Import toSnapshot converter from domain snapshot utilities
import { toSnapshot } from "../domain/balloons/snapshotUtils";

/**
 * Fetch all 24 hourly Snapshots from the backend (23 → 00).
 * Even if some hours fail or contain bad data, the process will not stop.
 */
export async function fetchSnapshots(): Promise<Snapshot[]> {

    const hours = Array.from({ length: 23 }, (_, i) =>
        String(23 - i).padStart(2, "0")
    ).concat(["00"]);

    const packs = await Promise.all(hours.map((h) => fetchHour(h)));

    const rows00 = packs[packs.length - 1]; // packs for "00", maybe []
    const rows01 = packs[packs.length - 2]; // packs for "01"

    if (rows00.length === 0 && rows01.length > 0) {
        console.warn("[fetchSnapshots] Hour 00 is empty, fallback to Hour 01");


        const snap00 = toSnapshot("00", rows01);


        const rest = hours
            .slice(0, hours.length - 2) // 去掉最后两个小时（01 & 00）
            .map((h, idx) => toSnapshot(h, packs[idx]));


        return [...rest, snap00];
    }


    return packs.map((rows, idx) => toSnapshot(hours[idx], rows));
}
