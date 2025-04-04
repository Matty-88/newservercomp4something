require('dotenv').config();

//pool manages database connections
const { Pool } = require('pg');



const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    //enables SSL in production, prevents cirtification issues with Render
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.query(`
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
    api_calls INTEGER DEFAULT 0
);`, (err) => {
    if (err) {
        console.error(" Error creating users table:", err);
    } else {
        console.log(" Users table ready (PostgreSQL).");
    }
});

// Create `api_usage` table
pool.query(`
    CREATE TABLE IF NOT EXISTS api_usage (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        request_count INTEGER DEFAULT 1
    );`, (err) => {
        if (err) {
            console.error("Error creating api_usage table:", err);
        } else {
            console.log(" API usage table ready (PostgreSQL).");
        }
    });

module.exports = pool;
