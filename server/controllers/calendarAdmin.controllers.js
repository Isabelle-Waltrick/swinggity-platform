import { User } from "../models/user.model.js";
import { getBaseCookieOptions } from "../utils/cookieOptions.js";
import { submitOrganiserVerificationRequestService } from "../services/calendar.admin.service.js";

const findUserOrReject = async (userId, res) => {
    const user = await User.findById(userId);
    if (!user) {
        res.clearCookie("token", getBaseCookieOptions());
        res.status(401).json({ success: false, message: "Session expired. Please log in again." });
        return null;
    }
    return user;
};

export const submitOrganiserVerificationRequest = async (req, res) => {
    try {
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        const result = await submitOrganiserVerificationRequestService({
            user,
            body: req.body,
        });

        return res.status(result.status).json(result.body);
    } catch (error) {
        console.log("Error in submitOrganiserVerificationRequest", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
