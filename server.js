// Load environment variables
require("dotenv").config();

// Core modules
const express = require("express");
const session = require("express-session");
const cors = require("cors");
const jwt = require("jsonwebtoken");

// Custom modules
const db = require("./db");
const messages = require("./messages");

// App & Config
const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY;

const allowedOrigins = [
    "http://localhost:3000",
    "https://stirring-quokka-38a3ea.netlify.app",
];

// Swagger setup
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

// Route Imports
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const adminRoutes = require("./routes/admin");
const musicRoutes = require("./routes/music");

// Express Middleware
app.use(express.json());
app.set("trust proxy", 1);

// CORS setup
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

// Session management
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

// Middleware to log API usage
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

// Swagger Docs at /docs
const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "COMP 4537 - Group O3P - AI Music Generator API",
            version: "1.0.0",
            description: "REST API documentation using Swagger UI",
        },
        servers: [
            {
                url: "http://localhost:5000/v1",
                description: "Development server",
            },
        ],
    },
    apis: ["./routes/*.js"], // Swagger reads route files for @swagger comments
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Versioned Routes
app.use("/v1/auth", authRoutes);
app.use("/v1/user", userRoutes);
app.use("/v1/admin", adminRoutes);
app.use("/v1", musicRoutes);

// Start Server
app.listen(PORT, () =>
    console.log(`Server running at http://localhost:${PORT}/v1`)
);
