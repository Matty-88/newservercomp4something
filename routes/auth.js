/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication routes
 */

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("../db");
const messages = require("../messages");

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY;

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid email or password
 *       400:
 *         description: Bad request
 */
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const sql = "SELECT id, name, role, email, password, api_calls FROM users WHERE email = $1";

    try {
        const { rows } = await db.query(sql, [email]);
        const user = rows[0];
        if (!user) return res.status(401).json({ error: messages.userNotFound });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: messages.invalPass });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            SECRET_KEY,
            { expiresIn: "24h" }
        );

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

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Log out the current user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logout successful
 *       500:
 *         description: Server error logging out
 */
router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: "Failed to log out" });
        res.json({ message: "Logged out successfully" });
    });
});

module.exports = router;
