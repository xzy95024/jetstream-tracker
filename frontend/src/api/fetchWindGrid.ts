// src/api/fetchWindGrid.ts

export type WindSamplePoint = {
    lat: number;
    lon: number;
    speed: number;        // m/s
    directionDeg: number; // Meteorological direction: 0 = north wind (blowing south)
};

// Current selected upper-air level: 50 hPa (~20–21 km altitude)
const PRESSURE_LEVEL = "50hPa" as const;
const SPEED_KEY = `wind_speed_${PRESSURE_LEVEL}`;
const DIR_KEY = `wind_direction_${PRESSURE_LEVEL}`;

/**
 * Fetch wind speed/direction at 50 hPa for a single point (lat/lon + ageHours).
 */
async function fetchWindAtPoint(
    ageHours: number,
    lat: number,
    lon: number
): Promise<WindSamplePoint | null> {
    try {
        const now = new Date();
        const target = new Date(now.getTime() - ageHours * 3600 * 1000);

        const url = new URL("https://api.open-meteo.com/v1/forecast");
        url.searchParams.set("latitude", lat.toString());
        url.searchParams.set("longitude", lon.toString());
        // Note: in "hourly", you must directly request the variable names with height suffixes
        url.searchParams.set(
            "hourly",
            `${SPEED_KEY},${DIR_KEY}`
        );
        // Do not add pressure_levels here to avoid unexpected validation errors
        url.searchParams.set("past_days", "1");
        url.searchParams.set("forecast_days", "1");
        url.searchParams.set("timezone", "UTC");

        const resp = await fetch(url.toString());
        if (!resp.ok) {
            console.warn("[fetchWindAtPoint] bad status:", resp.status);
            return null;
        }

        const data = await resp.json();

        const hourly: any = data.hourly ?? {};
        const times: string[] = hourly.time ?? [];
        const speedsKmh: number[] = hourly[SPEED_KEY] ?? [];
        const dirs: number[] = hourly[DIR_KEY] ?? [];

        if (!times.length || !speedsKmh.length || !dirs.length) {
            console.warn("[fetchWindAtPoint] missing hourly data", {
                haveTime: !!times.length,
                haveSpeed: !!speedsKmh.length,
                haveDir: !!dirs.length
            });
            return null;
        }

        // Find the hour closest to the target time
        let bestIdx = 0;
        let bestDiff = Number.POSITIVE_INFINITY;
        for (let i = 0; i < times.length; i++) {
            const t = new Date(times[i] + "Z"); // Open-Meteo returns UTC but without "Z"
            const diff = Math.abs(t.getTime() - target.getTime());
            if (diff < bestDiff) {
                bestDiff = diff;
                bestIdx = i;
            }
        }

        const speedKmh = speedsKmh[bestIdx];
        const directionDeg = dirs[bestIdx];

        if (!Number.isFinite(speedKmh) || !Number.isFinite(directionDeg)) {
            return null;
        }

        // Convert km/h → m/s
        const speed = speedKmh / 3.6;

        return { lat, lon, speed, directionDeg };
    } catch (e) {
        console.warn("[fetchWindAtPoint] error:", e);
        return null;
    }
}

/**
 * Sample a grid of wind vectors (50 hPa) for a given geographic bounding box.
 * The output can be used to construct an interpolated wind field.
 */
export async function fetchWindGrid(
    ageHours: number,
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number,
    rows: number = 3,
    cols: number = 5
): Promise<WindSamplePoint[]> {
    // Basic validation: if the range is invalid, fallback to a single point
    if (
        !Number.isFinite(minLat) || !Number.isFinite(maxLat) ||
        !Number.isFinite(minLon) || !Number.isFinite(maxLon) ||
        minLat === maxLat || minLon === maxLon
    ) {
        const centerLat = 30;
        const centerLon = -20;
        const one = await fetchWindAtPoint(ageHours, centerLat, centerLon);
        return one ? [one] : [];
    }

    // Clamp range to avoid huge spans when the map is zoomed too far out
    const clampedMinLat = Math.max(-60, minLat);
    const clampedMaxLat = Math.min(60, maxLat);
    const clampedMinLon = Math.max(-180, minLon);
    const clampedMaxLon = Math.min(180, maxLon);

    const latStep = rows > 1
        ? (clampedMaxLat - clampedMinLat) / (rows - 1)
        : 0;
    const lonStep = cols > 1
        ? (clampedMaxLon - clampedMinLon) / (cols - 1)
        : 0;

    const tasks: Promise<WindSamplePoint | null>[] = [];

    for (let r = 0; r < rows; r++) {
        const lat = rows === 1
            ? (clampedMinLat + clampedMaxLat) / 2
            : clampedMinLat + latStep * r;

        for (let c = 0; c < cols; c++) {
            const lon = cols === 1
                ? (clampedMinLon + clampedMaxLon) / 2
                : clampedMinLon + lonStep * c;

            tasks.push(fetchWindAtPoint(ageHours, lat, lon));
        }
    }

    const results = await Promise.all(tasks);
    return results.filter((x): x is WindSamplePoint => x !== null);
}
