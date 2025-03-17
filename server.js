const express = require("express");
const session = require("express-session");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const db = require("./db");
const axios = require("axios");
const {exec} = require("child_process")


const cors = require("cors"); // Import CORS middleware


const app = express();


app.use(cors());
const SECRET_KEY = "O5FMXotTEzuXKXZ0kSqK42EO80xrH"; // Change this to a secure secret
const MUSICGEN_API_URL = process.env.MUSICGEN_API_URL || "http://localhost:5001";
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

    const sql = "SELECT id, name, role, email, password, api_calls FROM users WHERE email = $1";
    
    try {
        const { rows } = await db.query(sql, [email]);
        const user = rows[0];
        if (!user) return res.status(401).json({ error: "User not found" });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: "Invalid password" });

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET_KEY, { expiresIn: "24h" });

        req.session.token = token;

        await db.query("UPDATE users SET api_calls = api_calls + 1 WHERE id = $1", [user.id]);

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

        res.json({ message: "✅ User added successfully!" });
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
