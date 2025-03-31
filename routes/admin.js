/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin-level endpoints for monitoring API usage
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY;

/**
 * @swagger
 * /admin/api-usage:
 *   get:
 *     summary: Retrieve detailed API usage records for all users
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: A list of API usage records
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (user is not an admin)
 */
router.get("/api-usage", async (req, res) => {
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

/**
 * @swagger
 * /admin/api-usage-summary:
 *   get:
 *     summary: Retrieve summarized API usage by endpoint and user
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Summarized API usage data
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (user is not an admin)
 */
router.get("/api-usage-summary", async (req, res) => {
    if (!req.session.token) {
        return res.status(401).json({ error: "Unauthorized: No token found" });
    }

    try {
        const decoded = jwt.verify(req.session.token, SECRET_KEY);

        if (decoded.role !== "admin") {
            return res.status(403).json({ error: "Forbidden: Admins only" });
        }

        const endpointQuery = `
        SELECT 
        method,
        endpoint,
        SUM(request_count) as total_requests
        FROM api_usage
        GROUP BY method, endpoint
        ORDER BY method, endpoint;
    `;

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

module.exports = router;
