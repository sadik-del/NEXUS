const { pool } = require("../db");
const { createNotification } = require("./notificationService");

// ==============================
// CREATE COMMUNITY
// ==============================

async function createCommunity(req, res) {
    try {

        const { name, description, category, icon } = req.body;

        const userId = req.user.id;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Community name is required"
            });
        }

        const communityResult = await pool.query(
            `
            INSERT INTO communities
            (name, description, category, icon, created_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            `,
            [
                name.trim(),
                description || "",
                category || "General",
                icon || "",
                userId
            ]
        );

        const community = communityResult.rows[0];

        await pool.query(
            `
            INSERT INTO community_members
            (community_id, user_id, role)
            VALUES ($1, $2, 'admin')
            `,
            [community.id, userId]
        );

        res.status(201).json({
            success: true,
            message: "Community created successfully",
            community
        });

    } catch (error) {

        console.error("Create community error:", error);

        res.status(500).json({
            success: false,
            message: "Server error while creating community"
        });

    }
}


// ==============================
// GET ALL COMMUNITIES
// ==============================

async function getCommunities(req, res) {
    try {

        const userId = req.user.id;

        const result = await pool.query(
            `
            SELECT
                c.id,
                c.name,
                c.description,
                c.category,
                c.icon,
                c.created_at,

                u.username AS creator,

                COUNT(DISTINCT cm.id)::INTEGER AS member_count,

                EXISTS (
                    SELECT 1
                    FROM community_members current_member
                    WHERE current_member.community_id = c.id
                    AND current_member.user_id = $1
                ) AS is_member

            FROM communities c

            JOIN users u
                ON c.created_by = u.id

            LEFT JOIN community_members cm
                ON c.id = cm.community_id

            GROUP BY
                c.id,
                u.username

            ORDER BY c.created_at DESC
            `,
            [userId]
        );

        res.json({
            success: true,
            communities: result.rows
        });

    } catch (error) {

        console.error("Get communities error:", error);

        res.status(500).json({
            success: false,
            message: "Server error while loading communities"
        });

    }
}


// ==============================
// GET SINGLE COMMUNITY
// ==============================

async function getCommunity(req, res) {
    try {

        const communityId = req.params.id;
        const userId = req.user.id;

        const result = await pool.query(
            `
            SELECT
                c.id,
                c.name,
                c.description,
                c.category,
                c.icon,
                c.created_at,

                u.username AS creator,

                COUNT(DISTINCT cm.id)::INTEGER AS member_count,

                EXISTS (
                    SELECT 1
                    FROM community_members current_member
                    WHERE current_member.community_id = c.id
                    AND current_member.user_id = $2
                ) AS is_member

            FROM communities c

            JOIN users u
                ON c.created_by = u.id

            LEFT JOIN community_members cm
                ON c.id = cm.community_id

            WHERE c.id = $1

            GROUP BY
                c.id,
                u.username
            `,
            [communityId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Community not found"
            });
        }

        res.json({
            success: true,
            community: result.rows[0]
        });

    } catch (error) {

        console.error("Get community error:", error);

        res.status(500).json({
            success: false,
            message: "Server error while loading community"
        });

    }
}


// ==============================
// JOIN COMMUNITY
// ==============================

async function joinCommunity(req, res) {
    try {
        const communityId = req.params.id;
        const userId = req.user.id;

        // Get community details and its creator
        const communityResult = await pool.query(
            `
            SELECT id, name, created_by
            FROM communities
            WHERE id = $1
            `,
            [communityId]
        );

        if (communityResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Community not found"
            });
        }

        const community = communityResult.rows[0];

        // Prevent duplicate membership
        const existingMember = await pool.query(
            `
            SELECT id
            FROM community_members
            WHERE community_id = $1
              AND user_id = $2
            `,
            [communityId, userId]
        );

        if (existingMember.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "You are already a member of this community"
            });
        }

        // Add the user to the community
        await pool.query(
            `
            INSERT INTO community_members
                (community_id, user_id, role)
            VALUES ($1, $2, 'member')
            `,
            [communityId, userId]
        );

        // Notify the creator only when another user joins
        if (String(community.created_by) !== String(userId)) {
            const userResult = await pool.query(
                `
                SELECT name, username
                FROM users
                WHERE id = $1
                `,
                [userId]
            );

            const joiningUser = userResult.rows[0];

            if (joiningUser) {
                const actorName =
                    joiningUser.name ||
                    joiningUser.username ||
                    "A user";

                await createNotification({
                    userId: community.created_by,
                    type: "community_join",
                    title: "New community member",
                    message: `${actorName} joined ${community.name}`,
                    relatedId: community.id
                });
            }
        }

        return res.json({
            success: true,
            message: "Joined community successfully"
        });

    } catch (error) {
        console.error("Join community error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while joining community"
        });
    }
}




// ==============================
// LEAVE COMMUNITY
// ==============================

async function leaveCommunity(req, res) {
    try {

        const communityId = req.params.id;
        const userId = req.user.id;

        const result = await pool.query(
            `
            DELETE FROM community_members
            WHERE community_id = $1
            AND user_id = $2
            RETURNING id
            `,
            [communityId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "You are not a member of this community"
            });
        }

        res.json({
            success: true,
            message: "Left community successfully"
        });

    } catch (error) {

        console.error("Leave community error:", error);

        res.status(500).json({
            success: false,
            message: "Server error while leaving community"
        });

    }
}

// ==============================
// GET COMMUNITY MEMBERS
// ==============================

async function getCommunityMembers(req, res) {

    try {

        const communityId = req.params.id;

        const result = await pool.query(
            `
            SELECT
                u.id,
                u.name,
                u.username,
                u.avatar_url,
                cm.role,
                cm.joined_at

            FROM community_members cm

            JOIN users u
                ON cm.user_id = u.id

            WHERE cm.community_id = $1

            ORDER BY
                CASE
                    WHEN cm.role = 'admin' THEN 0
                    ELSE 1
                END,
                cm.joined_at ASC
            `,
            [communityId]
        );

        res.json({
            success: true,
            members: result.rows
        });

    } catch (error) {

        console.error(
            "Get community members error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to load community members"
        });

    }

}


 // GET COMMUNITY MEMBERS
async function getCommunityMembers(req, res) {
    try {
        const communityId = req.params.id;

        const community = await pool.query(
            "SELECT id FROM communities WHERE id = $1",
            [communityId]
        );

        if (community.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Community not found"
            });
        }

        const result = await pool.query(
            `SELECT
                u.id,
                u.name,
                u.username,
                u.avatar_url,
                cm.role,
                cm.joined_at
             FROM community_members cm
             JOIN users u ON u.id = cm.user_id
             WHERE cm.community_id = $1
             ORDER BY
                CASE WHEN cm.role = 'admin' THEN 0 ELSE 1 END,
                cm.joined_at ASC`,
            [communityId]
        );

        res.json({
            success: true,
            members: result.rows
        });
    } catch (error) {
        console.error("Get community members error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load community members"
        });
    }
}

module.exports = {
    createCommunity,
    getCommunities,
    getCommunity,
    joinCommunity,
    leaveCommunity,
    getCommunityMembers
};