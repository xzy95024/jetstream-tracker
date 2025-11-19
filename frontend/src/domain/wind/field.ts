// src/domain/wind/field.ts
import type { WindSample } from "../../api/fetchWindAtRef";

export type WindField = {
    // Given (lon, lat), return the wind vector at that point (zonal u, meridional v),
    // measured in “map movement step size”.
    getWind(lon: number, lat: number): { u: number; v: number };
};

/**
 * Build a simplified “constant wind field” from a single WindSample:
 *  - Wind speed & direction are the same across the entire map
 *    (later we can support interpolation grids)
 *  - Correctly converts meteorological wind direction (from) to vector direction (to)
 *
 * Open-Meteo wind_direction_10m definition:
 *  - 0°   = North wind (coming from north, blowing south)
 *  - 90°  = East wind (coming from east, blowing west)
 *  - 180° = South wind (coming from south, blowing north)
 *  - 270° = West wind (coming from west, blowing east)
 *
 * What we want is the “direction the wind is blowing toward”:
 *  - u > 0 means blowing east (increasing longitude)
 *  - v > 0 means blowing north (increasing latitude)
 *
 * Conversion formula (very important):
 *  u = -S * sin(theta)
 *  v = -S * cos(theta)
 */
export function createWindFieldFromSample(sample: WindSample): WindField {
    const { speed, directionDeg } = sample;

    const dirRad = (directionDeg * Math.PI) / 180;

    // Physical wind vector at the surface (in m/s)
    const u_ms = -speed * Math.sin(dirRad);
    const v_ms = -speed * Math.cos(dirRad);

    // ⭐ Apply a very small scale factor to convert m/s → “per-frame map displacement”
    // The previous version was too fast because the scale was too large,
    // and on top of that we multiplied by 0.7 earlier.
    const SCALE = 0.01; // previously ~0.15; now significantly reduced

    const u = u_ms * SCALE;
    const v = v_ms * SCALE;

    // Temporary DEBUG: print the actual vector for inspection
    console.log("[WindField] sample:", {
        speed,
        directionDeg,
        u_ms,
        v_ms,
        u_scaled: u,
        v_scaled: v,
    });

    return {
        getWind(_lon: number, _lat: number) {
            // Currently: constant wind field; could later implement grid interpolation
            return { u, v };
        },
    };
}
