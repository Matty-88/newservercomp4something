// server.js
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const cors = require("cors");
const db = require("./db");
const messages = require("./messages");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY;

app.set("trust proxy", 1);

const allowedOrigins = [
    "http://localhost:3000",
    "https://stirring-quokka-38a3ea.netlify.app",
];

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error(messages.notAllowedCors));
            }
        },
        credentials: true,
    })
);

app.use(express.json());

app.use(
    session({
        secret: SECRET_KEY,
        resave: false,
        saveUninitialized: true,
        cookie: {
            secure: true,
            sameSite: "None",
        },
    })
);

// Middleware to log API usage to api_usage table
app.use(async (req, res, next) => {
    if (req.session.token) {
        try {
            const decoded = jwt.verify(req.session.token, SECRET_KEY);
            const userId = decoded.id;
            const endpoint = req.path;
            const method = req.method;

            const checkQuery = `SELECT * FROM api_usage WHERE user_id = $1 AND endpoint = $2 AND method = $3`;
            const { rows } = await db.query(checkQuery, [userId, endpoint, method]);

            if (rows.length > 0) {
                const updateQuery = `UPDATE api_usage SET request_count = request_count + 1 WHERE id = $1`;
                await db.query(updateQuery, [rows[0].id]);
            } else {
                const insertQuery = `INSERT INTO api_usage (user_id, endpoint, method, request_count) VALUES ($1, $2, $3, 1)`;
                await db.query(insertQuery, [userId, endpoint, method]);
            }
        } catch (err) {
            console.error(messages.apiUseLogErr, err.message);
        }
    }
    next();
});

// Swagger Setup
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "COMP 4537 - Group O3P - AI Music Generator API",
            version: "1.0.0",
            description: "REST API documentation using Swagger UI",
        },
    },
    apis: ["./routes/*.js"], // 👈 Scans routes files for @swagger comments
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Route Imports
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const adminRoutes = require("./routes/admin");
const musicRoutes = require("./routes/music");

// Route Usage
app.use("/v1/auth", authRoutes);
app.use("/v1/users", userRoutes);
app.use("/v1/admin", adminRoutes);
app.use("/v1", musicRoutes);

app.listen(PORT, () =>
    console.log(`Server running on http://localhost:${PORT}`)
);
