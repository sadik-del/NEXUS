
const { createNotification } = require("./notificationService");
const { pool } = require("../db");

// ========================================
// GET / CREATE PROJECT CHAT
// ========================================
async function getProjectConversation(req, res) {
    try {
        const userId = req.user.id;
        const projectId = Number(req.params.projectId);

        if (!Number.isInteger(projectId) || projectId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid project ID"
            });
        }

        const membership = await pool.query(
            `SELECT id FROM project_members
             WHERE project_id = $1 AND user_id = $2`,
            [projectId, userId]
        );

        if (!membership.rowCount) {
            return res.status(403).json({
                success: false,
                message: "You must be a project member"
            });
        }

        let result = await pool.query(
            `SELECT * FROM conversations
             WHERE project_id = $1 AND type = 'project'
             LIMIT 1`,
            [projectId]
        );

        if (!result.rowCount) {
            result = await pool.query(
                `INSERT INTO conversations
                    (project_id, name, type, created_by)
                 VALUES ($1, $2, 'project', $3)
                 RETURNING *`,
                [projectId, "Project Chat", userId]
            );
        }

        const conversation = result.rows[0];

        await pool.query(
            `INSERT INTO conversation_members (conversation_id, user_id)
             SELECT $1, pm.user_id
             FROM project_members pm
             WHERE pm.project_id = $2
             ON CONFLICT (conversation_id, user_id) DO NOTHING`,
            [conversation.id, projectId]
        );

        return res.json({ success: true, conversation });
    } catch (error) {
        console.error("Get project conversation error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load project chat"
        });
    }
}

// ========================================
// SEARCH USERS FOR DIRECT MESSAGES
// GET /api/chat/users?q=sadik
// ========================================
async function searchUsers(req, res) {
    try {
        const userId = req.user.id;
        const q = String(req.query.q || "").trim();

        if (q.length < 2) {
            return res.json({ success: true, users: [] });
        }

        const result = await pool.query(
            `SELECT id, name, username, avatar_url
             FROM users
             WHERE id <> $1
               AND (username ILIKE $2 OR name ILIKE $2)
             ORDER BY
               CASE WHEN username ILIKE $3 THEN 0 ELSE 1 END,
               name ASC
             LIMIT 20`,
            [userId, `%${q}%`, `${q}%`]
        );

        return res.json({ success: true, users: result.rows });
    } catch (error) {
        console.error("Search chat users error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to search users"
        });
    }
}

// ========================================
// GET / CREATE DIRECT CONVERSATION
// GET /api/chat/direct/:userId
// ========================================
async function getDirectConversation(req, res) {
    const client = await pool.connect();

    try {
        const userId = Number(req.user.id);
        const otherUserId = Number(req.params.userId);

        if (
            !Number.isInteger(otherUserId) ||
            otherUserId <= 0 ||
            otherUserId === userId
        ) {
            return res.status(400).json({
                success: false,
                message: "Choose a valid user"
            });
        }

        const otherUser = await client.query(
            `SELECT id, name, username, avatar_url
             FROM users WHERE id = $1`,
            [otherUserId]
        );

        if (!otherUser.rowCount) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        await client.query("BEGIN");

        // Serialize creation for this user pair to avoid duplicate chats.
        const firstId = Math.min(userId, otherUserId);
        const secondId = Math.max(userId, otherUserId);

        await client.query(
            "SELECT pg_advisory_xact_lock($1, $2)",
            [firstId, secondId]
        );

        let result = await client.query(
            `SELECT c.*
             FROM conversations c
             JOIN conversation_members a
               ON a.conversation_id = c.id AND a.user_id = $1
             JOIN conversation_members b
               ON b.conversation_id = c.id AND b.user_id = $2
             WHERE c.type = 'direct'
               AND c.project_id IS NULL
               AND (
                   SELECT COUNT(*)
                   FROM conversation_members cm
                   WHERE cm.conversation_id = c.id
               ) = 2
             LIMIT 1`,
            [userId, otherUserId]
        );

        if (!result.rowCount) {
            result = await client.query(
                `INSERT INTO conversations
                    (project_id, name, type, created_by)
                 VALUES (NULL, $1, 'direct', $2)
                 RETURNING *`,
                [otherUser.rows[0].name, userId]
            );

            const conversationId = result.rows[0].id;

            await client.query(
                `INSERT INTO conversation_members
                    (conversation_id, user_id)
                 VALUES ($1, $2), ($1, $3)
                 ON CONFLICT (conversation_id, user_id) DO NOTHING`,
                [conversationId, userId, otherUserId]
            );
        }

        // Return the conversation and its two members.
        const conversationId = result.rows[0].id;

        await client.query("COMMIT");

        return res.json({
            success: true,
            conversation: result.rows[0],
            user: otherUser.rows[0]
        });
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("Get direct conversation error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to open direct conversation"
        });
    } finally {
        client.release();
    }
}


