const { pool } = require("../db");

// ======================================
// GET USER NOTIFICATIONS
// ======================================


async function getNotifications(req, res) {
    try {
        const userId = req.user.id;

        
        
        const result = await pool.query(
            `
            SELECT
                n.id,
                n.type,
                n.title,
                n.message,
                n.related_id,
                n.is_read,
                n.created_at,
                t.project_id AS target_project_id,
                t.id AS target_task_id,
                c.project_id AS target_chat_project_id,
                m.conversation_id AS target_conversation_id,
                other_cm.user_id AS target_direct_user_id
            FROM notifications n

            LEFT JOIN project_tasks t
                ON n.type = 'task'
                AND t.id = n.related_id

            LEFT JOIN messages m
                ON n.type = 'message'
                AND m.id = n.related_id

            LEFT JOIN conversations c
                ON c.id = m.conversation_id

            LEFT JOIN conversation_members other_cm
                ON other_cm.conversation_id = c.id
                AND other_cm.user_id <> n.user_id
                AND c.type = 'direct'

            WHERE n.user_id = $1
            ORDER BY n.created_at DESC
            `,
            [userId]
        );

        res.json({
            success: true,
            notifications: result.rows
        });

    } catch (error) {
        console.error("Get notifications error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to load notifications."
        });
    }
}


// ======================================
// GET UNREAD COUNT
// ======================================

async function getUnreadCount(req, res) {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            `
            SELECT COUNT(*) AS count
            FROM notifications
            WHERE user_id = $1
            AND is_read = FALSE
            `,
            [userId]
        );

        res.json({
            success: true,
            count: Number(result.rows[0].count)
        });

    } catch (error) {

        console.error(
            "Unread notification count error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Unable to get unread count"
        });
    }
}


// ======================================
// MARK ONE NOTIFICATION AS READ
// ======================================

async function markNotificationRead(req, res) {
    try {
        const userId = req.user.id;
        const notificationId =
            Number(req.params.id);

        if (
            !Number.isInteger(notificationId) ||
            notificationId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid notification ID"
            });
        }

        const result = await pool.query(
            `
            UPDATE notifications
            SET is_read = TRUE
            WHERE id = $1
            AND user_id = $2
            RETURNING id
            `,
            [
                notificationId,
                userId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            });
        }

        res.json({
            success: true,
            message: "Notification marked as read"
        });

    } catch (error) {

        console.error(
            "Mark notification read error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Unable to update notification"
        });
    }
}


// ======================================
// MARK ALL NOTIFICATIONS AS READ
// ======================================

async function markAllNotificationsRead(req, res) {
    try {
        const userId = req.user.id;

        await pool.query(
            `
            UPDATE notifications
            SET is_read = TRUE
            WHERE user_id = $1
            AND is_read = FALSE
            `,
            [userId]
        );

        res.json({
            success: true,
            message: "All notifications marked as read"
        });

    } catch (error) {

        console.error(
            "Mark all notifications read error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to update notifications"
        });
    }
}


module.exports = {
    getNotifications,
    getUnreadCount,
    markNotificationRead,
    markAllNotificationsRead
};