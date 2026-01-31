import jwt from "jsonwebtoken";

// Function to generate JWT token and set it as a cookie
export const generateTokenAndSetCookie = (res, userId) => {
    // Generate a JWT token with userId as payload
	const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
        // Token expiration time (7 days)
		expiresIn: "7d",
	});
    // Set the token cookie in the response
	res.cookie("token", token, {
        // JavaScript cannot access this cookie (prevents XSS attacks)
		// document.cookie in browser won't show this cookie
		httpOnly: true,

		// Only send cookie over HTTPS in production
		// Prevents man-in-the-middle attacks
		secure: process.env.NODE_ENV === "production",

		 // Cookie only sent to same domain (prevents CSRF attacks)
		 // Won't be sent if request originates from different site
		sameSite: "strict",

		// Cookie expires in 7 days (604,800,000 milliseconds)
		// Browser automatically deletes it after this time
		maxAge: 7 * 24 * 60 * 60 * 1000,
	});

	return token;
};