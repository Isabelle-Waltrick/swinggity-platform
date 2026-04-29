// The code in this file were created with help of AI (Copilot)

/**
 * FrameWrapper:
 * Reusable wrapper component that renders a styled button inside a configurable container div.
 * Used as a generic frame element across calendar UI components.
 */
export const FrameWrapper = ({ className = "", text = "" }) => (
    // Outer div accepts a className to allow parent components to control layout/positioning.
    <div className={className}>
        {/* Button with fixed inline styles; renders the provided text label. */}
        <button style={{ padding: "8px 16px", border: "1px solid #000", borderRadius: "8px", backgroundColor: "#fff", cursor: "pointer" }}>
            {text}
        </button>
    </div>
);
