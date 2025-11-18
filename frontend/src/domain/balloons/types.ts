// src/domain/balloons/types.ts

import type {
    FeatureCollection,
    LineString,
    Point,
} from "geojson";

/** Each balloon snapshot entry */
export type BalloonSnapshotItem = {
    id: string;
    lon: number;
    lat: number;
    altKm: number;
};

/** A single hourly snapshot */
export type Snapshot = {
    t: string; // "23".."01","00"
    items: BalloonSnapshotItem[];
};

/** Altitude filter: ALL or a (min, max) range */
export type AltitudeRange = "ALL" | { min: number; max: number | "INF" };

/** One-dimensional numeric range (used for lat/lon) */
export type Range1D = { min?: number; max?: number };

/** Combined filter conditions (altitude + latitude + longitude + optional single id) */
export type BalloonFilter = {
    alt: AltitudeRange;
    lat?: Range1D;
    lon?: Range1D;
    onlyId?: string;
};

/** Empty FeatureCollection for initializing map sources easily */
export const EMPTY_FC: FeatureCollection = {
    type: "FeatureCollection",
    features: [],
};

/** Helper return type for tracks-related logic */
export type TracksAndLatest = {
    tracks: FeatureCollection<LineString>;
    latest: FeatureCollection<Point>;
};
