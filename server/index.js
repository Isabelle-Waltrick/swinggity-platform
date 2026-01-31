// importing the express module (had to change "type": "module" in package.json)
import express from 'express';
// importing the dotenv module to manage environment variables
import dotenv from 'dotenv';
// importing the connectDB function from the connectDB.js file
import { connectDB } from './db/connectDB.js';

// configure dotenv to load variables from .env file
dotenv.config();

// create an express application
const app = express();

// display a simple message at the root route
app.get('/', (req, res) => {
    res.send('Welcome to the Swinggity community!');
});

app.use("/api/auth", authRoutes);

// start the server on port 3000
app.listen(3000, () => {
    // connect to the database when the server starts
    connectDB();
	console.log("Server is running on port: 3000");
});
