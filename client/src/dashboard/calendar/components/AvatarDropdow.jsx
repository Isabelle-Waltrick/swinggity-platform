export const AvatarDropdow = ({ className = "", state = "closed" }) => (
    <div className={className} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#ccc" }}></div>
    </div>
);
