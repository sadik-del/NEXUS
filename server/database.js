const { pool } = require("./db");

async function initializeDatabase() {
    try {

        // ==============================
        // USERS
        // ==============================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(150) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                bio TEXT DEFAULT '',
                avatar_url TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("✅ Users table ready");


        // ==============================
        // COMMUNITIES
        // ==============================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS communities (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT DEFAULT '',
                category VARCHAR(50) DEFAULT 'General',
                icon VARCHAR(255) DEFAULT '',
                created_by INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                CONSTRAINT fk_community_creator
                    FOREIGN KEY (created_by)
                    REFERENCES users(id)
                    ON DELETE CASCADE
            );
        `);

        console.log("✅ Communities table ready");


        // ==============================
        // COMMUNITY MEMBERS
        // ==============================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS community_members (
                id SERIAL PRIMARY KEY,
                community_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                role VARCHAR(20) DEFAULT 'member',
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                CONSTRAINT fk_member_community
                    FOREIGN KEY (community_id)
                    REFERENCES communities(id)
                    ON DELETE CASCADE,

                CONSTRAINT fk_member_user
                    FOREIGN KEY (user_id)
                    REFERENCES users(id)
                    ON DELETE CASCADE,

                CONSTRAINT unique_community_member
                    UNIQUE (community_id, user_id)
            );
        `);

        console.log("✅ Community members table ready");

        // ==============================
        // POSTS
        // ==============================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS posts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                community_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                CONSTRAINT fk_post_user
                    FOREIGN KEY (user_id)
                    REFERENCES users(id)
                    ON DELETE CASCADE,

                CONSTRAINT fk_post_community
                    FOREIGN KEY (community_id)
                    REFERENCES communities(id)
                    ON DELETE CASCADE
            );
        `);

        console.log("✅ Posts table ready");


        // ==============================
        // POST LIKES
        // ==============================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS post_likes (
                id SERIAL PRIMARY KEY,
                post_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                CONSTRAINT fk_like_post
                    FOREIGN KEY (post_id)
                    REFERENCES posts(id)
                    ON DELETE CASCADE,

                CONSTRAINT fk_like_user
                    FOREIGN KEY (user_id)
                    REFERENCES users(id)
                    ON DELETE CASCADE,

                CONSTRAINT unique_post_like
                    UNIQUE (post_id, user_id)
            );
        `);

        console.log("✅ Post likes table ready");


        // ==============================
        // COMMENTS
        // ==============================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                post_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                CONSTRAINT fk_comment_post
                    FOREIGN KEY (post_id)
                    REFERENCES posts(id)
                    ON DELETE CASCADE,

                CONSTRAINT fk_comment_user
                    FOREIGN KEY (user_id)
                    REFERENCES users(id)
                    ON DELETE CASCADE
            );
        `);

        console.log("✅ Comments table ready");

    } catch (error) {

        console.error("❌ Database initialization failed");
        console.error(error.message);

    }

    // ==============================
// PROJECTS
// ==============================

await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,

        name VARCHAR(150) NOT NULL,

        description TEXT DEFAULT '',

        status VARCHAR(30) DEFAULT 'active',

        owner_id INTEGER NOT NULL,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT fk_project_owner
            FOREIGN KEY (owner_id)
            REFERENCES users(id)
            ON DELETE CASCADE
    );
`);

console.log("✅ Projects table ready");


// ==============================
// PROJECT MEMBERS
// ==============================

await pool.query(`
    CREATE TABLE IF NOT EXISTS project_members (
        id SERIAL PRIMARY KEY,

        project_id INTEGER NOT NULL,

        user_id INTEGER NOT NULL,

        role VARCHAR(30) DEFAULT 'member',

        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT fk_project_member_project
            FOREIGN KEY (project_id)
            REFERENCES projects(id)
            ON DELETE CASCADE,

        CONSTRAINT fk_project_member_user
            FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE CASCADE,

        CONSTRAINT unique_project_member
            UNIQUE (project_id, user_id)
    );
`);

console.log("✅ Project members table ready");

await pool.query(`
    CREATE TABLE IF NOT EXISTS project_tasks (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT DEFAULT '',
        status VARCHAR(30) DEFAULT 'todo',
        priority VARCHAR(20) DEFAULT 'medium',
        assigned_to INTEGER,
        created_by INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT fk_task_project
            FOREIGN KEY (project_id)
            REFERENCES projects(id)
            ON DELETE CASCADE,

        CONSTRAINT fk_task_assignee
            FOREIGN KEY (assigned_to)
            REFERENCES users(id)
            ON DELETE SET NULL,

        CONSTRAINT fk_task_creator
            FOREIGN KEY (created_by)
            REFERENCES users(id)
            ON DELETE CASCADE
    );
`);

console.log("✅ Project tasks table ready");

// ==============================
// CHAT CONVERSATIONS
// ==============================

await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        project_id INTEGER,
        name VARCHAR(150),
        type VARCHAR(30) DEFAULT 'project',
        created_by INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT fk_conversation_project
            FOREIGN KEY (project_id)
            REFERENCES projects(id)
            ON DELETE CASCADE,

        CONSTRAINT fk_conversation_creator
            FOREIGN KEY (created_by)
            REFERENCES users(id)
            ON DELETE CASCADE
    );
`);

console.log("✅ Conversations table ready");


// ==============================
// CONVERSATION MEMBERS
// ==============================

await pool.query(`
    CREATE TABLE IF NOT EXISTS conversation_members (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT fk_conversation_member_conversation
            FOREIGN KEY (conversation_id)
            REFERENCES conversations(id)
            ON DELETE CASCADE,

        CONSTRAINT fk_conversation_member_user
            FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE CASCADE,

        CONSTRAINT unique_conversation_member
            UNIQUE (conversation_id, user_id)
    );
`);

console.log("✅ Conversation members table ready");


// ==============================
// CHAT MESSAGES
// ==============================

await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT fk_message_conversation
            FOREIGN KEY (conversation_id)
            REFERENCES conversations(id)
            ON DELETE CASCADE,

        CONSTRAINT fk_message_sender
            FOREIGN KEY (sender_id)
            REFERENCES users(id)
            ON DELETE CASCADE
    );
`);

console.log("✅ Messages table ready");

// ==============================
// NOTIFICATIONS TABLE
// ==============================

await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,

        user_id INTEGER NOT NULL,

        type VARCHAR(50) NOT NULL,

        title VARCHAR(200) NOT NULL,

        message TEXT,

        related_id INTEGER,

        is_read BOOLEAN DEFAULT FALSE,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT fk_notification_user
            FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE CASCADE
    );
`);

console.log("✅ Notifications table ready");

}

module.exports = {
    initializeDatabase
};