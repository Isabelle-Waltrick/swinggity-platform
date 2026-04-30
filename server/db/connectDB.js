import mongoose from "mongoose";

// GSR03: all database access in this application goes through the Mongoose ORM.
// Query filters are plain JS objects (e.g. { user: userId }) — values are passed as data,
// never concatenated into query strings, which prevents NoSQL injection at the query level.

// Function to connect to MongoDB
export const connectDB = async () => {
	try {
		// GSR11 + GSR12: MONGO_URI is read from the environment — not hardcoded.
		// Locally it comes from the gitignored .env file; on Render it is injected by the platform.
		const conn = await mongoose.connect(process.env.MONGO_URI);
		// log a success message with the host name
		console.log(`MongoDB Connected: ${conn.connection.host}`);
	} catch (error) {
		// log any connection errors
		console.log("Error connection to MongoDB: ", error.message);
		process.exit(1); // 1 is failure, 0 status code is success
	}
};