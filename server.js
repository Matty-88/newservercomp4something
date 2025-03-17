const express = require("express");
const session = require("express-session");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3").verbose();
const db = require("./db");
const axios = require("axios");
const {exec} = require("child_process")


const cors = require("cors"); // Import CORS middleware


const app = express();


app.use(cors());
const SECRET_KEY = "O5FMXotTEzuXKXZ0kSqK42EO80xrH"; // Change this to a secure secret
const MUSICGEN_API_URL = process.env.MUSICGEN_API_URL || "http://localhost:5001";
const DATABASE_PATH = process.env.DATABASE_PATH || "./database.sqlite";
const PORT = process.env.PORT || 5000;

app.use(express.json());

// Session Middleware
app.use(
    session({
        secret: SECRET_KEY,
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false }, // Set to true if using HTTPS
    })
);

const incrementAPI = (user) => {
    const updateSql = "UPDATE users SET api_calls = api_calls + 1 WHERE id = ?";
        db.run(updateSql, [user.id], function (updateErr) {
            if (updateErr) {
                return res.status(500).json({ error: "Failed to update API calls" });
            }})
}

exec("py musicgenAPI.py", (error, stdout, stderr) => {
    if (error) {
        console.error(`Error starting MusicGen API: ${error.message}`);
    } else {
        console.log(`MusicGen API Running: ${stdout}`);
    }
});


// Login Route
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const sql = "SELECT id, name, role, email, password, api_calls FROM users WHERE email = ?";
    
    db.get(sql, [email], async (err, user) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!user) return res.status(401).json({ error: "User not found" });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: "Invalid password" });

        // Generate JWT token
        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: "24h" });

        // Save token in session
        req.session.token = token;

        // Increment API calls
        await incrementAPI(user);
        

            res.json({
                message: "Login successful",
                token: token, // Return token
                user: {
                    id: user.id,
                    name: user.name,
                    role: user.role,
                    email: user.email,
                    api_calls: user.api_calls + 1, // Updated API call count
                },
            });
        });
    });


// Check if user is authenticated
app.get("/profile", (req, res) => {
    if (!req.session.token) {
        return res.status(401).json({ error: "Unauthorized: No token found" });
    }

    try {
        const decoded = jwt.verify(req.session.token, SECRET_KEY);
        res.json({ message: "Profile accessed", user: decoded });
    } catch (err) {
        res.status(401).json({ error: "Invalid token" });
    }
});

// Logout Route
app.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: "Failed to log out" });
        res.json({ message: "Logged out successfully" });
    });
});

app.post("/generate-music", async (req, res) => {
    try {
        const { prompt } = req.body;
        const response = await axios.post("http://localhost:5001/generate-music", { prompt });
        res.json(response.data);
    } catch (error) {
        console.error("MusicGen API Error:", error);
        res.status(500).json({ error: "Failed to generate music" });
    }
});

// Start server

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
