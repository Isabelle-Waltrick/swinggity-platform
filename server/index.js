// importing the express module (had to change "type": "module" in package.json)
import express from 'express';

// create an express application
const app = express();

// display a simple message at the root route
app.get('/', (req, res) => {
    res.send('Welcome to the Swinggity community!');
});

// start the server on port 3000
app.listen(3000, () => {
	console.log("Server is running on port: 3000");
});
