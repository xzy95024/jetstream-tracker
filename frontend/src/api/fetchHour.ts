// src/api/fetchHour.ts

import { API_BASE_URL } from "../config/api";

/**
 * Fetch raw balloon data for a given hour from the backend.
 * Goals:
 *  - Never throw errors
 *  - If backend returns HTML / non-JSON → ignore automatically
 *  - If parsing fails → silently return []
 *  - If resp.ok === false → silently return []
 *  - Always return number[][]
 */
export async function fetchHour(hour: string): Promise<number[][]> {
    try {
        const resp = await fetch(`${API_BASE_URL}/api/raw?h=${hour}`);

        // Request succeeded but status code is not OK (e.g., 404/500)
        if (!resp.ok) {
            // ⭐ Do not console.warn (you said logs are too noisy)
            return [];
        }

        // Read response as text; could be JSON or HTML
        const text = await resp.text();

        // Attempt to parse JSON
        try {
            const data = JSON.parse(text);

            // Must be an array; otherwise treat as invalid data
            if (Array.isArray(data)) {
                return data as number[][];
            }

            // Not an array → invalid data
            return [];
        } catch {
            // JSON.parse failed, likely HTML error page → return []
            return [];
        }
    } catch {
        // fetch() itself threw an error (e.g., network issue) → return []
        return [];
    }
}
