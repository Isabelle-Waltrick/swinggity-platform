// The code in this file were created with help of AI (Copilot)

/**
 * AvatarDropdow:
 * Lightweight visual placeholder for an avatar/dropdown trigger region.
 * Primarily used in generated calendar layout scaffolding.
 */
export const AvatarDropdow = ({ className = "" }) => (
    // Wrapper allows parent layout classes while preserving basic inline alignment.
    <div className={className} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* Circular block acts as avatar stand-in when real profile image is not wired in. */}
        <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#ccc" }}></div>
    </div>
);
