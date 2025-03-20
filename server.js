const express = require("express"); //imports express framework used for web server, handles http requewsts, routes middleware

//manages user sessions, in memory to keep users logged in between requests
const session = require("express-session");

//used to create and verify JWT's
//when a user is logged in a jwt token is generated
//token is send with each request to verify user
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

//imports the db module 
const db = require("./db");

//axios library for http requests
// calls hugginface API 
const axios = require("axios");

//not used anymore 
// const { exec } = require("child_process")

//allows client to communicate with backend hosted on different domain
const cors = require("cors");

//creates an exprss app instance, used for routes, middleware and start server
const app = express();

//enables cores. express applies cors() before handling any routes
//it modifies response headers to allow requests from different origins 
app.use(cors());

//user to sign and verify JSON web tokens JWT for authentication, I will move later should not be here 
const SECRET_KEY = "O5FMXotTEzuXKXZ0kSqK42EO80xrH"; 

//requests are send to this url
const MUSICGEN_API_URL = " https://router.huggingface.co/hf-inference/models/facebook/musicgen-small";

//sets port dynamimcally by render or 5000 if not set 
const PORT = process.env.PORT || 5000;

//enables json parsing in the express app, automaically parses incoming JSON request fro req.body
//converts json string from the requests into javascript objects
app.use(express.json());

//not used. moved to .env
const HUGGINGFACE_API_URL = "https://api-inference.huggingface.co/models/facebook/musicgen-small";
//authentication key for hug face API, required in every request, identifies your account
const HUGGINGFACE_API_KEY = "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";

// Session Middleware
//configures session managesment in express app
app.use(
    session({
        //encrypts session data
        secret: SECRET_KEY,
        //prevents sessions form being saved repeatidy if nothing has changed
        resave: false,
        //if true a new session is created for every vistior even if they dont log in
        //if set false session wont be created unless a user logs in 
        saveUninitialized: true,
        //controls wheateher cookies sent over HTTPS
        //false is cookies work in both HTTP and HTTPS
        //try setting to true after becuase render uses HTTPS
        cookie: { secure: false }, // Set to true if using HTTPS
    })
);

//not fully implemented
//takes in a currently authenticated user
//will be called wheneevr the user makes an API request 
const incrementAPI = (user) => {
    //updates users table
    //only for the specific user ID is updated 
    const updateSql = "UPDATE users SET api_calls = api_calls + 1 WHERE id = ?";

    //db.run executes sql query
    //the placeholder ? in updatesql is replaced with user.id
    //function is called when someone makes an API request
    db.run(updateSql, [user.id], function (updateErr) {
        if (updateErr) {
            //res is http response object. sends json back to the client
            return res.status(500).json({ error: "Failed to update API calls" });
        }
    })
}

// exec("py musicgenAPI.py", (error, stdout, stderr) => {
//     if (error) {
//         console.error(`Error starting MusicGen API: ${error.message}`);
//     } else {
//         console.log(`MusicGen API Running: ${stdout}`);
//     }
// });


// Login Route
app.post("/login", async (req, res) => {

    //gets email and password send from the req.body send from the client
    const { email, password } = req.body;

    //finds sthe user by their email, $1 is a parameter laceholder to prevent sql injectoin
    //fetches the id name role email password api calls form the users table
    const sql = "SELECT id, name, role, email, password, api_calls FROM users WHERE email = $1";

    try {
        //extracts rows (results) fomr database reaponse
        //sends query to database to search for the email
        //await to pause exectuion because query is async
        const { rows } = await db.query(sql, [email]);

        //gets the first user if found
        const user = rows[0];
        if (!user) return res.status(401).json({ error: "User not found" });

        //comapres the passwords user.password in database
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: "Invalid password" });

        //creates the jwt token with id email role, secret key to sign the token, used for authentication
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET_KEY, { expiresIn: "24h" });

        //stores the token in the session, keeps user logged in whithoug re-authenticating every request
        req.session.token = token;

        //updates apicalls in db
        await db.query("UPDATE users SET api_calls = api_calls + 1 WHERE id = $1", [user.id]);

        //sends a login response to the client
        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                role: user.role,
                email: user.email,
                api_calls: user.api_calls + 1,
            },
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});


// Check if user is authenticated
//returs data about a loggin in user, verifies the toke 
app.get("/profile", (req, res) => {
    //if no token then no logged in
    if (!req.session.token) {
        return res.status(401).json({ error: "Unauthorized: No token found" });
    }

    try {
        //checks if token is valid with secret key
        //decoded contains user id email role
        const decoded = jwt.verify(req.session.token, SECRET_KEY);
        res.json({ message: "Profile accessed", user: decoded });
    } catch (err) {
        res.status(401).json({ error: "Invalid token" });
    }
});

app.post("/add-user", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Hash password before storing
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user into the database
        await db.query(
            `INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)`,
            [name, email, hashedPassword, role]
        );

        res.json({ message: "User added successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Error adding user: " + error.message });
    }
});

app.get("/view-users", async (req, res) => {
    try {
        const { rows } = await db.query("SELECT * FROM users;");
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: " Error fetching users" });
    }
});


// Logout Route
app.post("/logout", (req, res) => {
    //removes user session from the sever
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: "Failed to log out" });
        res.json({ message: "Logged out successfully" });
    });
});

app.post('/generate-music', async (req, res) => {
    const { prompt } = req.body;
  
    try {
      const response = await axios.post(MUSICGEN_API_URL, { inputs: prompt }, {
        //headers for authentication and request type
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        //ensures teh respnose is not treted as json becuase it is raw binary audio
        responseType: 'arraybuffer', 
      });
  
      // tells client we are sending an audio file 
      //makes browser download the file instead of playhing it 
      res.set({
        'Content-Type': 'audio/wav',
        'Content-Disposition': 'attachment; filename="audio.wav"',
      });
  
      // Send binary buffer directly
      //converst binary data into node buffer object to properly store binary data
      res.send(Buffer.from(response.data, 'binary'));
    } catch (error) {
      console.error("Music generation failed:", error);
      res.status(500).json({
        error: "Music generation failed",
        details: error.response ? error.response.data : error.message,
      });
    }
  });
  


// Start server

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
