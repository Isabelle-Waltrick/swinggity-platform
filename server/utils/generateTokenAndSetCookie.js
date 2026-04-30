// The code in this file were created with help of AI (Copilot)

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
	// GSR07: auth token is stored in a secure session cookie with all four protective attributes:
	// httpOnly  — blocks JavaScript access, preventing XSS-based token theft
	// secure    — cookie only transmitted over HTTPS (enforced in production via cookieOptions.js)
	// sameSite  — restricts cross-site sending, mitigating CSRF
	// maxAge    — bounded 7-day lifetime so tokens don't persist indefinitely
	//
	// GSR08: the JWT is stored solely in a server-controlled httpOnly cookie, never in the
	// response body, localStorage, or sessionStorage. The client has no direct access to the
	// token value, keeping sensitive session state under server control at all times.
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