// Function to add a user
const bcrypt = require("bcryptjs");
const db = require("./db");

const addUser = async (name, email, password, role) => {
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            `INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)`,
            [name, email, hashedPassword, role]
        );
        console.log(`✅ User ${name} (${role}) added successfully.`);
    } catch (error) {
        console.error("Error inserting user:", error.message);
    } finally {
        await db.end(); // close connection
    }
};

// addUser("Admin User", "admin@admin.com", "111", "admin");
addUser("User1", "user1@user.com", "222", "user");
