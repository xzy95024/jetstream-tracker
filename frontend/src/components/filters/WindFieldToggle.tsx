// src/components/filter/WindFieldToggle.tsx

type Props = {
    checked: boolean;
    onChange: (checked: boolean) => void;
};

export default function WindFieldToggle({ checked, onChange }: Props) {
    return (
        <div
            style={{
                padding: 8,
                background: "#fff",
                borderRadius: 8,
                boxShadow: "0 1px 4px rgba(0,0,0,.12)",
                fontSize: 13,
            }}
        >
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                />
                <span>Display wind field particle animation (Open-Meteo)</span>
            </label>
        </div>
    );
}
