// src/components/filter/ResetControls.tsx
type Props = {
    onReset: () => void;
};

export function ResetControls({ onReset }: Props) {
    return (
        <div
            style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: "1px solid #ccc",
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
            }}
        >
            <button
                onClick={onReset}
                style={{
                    flex: 1,
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #ccc",
                    background: "#f5f5f5",
                    cursor: "pointer",
                }}
            >
                Reset
            </button>
        </div>
    );
}
