// routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const messages = require("../messages");
const router = express.Router();

const SECRET_KEY = "O5FMXotTEzuXKXZ0kSqK42EO80xrH";

router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const sql = "SELECT id, name, role, email, password, api_calls FROM users WHERE email = $1";

    try {
        const { rows } = await db.query(sql, [email]);
        const user = rows[0];
        if (!user) return res.status(401).json({ error: messages.userNotFound });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: messages.invalPass });

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

router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: "Failed to log out" });
        res.json({ message: "Logged out successfully" });
    });
});

module.exports = router;
