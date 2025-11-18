// src/api/fetchWindAtRef.ts
export type WindSample = {
    speed: number;        // m/s
    directionDeg: number; // Meteorological direction: 0 = north wind (blowing south)
};

/**
 * Fetch wind speed and direction at 50 hPa (approx. 21 km altitude).
 */
export async function fetchWindAtRef(ageHours: number): Promise<WindSample | null> {
    try {
        const now = new Date();
        const target = new Date(now.getTime() - ageHours * 3600 * 1000);

        const url = new URL("https://api.open-meteo.com/v1/forecast");
        url.searchParams.set("latitude", "30");
        url.searchParams.set("longitude", "-20");
        url.searchParams.set("hourly", "wind_speed,wind_direction");
        url.searchParams.set("pressure_levels", "50"); // *** 50 hPa ***
        url.searchParams.set("past_days", "1");
        url.searchParams.set("forecast_days", "1");
        url.searchParams.set("timezone", "UTC");

        const resp = await fetch(url.toString());
        if (!resp.ok) return null;

        const data = await resp.json();
        const times = data.hourly?.time ?? [];
        const speeds = data.hourly?.wind_speed_50hPa ?? [];
        const dirs = data.hourly?.wind_direction_50hPa ?? [];

        if (!times.length) return null;

        let bestIdx = 0;
        let bestDiff = Infinity;

        // Find the time entry closest to the target time
        for (let i = 0; i < times.length; i++) {
            const t = new Date(times[i] + "Z");
            const diff = Math.abs(t.getTime() - target.getTime());
            if (diff < bestDiff) {
                bestDiff = diff;
                bestIdx = i;
            }
        }

        return {
            speed: speeds[bestIdx],
            directionDeg: dirs[bestIdx],
        };
    } catch (e) {
        console.warn("[fetchWindAtRef] error:", e);
        return null;
    }
}
