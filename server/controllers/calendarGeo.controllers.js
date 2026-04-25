import { User } from "../models/user.model.js";
import { getBaseCookieOptions } from "../utils/cookieOptions.js";
import {
    autocompleteCitiesService,
    autocompletePlacesService,
    reverseCityLookupService,
} from "../services/calendar.geo.service.js";

const findUserOrReject = async (userId, res) => {
    const user = await User.findById(userId);
    if (!user) {
        res.clearCookie("token", getBaseCookieOptions());
        res.status(401).json({ success: false, message: "Session expired. Please log in again." });
        return null;
    }
    return user;
};

export const autocompletePlaces = async (req, res) => {
    try {
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        const result = await autocompletePlacesService({
            input: req.query?.input,
            country: req.query?.country,
        });

        return res.status(result.status).json(result.body);
    } catch (error) {
        console.log("Error in autocompletePlaces", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const autocompleteCities = async (req, res) => {
    try {
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        const result = await autocompleteCitiesService({
            input: req.query?.input,
        });

        return res.status(result.status).json(result.body);
    } catch (error) {
        console.log("Error in autocompleteCities", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const reverseCityLookup = async (req, res) => {
    try {
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        const result = await reverseCityLookupService({
            lat: req.query?.lat,
            lon: req.query?.lon,
        });

        return res.status(result.status).json(result.body);
    } catch (error) {
        console.log("Error in reverseCityLookup", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
