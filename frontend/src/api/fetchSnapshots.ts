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

    // packs: number[][][] — the rows for each hour
    const packs = await Promise.all(hours.map((h) => fetchHour(h)));

    // Convert rows → Snapshot (domain model)
    return packs.map((rows, idx) => toSnapshot(hours[idx], rows));
}
