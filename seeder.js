const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");

const db = require("./db")

// Function to add a user
const addUser = async (name, email, password, role) => {
    try {
        const hashedPassword = await bcrypt.hash(password, 10); // Hash the password

        db.run(
            `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
            [name, email, hashedPassword, role],
            function (err) {
                if (err) {
                    console.error("Error inserting user:", err.message);
                } else {
                    console.log(`✅ User ${name} (${role}) added successfully.`);
                }
                db.close(); // Close DB connection after operation
            }
        );
    } catch (error) {
        console.error("Error hashing password:", error);
    }
};

// Run the seeder function
addUser("Admin User", "admin@admin.com", "111", "admin"); // Change details as needed
