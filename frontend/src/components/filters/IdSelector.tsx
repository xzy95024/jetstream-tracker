// src/components/filter/IdSelector.tsx

import { useState, useEffect } from "react";
import type { BalloonFilter } from "../../domain/balloons/types";

type Props = {
    filter: BalloonFilter;
    onChange: (f: BalloonFilter) => void;
};

export default function IdSelector({ filter, onChange }: Props) {
    const [idText, setIdText] = useState(
        filter.onlyId ? filter.onlyId.replace(/^B/, "") : ""
    );

    useEffect(() => {
        setIdText(filter.onlyId ? filter.onlyId.replace(/^B/, "") : "");
    }, [filter.onlyId]);

    return (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #ccc" }}>
            <b>Search By Balloon ID</b>

            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                <input
                    style={{ width: "100%" }}
                    placeholder="index，ex 123（empty = all）"
                    value={idText}
                    onChange={(e) => setIdText(e.target.value)}
                    onBlur={() => {
                        const trimmed = idText.trim();
                        if (trimmed === "") {
                            onChange({ ...filter, onlyId: undefined });
                            return;
                        }
                        const num = Number(trimmed);
                        if (!Number.isInteger(num) || num < 0) {
                            // go back
                            setIdText(filter.onlyId ? filter.onlyId.replace(/^B/, "") : "");
                            return;
                        }
                        onChange({ ...filter, onlyId: `B${num}` });
                    }}
                />
                <span style={{ fontSize: 11, color: "#777" }}>
          Use the array index as the balloon ID (e.g., index = 5 → B5). Leaving it empty means showing all balloons.
        </span>
            </div>
        </div>
    );
}
