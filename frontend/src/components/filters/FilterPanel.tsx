// src/components/filter/FilterPanel.tsx

import type { BalloonFilter } from "../../domain/balloons/types";

import AltitudeSelector from "./AltitudeSelector";
import LatLonRangeInput from "./LatLonRangeInput";
import IdSelector from "./IdSelector";
import TimeSlider from "./TimeSlider";
import { ResetControls } from "./ResetControls";
import ShowTracksToggle from "./ShowTracksToggle";
import WindFieldToggle from "./WindFieldToggle";

type Props = {
    filter: BalloonFilter;
    onChange: (f: BalloonFilter) => void;
    selectedAgeHours: number;
    onChangeAge: (v: number) => void;
    onReset: () => void;

    // ✅ 新增：是否显示所有轨迹 + 开关回调
    showTracks: boolean;
    onChangeShowTracks: (checked: boolean) => void;

    // ✅ 新增：是否显示风场 + 开关回调
    showWindField: boolean;
    onChangeShowWindField: (checked: boolean) => void;
};

export default function FilterPanel({
                                        filter,
                                        onChange,
                                        selectedAgeHours,
                                        onChangeAge,
                                        onReset,
                                        showTracks,
                                        onChangeShowTracks,
                                        showWindField,
                                        onChangeShowWindField,
                                    }: Props) {
    return (
        <div
            style={{
                background: "#fff",
                borderRadius: 10,
                padding: 12,
                boxShadow: "0 2px 10px rgba(0,0,0,.15)",
                width: 260,
                display: "flex",
                flexDirection: "column",
                gap: 14,
            }}
        >
            <AltitudeSelector filter={filter} onChange={onChange} />
            <LatLonRangeInput filter={filter} onChange={onChange} />
            <IdSelector filter={filter} onChange={onChange} />
            <TimeSlider
                selectedAgeHours={selectedAgeHours}
                onChangeAge={onChangeAge}
            />

            <ResetControls onReset={onReset} />

            <ShowTracksToggle
                checked={showTracks}
                onChange={onChangeShowTracks}
            />

            <WindFieldToggle
                checked={showWindField}
                onChange={onChangeShowWindField}
            />
        </div>
    );
}
