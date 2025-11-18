// src/components/filter/LatLonRangeInput.tsx

import { useState, useEffect } from "react";
import type { BalloonFilter, Range1D } from "../../domain/balloons/types";

type Props = {
    filter: BalloonFilter;
    onChange: (f: BalloonFilter) => void;
};

function updateRangeInput(prev: Range1D | undefined, field: "min" | "max", raw: string) {
    const text = raw;

    if (raw.trim() === "") {
        if (!prev) return { range: undefined, text };
        const next = { ...prev };
        delete (next as any)[field];
        if (next.min == null && next.max == null) return { range: undefined, text };
        return { range: next, text };
    }

    const num = Number(raw);
    if (Number.isNaN(num)) return { range: prev, text };

    return {
        range: { ...(prev ?? {}), [field]: num },
        text,
    };
}

export default function LatLonRangeInput({ filter, onChange }: Props) {
    // local states
    const [latRange, setLatRange] = useState<Range1D | undefined>(filter.lat);
    const [lonRange, setLonRange] = useState<Range1D | undefined>(filter.lon);

    const [latMinText, setLatMinText] = useState(filter.lat?.min?.toString() ?? "");
    const [latMaxText, setLatMaxText] = useState(filter.lat?.max?.toString() ?? "");
    const [lonMinText, setLonMinText] = useState(filter.lon?.min?.toString() ?? "");
    const [lonMaxText, setLonMaxText] = useState(filter.lon?.max?.toString() ?? "");

    useEffect(() => {
        setLatRange(filter.lat);
        setLonRange(filter.lon);

        setLatMinText(filter.lat?.min?.toString() ?? "");
        setLatMaxText(filter.lat?.max?.toString() ?? "");
        setLonMinText(filter.lon?.min?.toString() ?? "");
        setLonMaxText(filter.lon?.max?.toString() ?? "");
    }, [filter.lat, filter.lon]);

    return (
        <div>
            <b>Latitude</b>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <input
                    style={{ width: 80 }}
                    placeholder="min"
                    value={latMinText}
                    onChange={(e) => {
                        const { range, text } = updateRangeInput(latRange, "min", e.target.value);
                        setLatMinText(text);
                        setLatRange(range);
                    }}
                    onBlur={() => onChange({ ...filter, lat: latRange })}
                />
                <input
                    style={{ width: 80 }}
                    placeholder="max"
                    value={latMaxText}
                    onChange={(e) => {
                        const { range, text } = updateRangeInput(latRange, "max", e.target.value);
                        setLatMaxText(text);
                        setLatRange(range);
                    }}
                    onBlur={() => onChange({ ...filter, lat: latRange })}
                />
            </div>

            <b style={{ marginTop: 10, display: "block" }}>Longitude</b>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <input
                    style={{ width: 80 }}
                    placeholder="min"
                    value={lonMinText}
                    onChange={(e) => {
                        const { range, text } = updateRangeInput(lonRange, "min", e.target.value);
                        setLonMinText(text);
                        setLonRange(range);
                    }}
                    onBlur={() => onChange({ ...filter, lon: lonRange })}
                />
                <input
                    style={{ width: 80 }}
                    placeholder="max"
                    value={lonMaxText}
                    onChange={(e) => {
                        const { range, text } = updateRangeInput(lonRange, "max", e.target.value);
                        setLonMaxText(text);
                        setLonRange(range);
                    }}
                    onBlur={() => onChange({ ...filter, lon: lonRange })}
                />
            </div>
        </div>
    );
}
