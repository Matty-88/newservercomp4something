// routes/users.js
const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const router = express.Router();

router.post("/add-user", async (req, res) => {
    try {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
        `INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)`,
        [name, email, hashedPassword, role]
    );
    res.json({ message: "User added successfully!" });
    } catch (error) {
    res.status(500).json({ error: "Error adding user: " + error.message });
    }
});

router.get("/view-users", async (req, res) => {
    try {
    const { rows } = await db.query("SELECT * FROM users;");
    res.json(rows);
    } catch (error) {
    res.status(500).json({ error: "Error fetching users" });
    }
});

router.get("/profile", async (req, res) => {
    if (!req.session.token) {
    return res.status(401).json({ error: "Unauthorized: No token found" });
    }

    try {
    const decoded = require("jsonwebtoken").verify(req.session.token, "O5FMXotTEzuXKXZ0kSqK42EO80xrH");
    const { rows } = await db.query(
        "SELECT id, name, email, role, api_calls FROM users WHERE id = $1",
        [decoded.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json({ message: "Profile accessed", user: rows[0] });
    } catch (err) {
    res.status(401).json({ error: "Invalid token" });
    }
});

router.put("/:id", async (req, res) => {
    const userId = req.params.id;
    const { name, email } = req.body;

    try {
    const result = await db.query(
      `UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING *`,
        [name, email, userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User updated successfully", user: result.rows[0] });
    } catch (error) {
    res.status(500).json({ error: "Server error updating user" });
    }
});

router.patch("/:id", async (req, res) => {
    const userId = req.params.id;
    const { name } = req.body;

    try {
    const result = await db.query(
      `UPDATE users SET name = $1 WHERE id = $2 RETURNING *`,
        [name, userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User name patched", user: result.rows[0] });
    } catch (error) {
    res.status(500).json({ error: "Server error patching user" });
    }
});

router.delete("/:id", async (req, res) => {
    const { id } = req.params;

    try {
    const result = await db.query("DELETE FROM users WHERE id=$1 RETURNING *", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User successfully deleted" });
    } catch (err) {
    res.status(500).json({ error: "Failed to delete user" });
    }
});

module.exports = router;
