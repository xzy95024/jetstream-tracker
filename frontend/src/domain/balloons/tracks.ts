// src/domain/balloons/tracks.ts

import type {
    Feature,
    FeatureCollection,
    LineString,
    Position,
} from "geojson";
import type { BalloonFilter, BalloonSnapshotItem, Snapshot } from "./types";
import { EMPTY_FC } from "./types";
import { matchAltitude, matchRange1D } from "./filters";

/**
 * Check whether a snapshot item matches the filter (altitude / latitude / longitude)
 * Note: we no longer use onlyId for filtering here; onlyId is only for "programmatic selection".
 */
function matchesFilter(filter: BalloonFilter, item: BalloonSnapshotItem): boolean {
    if (
        !Number.isFinite(item.lon) ||
        !Number.isFinite(item.lat) ||
        !Number.isFinite(item.altKm)
    ) {
        return false;
    }

    if (!matchAltitude(filter.alt, item.altKm)) return false;
    if (!matchRange1D(filter.lat, item.lat)) return false;
    if (!matchRange1D(filter.lon, item.lon)) return false;

    return true;
}

/**
 * Build:
 *  - latest: positions at the latestSnap time (only keeping balloons that match the filter)
 *  - tracks: 24-hour tracks (only keeping the full tracks of those balloons)
 *
 * snapshots order: 23, 22, ..., 01, 00 (from oldest to newest)
 */
export function buildTracksAndLatestByFilter(
    snapshots: Snapshot[],
    filter: BalloonFilter,
    latestSnap: Snapshot,
    highlightedId?: string | null
): { tracks: FeatureCollection<LineString>; latest: FeatureCollection } {
    const allowedIds = new Set<string>();
    const latestFeatures: Feature[] = [];

    // 1. First, filter balloons on latestSnap + record allowedIds
    for (const it of latestSnap.items) {
        if (!matchesFilter(filter, it)) continue;
        allowedIds.add(it.id);

        latestFeatures.push({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [it.lon, it.lat],
            },
            properties: {
                id: it.id,
                alt_km: it.altKm,
                // Only used to highlight the point (red circle)
                selected: highlightedId === it.id ? 1 : 0,
            },
        });
    }

    // 2. Build 24h tracks for allowedIds
    const byId: Record<string, Position[]> = {};

    for (const s of snapshots) {
        for (const it of s.items) {
            if (!allowedIds.has(it.id)) continue;
            if (!Number.isFinite(it.lon) || !Number.isFinite(it.lat)) continue;
            (byId[it.id] ??= []).push([it.lon, it.lat]);
        }
    }

    const trackFeatures: Feature<LineString>[] = [];
    for (const [id, coords] of Object.entries(byId)) {
        if (coords.length >= 2) {
            trackFeatures.push({
                type: "Feature",
                geometry: { type: "LineString", coordinates: coords },
                properties: { id },
            });
        }
    }

    return {
        tracks: {
            type: "FeatureCollection",
            features: trackFeatures,
        },
        latest: {
            type: "FeatureCollection",
            features: latestFeatures,
        },
    };
}

/**
 * 24-hour track for a single id
 */
export function buildTrackForId(
    snapshots: Snapshot[],
    id: string
): FeatureCollection<LineString> {
    const coords: Position[] = [];

    for (const s of snapshots) {
        const it = s.items.find((x) => x.id === id);
        if (!it) continue;
        if (!Number.isFinite(it.lon) || !Number.isFinite(it.lat)) continue;
        coords.push([it.lon, it.lat]);
    }

    if (coords.length < 2) {
        return EMPTY_FC as FeatureCollection<LineString>;
    }

    return {
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                geometry: { type: "LineString", coordinates: coords },
                properties: { id },
            },
        ],
    };
}

/**
 * 24-hour tracks for multiple ids (for multi-selection)
 */
export function buildTracksForIds(
    snapshots: Snapshot[],
    ids: Set<string>
): FeatureCollection<LineString> {
    const byId: Record<string, Position[]> = {};

    for (const s of snapshots) {
        for (const it of s.items) {
            if (!ids.has(it.id)) continue;
            if (!Number.isFinite(it.lon) || !Number.isFinite(it.lat)) continue;
            (byId[it.id] ??= []).push([it.lon, it.lat]);
        }
    }

    const features: Feature<LineString>[] = [];
    for (const [id, coords] of Object.entries(byId)) {
        if (coords.length >= 2) {
            features.push({
                type: "Feature",
                geometry: { type: "LineString", coordinates: coords },
                properties: { id },
            });
        }
    }

    return {
        type: "FeatureCollection",
        features,
    };
}
