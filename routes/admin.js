// routes/admin.js
const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db");
const messages = require("../messages");
const router = express.Router();

const SECRET_KEY = "O5FMXotTEzuXKXZ0kSqK42EO80xrH";

router.get("/api-usage", async (req, res) => {
    if (!req.session.token) {
        return res.status(401).json({ error: messages.unauthorized });
    }

    try {
        const decoded = jwt.verify(req.session.token, SECRET_KEY);
        if (decoded.role !== "admin") {
            return res.status(403).json({ error: messages.adminONly });
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
        console.error(messages.failedFetchApi, error);
        res.status(500).json({ error: "Server error retrieving API stats" });
    }
});

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
