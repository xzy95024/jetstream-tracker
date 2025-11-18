// src/domain/balloons/filters.ts

import {
    type AltitudeRange,
    type Range1D,
    type BalloonFilter,
    type BalloonSnapshotItem,
} from "./types";

/** Check whether altitude falls within the given range */
export function matchAltitude(range: AltitudeRange, altKm: number): boolean {
    if (range === "ALL") return true;

    if (range.max === "INF") {
        return altKm >= range.min;
    }

    // Left-closed, right-open interval [min, max)
    return altKm >= range.min && altKm < range.max;
}

/** Check whether a value (lat/lon) falls within a 1D numeric range */
export function matchRange1D(range: Range1D | undefined, value: number): boolean {
    if (!range) return true; // Not set → no restriction

    const { min, max } = range;
    if (min !== undefined && value < min) return false;
    if (max !== undefined && value > max) return false;
    return true;
}

/** Check whether a snapshot item satisfies the filter (alt + lat + lon) */
export function matchesFilter(filter: BalloonFilter, item: BalloonSnapshotItem): boolean {
    // Exclude NaN / Infinity
    if (
        !Number.isFinite(item.lon) ||
        !Number.isFinite(item.lat) ||
        !Number.isFinite(item.altKm)
    ) {
        return false;
    }

    // Validate lat/lon to avoid feeding invalid coordinates to maplibre
    if (Math.abs(item.lat) > 90 || Math.abs(item.lon) > 180) {
        return false;
    }

    // Do NOT filter by onlyId here — only filter by alt / lat / lon
    if (!matchAltitude(filter.alt, item.altKm)) return false;
    if (!matchRange1D(filter.lat, item.lat)) return false;
    if (!matchRange1D(filter.lon, item.lon)) return false;

    return true;
}

/** Default filter (only altitude filter; no lat/lon/id filtering) */
export function createDefaultFilter(): BalloonFilter {
    return {
        alt: "ALL",
        // lat: undefined,
        // lon: undefined,
        // onlyId: undefined,
    };
}
