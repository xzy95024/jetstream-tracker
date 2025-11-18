// src/components/filter/ShowTracksToggle.tsx

type Props = {
    checked: boolean;
    onChange: (checked: boolean) => void;
};

export default function ShowTracksToggle({ checked, onChange }: Props) {
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
                <span>Display all balloon tracks (when no single balloon is selected)</span>
            </label>
        </div>
    );
}
