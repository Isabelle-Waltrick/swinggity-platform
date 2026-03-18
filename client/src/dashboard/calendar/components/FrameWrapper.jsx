export const FrameWrapper = ({ className = "", text = "" }) => (
    <div className={className}>
        <button style={{ padding: "8px 16px", border: "1px solid #000", borderRadius: "8px", backgroundColor: "#fff", cursor: "pointer" }}>
            {text}
        </button>
    </div>
);
