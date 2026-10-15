const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL error:", error);
});

async function testDatabase() {
    try {
        const result = await pool.query("SELECT NOW()");

        console.log("✅ PostgreSQL connected");
        console.log("🕒 Database time:", result.rows[0].now);

    } catch (error) {
        console.error("❌ PostgreSQL connection failed");
        console.error(error.message);
    }
}

module.exports = {
    pool,
    testDatabase
};