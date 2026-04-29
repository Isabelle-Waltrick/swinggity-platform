// The code in this file were created with help of AI (Copilot)

/**
 * Calendar Admin Controller Guide
 * This controller currently handles organiser verification request endpoints.
 * It acts as an HTTP boundary around the calendar admin service layer.
 */

import { submitOrganiserVerificationRequestService } from "../services/calendar.admin.service.js";
import { findUserOrReject } from "./calendar.controllerShared.js";

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