/* ========================================
   GET USER'S CONVERSATION LIST
   GET /api/chat/conversations
======================================== */
async function getConversations(req, res) {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            `
            SELECT
                c.id AS conversation_id,
                c.type,
                c.project_id,
                c.created_at,

                CASE
                    WHEN c.type = 'direct'
                        THEN COALESCE(other_user.name, other_user.username)
                    WHEN c.type = 'project'
                        THEN COALESCE(p.name, c.name, 'Project Chat')
                    ELSE COALESCE(c.name, 'Conversation')
                END AS title,

                other_user.id AS other_user_id,
                other_user.username AS other_username,
                other_user.avatar_url AS other_user_avatar,

                latest.content AS last_message,
                latest.created_at AS last_message_at,
                latest.sender_id AS last_sender_id

            FROM conversations c

            JOIN conversation_members mine
                ON mine.conversation_id = c.id
                AND mine.user_id = $1

            LEFT JOIN projects p
                ON p.id = c.project_id

            LEFT JOIN LATERAL (
                SELECT cm.user_id
                FROM conversation_members cm
                WHERE cm.conversation_id = c.id
                  AND cm.user_id <> $1
                ORDER BY cm.user_id
                LIMIT 1
            ) other_member ON c.type = 'direct'

            LEFT JOIN users other_user
                ON other_user.id = other_member.user_id

            LEFT JOIN LATERAL (
                SELECT m.content, m.created_at, m.sender_id
                FROM messages m
                WHERE m.conversation_id = c.id
                ORDER BY m.created_at DESC, m.id DESC
                LIMIT 1
            ) latest ON TRUE

            ORDER BY
                COALESCE(latest.created_at, c.created_at) DESC,
                c.id DESC
            `,
            [userId]
        );

        return res.json({
            success: true,
            conversations: result.rows
        });
    } catch (error) {
        console.error("Get conversations error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load conversations"
        });
    }
}

// ========================================
// GET MESSAGES
// ========================================
async function getMessages(req, res) {
    try {
        const userId = req.user.id;
        const conversationId = Number(req.params.conversationId);

        const membership = await pool.query(
            `SELECT id FROM conversation_members
             WHERE conversation_id = $1 AND user_id = $2`,
            [conversationId, userId]
        );

        if (!membership.rowCount) {
            return res.status(403).json({
                success: false,
                message: "You are not a conversation member"
            });
        }

        const result = await pool.query(
            `SELECT
                m.id, m.conversation_id, m.sender_id, m.content,
                m.created_at, u.name AS sender_name,
                u.username AS sender_username
             FROM messages m
             JOIN users u ON u.id = m.sender_id
             WHERE m.conversation_id = $1
             ORDER BY m.created_at ASC`,
            [conversationId]
        );

        return res.json({ success: true, messages: result.rows });
    } catch (error) {
        console.error("Get messages error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load messages"
        });
    }
}

// ========================================
// SEND MESSAGE
// ========================================
async function sendMessage(req, res) {
    try {
        const userId = req.user.id;
        const conversationId = Number(req.params.conversationId);
        const content = typeof req.body.content === "string"
            ? req.body.content.trim()
            : "";

        if (!Number.isInteger(conversationId) || conversationId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid conversation ID"
            });
        }

        if (!content) {
            return res.status(400).json({
                success: false,
                message: "Message cannot be empty"
            });
        }

        const membership = await pool.query(
            `SELECT id FROM conversation_members
             WHERE conversation_id = $1 AND user_id = $2`,
            [conversationId, userId]
        );

        if (!membership.rowCount) {
            return res.status(403).json({
                success: false,
                message: "You are not a conversation member"
            });
        }

        const result = await pool.query(
            `INSERT INTO messages (conversation_id, sender_id, content)
             VALUES ($1, $2, $3)
             RETURNING id, conversation_id, sender_id, content, created_at`,
            [conversationId, userId, content]
        );

        const message = result.rows[0];

        const senderResult = await pool.query(
            `SELECT name, username FROM users WHERE id = $1`,
            [userId]
        );

        const sender = senderResult.rows[0];
        message.sender_name = sender?.name || "User";
        message.sender_username = sender?.username || "";

        const io = req.app.get("io") || global.nexusIO;

        if (io) {
            io.to(`conversation_${conversationId}`).emit("newMessage", message);
        }

        const recipients = await pool.query(
            `SELECT user_id
             FROM conversation_members
             WHERE conversation_id = $1 AND user_id <> $2`,
            [conversationId, userId]
        );

        for (const recipient of recipients.rows) {
            await createNotification({
                userId: recipient.user_id,
                type: "message",
                title: `New message from ${message.sender_name}`,
                message: content.length > 100
                    ? `${content.slice(0, 100)}…`
                    : content,
                relatedId: message.id
            });
        }

        return res.status(201).json({ success: true, message });
    } catch (error) {
        console.error("Send message error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to send message"
        });
    }
}

module.exports = {
    getProjectConversation,
    searchUsers,
    getDirectConversation,
    getConversations,
    getMessages,
    sendMessage
};