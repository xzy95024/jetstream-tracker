// src/components/filter/TimeSlider.tsx

type Props = {
    selectedAgeHours: number; // 0~23
    onChangeAge: (v: number) => void;
};

export default function TimeSlider({ selectedAgeHours, onChangeAge }: Props) {
    return (
        <div
            style={{
                marginTop: 4,
                paddingTop: 6,
                borderTop: "1px solid #ccc",
                display: "flex",
                flexDirection: "column",
                gap: 4,
            }}
        >
            <b>Time</b>
            <span style={{ fontSize: 12, color: "#555" }}>
        {selectedAgeHours === 0
            ? "Latest position (0 hours ago)"
            : `Balloon positions from ${selectedAgeHours} hours ago`}
      </span>

            <input
                type="range"
                min={0}
                max={23}
                value={selectedAgeHours}
                onChange={(e) => onChangeAge(Number(e.target.value))}
            />

            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "#777",
                }}
            >
                <span>0h</span>
                <span>12h</span>
                <span>23h</span>
            </div>
        </div>
    );
}
