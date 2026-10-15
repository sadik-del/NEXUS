const { pool } = require("../db");

// ==========================================
// GLOBAL SEARCH
// ==========================================

async function globalSearch(req, res) {

    try {

        const query = req.query.q?.trim();

        if (!query) {
            return res.json({
                success: true,
                users: [],
                communities: [],
                projects: []
            });
        }

        const searchTerm = `%${query}%`;

        // ======================================
        // SEARCH USERS
        // ======================================

        const usersResult = await pool.query(
            `
            SELECT
                id,
                name,
                username
            FROM users
            WHERE
                name ILIKE $1
                OR username ILIKE $1
            ORDER BY name
            LIMIT 10
            `,
            [searchTerm]
        );

        // ======================================
        // SEARCH COMMUNITIES
        // ======================================

        const communitiesResult = await pool.query(
            `
            SELECT
                c.id,
                c.name,
                c.description,
                c.category
            FROM communities c
            WHERE
                c.name ILIKE $1
                OR c.description ILIKE $1
                OR c.category ILIKE $1
            ORDER BY c.created_at DESC
            LIMIT 10
            `,
            [searchTerm]
        );

        // ======================================
        // SEARCH PROJECTS
        // ======================================

        const projectsResult = await pool.query(
            `
            SELECT
                p.id,
                p.name,
                p.description,
                p.status
            FROM projects p
            WHERE
                p.name ILIKE $1
                OR p.description ILIKE $1
            ORDER BY p.created_at DESC
            LIMIT 10
            `,
            [searchTerm]
        );

        res.json({
            success: true,

            users: usersResult.rows,

            communities:
                communitiesResult.rows,

            projects:
                projectsResult.rows
        });

    } catch (error) {

        console.error(
            "Global search error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to perform search"
        });
    }
}

module.exports = {
    globalSearch
};