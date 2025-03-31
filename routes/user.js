/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management endpoints
 */

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();

/**
 * @swagger
 * /users/add-user:
 *   post:
 *     summary: Add a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Alice"
 *               email:
 *                 type: string
 *                 example: "alice@example.com"
 *               password:
 *                 type: string
 *                 example: "securepassword"
 *               role:
 *                 type: string
 *                 example: "user"
 *     responses:
 *       200:
 *         description: User added successfully
 *       500:
 *         description: Server error
 */
router.post("/add-user", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)",
            [name, email, hashedPassword, role]
        );

        res.json({ message: "User added successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Error adding user: " + error.message });
    }
});

/**
 * @swagger
 * /users/view-users:
 *   get:
 *     summary: View all users
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of users
 *       500:
 *         description: Server error
 */
router.get("/view-users", async (req, res) => {
    try {
        const { rows } = await db.query("SELECT * FROM users;");
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: "Error fetching users" });
    }
});

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Get the profile of the currently authenticated user
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: User profile data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get("/profile", async (req, res) => {
    if (!req.session.token) {
        return res.status(401).json({ error: "Unauthorized: No token found" });
    }

    try {
        const decoded = jwt.verify(req.session.token, process.env.SECRET_KEY);

        const { rows } = await db.query(
            "SELECT id, name, email, role, api_calls FROM users WHERE id = $1",
            [decoded.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ message: "Profile accessed", user: rows[0] });
    } catch (err) {
        res.status(401).json({ error: "Invalid token" });
    }
});

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update a user's name and email
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Name"
 *               email:
 *                 type: string
 *                 example: "updated@example.com"
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 */
router.put("/:id", async (req, res) => {
    const userId = req.params.id;
    const { name, email } = req.body;

    try {
        const result = await db.query(
            "UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING *",
            [name, email, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ message: "User updated successfully", user: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: "Server error updating user" });
    }
});

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     summary: Update a user's name only
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "New Name Only"
 *     responses:
 *       200:
 *         description: User name updated
 *       404:
 *         description: User not found
 */
router.patch("/:id", async (req, res) => {
    const userId = req.params.id;
    const { name } = req.body;

    try {
        const result = await db.query(
            "UPDATE users SET name = $1 WHERE id = $2 RETURNING *",
            [name, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ message: "User name patched", user: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: "Server error patching user" });
    }
});

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted
 *       404:
 *         description: User not found
 */
router.delete("/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const result = await db.query("DELETE FROM users WHERE id=$1 RETURNING *", [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ message: "User successfully deleted" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete user" });
    }
});

module.exports = router;
