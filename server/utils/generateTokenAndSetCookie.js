import jwt from "jsonwebtoken";
import { getBaseCookieOptions } from "./cookieOptions.js";

// Function to generate JWT token and set it as a cookie
export const generateTokenAndSetCookie = (res, userId) => {
	// Generate a JWT token with userId as payload
	const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
		// Token expiration time (7 days)
		expiresIn: "7d",
	});
	const baseCookieOptions = getBaseCookieOptions();
	// Set the token cookie in the response
	res.cookie("token", token, {
		httpOnly: baseCookieOptions.httpOnly,
		secure: baseCookieOptions.secure,
		sameSite: baseCookieOptions.sameSite,
		path: baseCookieOptions.path,
		// Cookie expires in 7 days (604,800,000 milliseconds)
		// Browser automatically deletes it after this time
		maxAge: 7 * 24 * 60 * 60 * 1000,
	});

	return token;
};