// import the jsonwebtoken library for token verification
import jwt from "jsonwebtoken";

// Middleware function to verify JWT token from cookies
// next() is called to pass control to the next middleware function (checkAuth)
export const verifyToken = (req, res, next) => {
    // retrieve token from cookies
	const token = req.cookies.token;
    // if no token found, return unauthorized response
	if (!token) return res.status(401).json({ success: false, message: "Unauthorized - no token provided" });
	try {
        // verify the token using the secret key
		const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // if token is invalid, return unauthorized response
		if (!decoded) return res.status(401).json({ success: false, message: "Unauthorized - invalid token" });
        // attach decoded userId to request object for use in next middleware/controller
		req.userId = decoded.userId;
        // pass control to the next middleware function
		next();
	} catch (error) {
        // log any errors during token verification
		console.log("Error in verifyToken ", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
};