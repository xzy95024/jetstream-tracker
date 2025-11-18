// src/components/filter/AltitudeSelector.tsx

import type { AltitudeRange, BalloonFilter } from "../../domain/balloons/types";

type Props = {
    filter: BalloonFilter;
    onChange: (f: BalloonFilter) => void;
};

function altEqual(a: AltitudeRange, b: AltitudeRange) {
    if (a === "ALL" && b === "ALL") return true;
    if (a === "ALL" || b === "ALL") return false;
    return a.min === b.min && a.max === b.max;
}

export default function AltitudeSelector({ filter, onChange }: Props) {
    const altitudeBuckets: { label: string; v: AltitudeRange }[] = [];
    altitudeBuckets.push({ label: "All", v: "ALL" });

    for (let k = 0; k < 30; k += 3) {
        altitudeBuckets.push({
            label: `${k}–${k + 3} km`,
            v: { min: k, max: k + 3 },
        });
    }

    altitudeBuckets.push({ label: "30+ km", v: { min: 30, max: "INF" } });

    return (
        <div>
            <b>Altitude</b>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {altitudeBuckets.map((b, i) => (
                    <button
                        key={i}
                        onClick={() => onChange({ ...filter, alt: b.v })}
                        style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: altEqual(filter.alt, b.v) ? "2px solid #1565c0" : "1px solid #ccc",
                            background: altEqual(filter.alt, b.v) ? "#e3f2fd" : "#fff",
                            cursor: "pointer",
                        }}
                    >
                        {b.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
