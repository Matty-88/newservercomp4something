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

const allowedOrigins = [
    "http://localhost:3000",
    "https://stirring-quokka-38a3ea.netlify.app"
  ];

//enables cores. express applies cors() before handling any routes
//it modifies response headers to allow requests from different origins 
app.use(
    cors({
      origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
    })
  );

//user to sign and verify JSON web tokens JWT for authentication, I will move later should not be here 
const SECRET_KEY = "O5FMXotTEzuXKXZ0kSqK42EO80xrH"; 

//requests are send to this url
const MUSICGEN_API_URL = "https://router.huggingface.co/hf-inference/models/facebook/musicgen-small";

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
        cookie: { secure: true,
            sameSite: "None", // Set to 'None' for cross-origin requests

         }, // Set to true if using HTTPS
       // Set to None for cross-origin requests
    })
);

// Middleware to log API usage to api_usage table
app.use(async (req, res, next) => {
    // Only track logged-in users
    if (req.session.token) {
        try {
            const decoded = jwt.verify(req.session.token, SECRET_KEY);
            const userId = decoded.id;
            const endpoint = req.path;
            const method = req.method;

            // Check if user already has a usage record for this endpoint and method
            const checkQuery = `SELECT * FROM api_usage WHERE user_id = $1 AND endpoint = $2 AND method = $3`;
            const { rows } = await db.query(checkQuery, [userId, endpoint, method]);

            if (rows.length > 0) {
                // Update request count
                const updateQuery = `UPDATE api_usage SET request_count = request_count + 1 WHERE id = $1`;
                await db.query(updateQuery, [rows[0].id]);
            } else {
                // Insert new record
                const insertQuery = `INSERT INTO api_usage (user_id, endpoint, method, request_count) VALUES ($1, $2, $3, 1)`;
                await db.query(insertQuery, [userId, endpoint, method]);
            }
        } catch (err) {
            console.error("API usage logging error:", err.message);
            // Proceed without logging if token is invalid or DB error occurs
        }
    }
    next();
});

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



// Get API usage stats (Admin only)
app.get("/admin/api-usage", async (req, res) => {
    if (!req.session.token) {
        return res.status(401).json({ error: "Unauthorized: No token found" });
    }

    try {
        const decoded = jwt.verify(req.session.token, SECRET_KEY);

        if (decoded.role !== "admin") {
            return res.status(403).json({ error: "Forbidden: Admins only" });
        }

        const query = `
            SELECT 
                u.name,
                u.email,
                u.id AS user_id,
                a.endpoint,
                a.method,
                a.request_count
            FROM api_usage a
            JOIN users u ON u.id = a.user_id
            ORDER BY a.user_id;
        `;

        const { rows } = await db.query(query);
        res.json(rows);
    } catch (error) {
        console.error("Failed to fetch API usage:", error);
        res.status(500).json({ error: "Server error retrieving API stats" });
    }
});


app.get("/admin/api-usage-summary", async (req, res) => {
    if (!req.session.token) {
        return res.status(401).json({ error: "Unauthorized: No token found" });
    }

    try {
        const decoded = jwt.verify(req.session.token, SECRET_KEY);

        if (decoded.role !== "admin") {
            return res.status(403).json({ error: "Forbidden: Admins only" });
        }

        // 1. Summary by endpoint/method
        const endpointQuery = `
            SELECT 
                method,
                endpoint,
                SUM(request_count) as total_requests
            FROM api_usage
            GROUP BY method, endpoint
            ORDER BY method, endpoint;
        `;

        // 2. Summary by user
        const userQuery = `
            SELECT 
                u.name,
                u.email,
                u.id,
                SUM(a.request_count) as total_requests
            FROM users u
            JOIN api_usage a ON u.id = a.user_id
            GROUP BY u.id, u.name, u.email
            ORDER BY total_requests DESC;
        `;

        const [endpointStats, userStats] = await Promise.all([
            db.query(endpointQuery),
            db.query(userQuery),
        ]);

        res.json({
            endpoints: endpointStats.rows,
            users: userStats.rows,
        });
    } catch (error) {
        console.error("Failed to fetch usage summaries:", error);
        res.status(500).json({ error: "Server error retrieving usage summaries" });
    }
});




app.get("/profile", async (req, res) => {
    if (!req.session.token) {
        return res.status(401).json({ error: "Unauthorized: No token found" });
    }

    try {
        const decoded = jwt.verify(req.session.token, SECRET_KEY);

        // Fetch fresh user data including api_calls
        const { rows } = await db.query(
            "SELECT id, name, email, role, api_calls FROM users WHERE id = $1",
            [decoded.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        const user = rows[0];

        res.json({ message: "Profile accessed", user });
    } catch (err) {
        console.error("Profile error:", err);
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

app.put("/users/:id", async (req, res) => {
    const userId = req.params.id;
    const { name, email } = req.body;

    try {
        const result = await db.query(
            `UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING *`,
            [name, email, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ message: "User updated successfully", user: result.rows[0] });
    } catch (error) {
        console.error("PUT /users/:id error:", error);
        res.status(500).json({ error: "Server error updating user" });
    }
});

app.patch("/users/:id", async (req, res) => {
    const userId = req.params.id;
    const { name } = req.body;

    try {
        const result = await db.query(
            `UPDATE users SET name = $1 WHERE id = $2 RETURNING *`,
            [name, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ message: "User name patched", user: result.rows[0] });
    } catch (error) {
        console.error("PATCH /users/:id error:", error);
        res.status(500).json({ error: "Server error patching user" });
    }
});

// DELETE route to remove a user
// DELETE route to remove a user
app.delete("/users/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const result = await db.query("DELETE FROM users WHERE id=$1 RETURNING *", [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ message: "User successfully deleted" });
    } catch (err) {
        console.error("Server DELETE error:", err); // <-- Improved logging here
        res.status(500).json({ error: "Failed to delete user" });
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
