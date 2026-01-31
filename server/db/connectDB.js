import mongoose from "mongoose";

// Function to connect to MongoDB
export const connectDB = async () => {
	try {
        // connect to MongoDB using the connection string from environment variables
		const conn = await mongoose.connect(process.env.MONGO_URI);
        // log a success message with the host name
		console.log(`MongoDB Connected: ${conn.connection.host}`);
	} catch (error) {
        // log any connection errors
		console.log("Error connection to MongoDB: ", error.message);
		process.exit(1); // 1 is failure, 0 status code is success
	}
};