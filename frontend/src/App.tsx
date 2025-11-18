// src/App.tsx

import { useState } from "react";

import { createDefaultFilter } from "./domain/balloons/filters";
import type { BalloonFilter } from "./domain/balloons/types";

import { FilterPanel } from "./components/filters";
import JetstreamMap from "./components/map/JetstreamMap";

export default function App() {
    // Filter conditions: altitude / latitude / longitude / onlyId
    const [filter, setFilter] = useState<BalloonFilter>(() => createDefaultFilter());

    // 0 = latest, 1..23 = hours ago
    const [selectedAgeHours, setSelectedAgeHours] = useState(0);

    // Whether to display all tracks of balloons matching the filter
    // (only when no individual balloon is selected)
    const [showTracks, setShowTracks] = useState(false);

    // Each click increments this value, used to notify the map to clear selection
    const [resetVersion, setResetVersion] = useState(0);

    // Whether to show wind-field particle animation
    const [showWindField, setShowWindField] = useState(false);

    const handleReset = () => {
        setFilter(createDefaultFilter()); // Reset altitude/lat/lon/id
        setSelectedAgeHours(0);           // Time slider back to 0h
        setShowTracks(false);             // Hide “all tracks”
        setShowWindField(false);          // Hide wind field
        setResetVersion((v) => v + 1);    // Notify JetstreamMap to clear selection + popup
    };

    return (
        <div
            style={{
                display: "flex",
                height: "100vh",
                width: "100vw",
                boxSizing: "border-box",
                padding: 12,
                gap: 12,
                background: "#f5f5f5",
            }}
        >
            {/* Left control panel */}
            <div
                style={{
                    flex: "0 0 280px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                }}
            >
                <FilterPanel
                    filter={filter}
                    onChange={setFilter}
                    selectedAgeHours={selectedAgeHours}
                    onChangeAge={setSelectedAgeHours}
                    onReset={handleReset}
                    showTracks={showTracks}
                    onChangeShowTracks={setShowTracks}
                    showWindField={showWindField}
                    onChangeShowWindField={setShowWindField}
                />



            </div>

            {/* Right map panel */}
            <div
                style={{
                    flex: 1,
                    borderRadius: 10,
                    overflow: "hidden",
                    boxShadow: "0 2px 10px rgba(0,0,0,.15)",
                    minWidth: 0,
                }}
            >
                <JetstreamMap
                    filter={filter}
                    showTracks={showTracks}
                    selectedAgeHours={selectedAgeHours}
                    resetVersion={resetVersion}
                    showWindField={showWindField}
                />
            </div>
        </div>
    );
}
