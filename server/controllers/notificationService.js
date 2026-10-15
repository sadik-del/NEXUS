const { pool } = require("../db");

// ==========================================
// CREATE NOTIFICATION
// ==========================================

async function createNotification({
    userId,
    type,
    title,
    message,
    relatedId = null
}) {

    try {

        if (!userId) {
            return null;
        }

        const result = await pool.query(
            `
            INSERT INTO notifications (
                user_id,
                type,
                title,
                message,
                related_id
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            `,
            [
                userId,
                type,
                title,
                message,
                relatedId
            ]
        );

        const notification = result.rows[0];

        // Send real-time notification
        const io = global.nexusIO;

        if (io) {

            io.to(`user_${userId}`)
                .emit(
                    "newNotification",
                    notification
                );
        }

        return notification;

    } catch (error) {

        console.error(
            "Create notification error:",
            error.message
        );

        return null;
    }
}


module.exports = {
    createNotification
};