const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const multer = require("multer");
const path = require("path");

// ==============================
// AVATAR UPLOAD CONFIGURATION
// ==============================

const avatarStorage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, "public/uploads/avatars");
    },

    filename: (req, file, cb) => {

        const extension =
            path.extname(file.originalname);

        cb(
            null,
            `avatar_${req.user.id}_${Date.now()}${extension}`
        );
    }

});

const uploadAvatar = multer({

    storage: avatarStorage,

    limits: {
        fileSize: 5 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (
            allowedTypes.includes(
                file.mimetype
            )
        ) {
            cb(null, true);
        } else {
            cb(
                new Error(
                    "Only JPG, PNG and WebP images are allowed"
                )
            );
        }
    }

});

// ==============================
// UPDATE AVATAR
// ==============================

async function updateAvatar(req, res) {

    try {

        const userId = req.user.id;

        if (!req.file) {

            return res.status(400).json({
                success: false,
                message: "Please select an image"
            });

        }

        const avatarUrl =
            `/uploads/avatars/${req.file.filename}`;

        const result = await pool.query(
            `UPDATE users
             SET avatar_url = $1
             WHERE id = $2
             RETURNING
                id,
                name,
                username,
                email,
                bio,
                avatar_url,
                created_at`,
            [
                avatarUrl,
                userId
            ]
        );

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "User not found"
            });

        }

        res.json({
            success: true,
            message: "Profile photo updated successfully",
            user: result.rows[0]
        });

    } catch (error) {

        console.error(
            "Avatar upload error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to upload profile photo"
        });

    }

}

// ==============================
// REGISTER
// ==============================

async function register(req, res) {
    try {
        const { name, username, email, password } = req.body;

        // Check required fields
        if (!name || !username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // Check password length
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        // Check if username or email already exists
        const existingUser = await pool.query(
            `SELECT id FROM users 
             WHERE username = $1 OR email = $2`,
            [username, email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Username or email already exists"
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const result = await pool.query(
            `INSERT INTO users 
            (name, username, email, password_hash)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name, username, email, bio, avatar_url, created_at`,
            [name, username, email, passwordHash]
        );

        const user = result.rows[0];

        // Create JWT
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                email: user.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        res.status(201).json({
            success: true,
            message: "Account created successfully",
            token,
            user
        });

    } catch (error) {
        console.error("Register error:", error);

        res.status(500).json({
            success: false,
            message: "Server error during registration"
        });
    }
}

// ==============================
// LOGIN
// ==============================

async function login(req, res) {
    try {
        const { email, password } = req.body;

        // Check required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        // Find user
        const result = await pool.query(
            `SELECT * FROM users WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const user = result.rows[0];

        // Check password
        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Create JWT
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                email: user.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        // Remove password hash from response
        delete user.password_hash;

        res.json({
            success: true,
            message: "Login successful",
            token,
            user
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            message: "Server error during login"
        });
    }
}


async function getProfile(req, res) {

    try {

        const userId = req.user.id;


        // ==========================================
        // USER PROFILE
        // ==========================================

        const userResult = await pool.query(
            `SELECT
                id,
                name,
                username,
                email,
                bio,
                avatar_url,
                created_at
             FROM users
             WHERE id = $1`,
            [userId]
        );


        if (userResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "User not found"
            });

        }


        // ==========================================
        // POST COUNT
        // ==========================================

        const postsResult = await pool.query(
            `SELECT COUNT(*)::int AS count
             FROM posts
             WHERE user_id = $1`,
            [userId]
        );


        // ==========================================
        // PROJECT COUNT
        // ==========================================

        const projectsResult = await pool.query(
            `SELECT COUNT(DISTINCT project_id)::int AS count
             FROM project_members
             WHERE user_id = $1`,
            [userId]
        );


        // ==========================================
        // COMMUNITY COUNT
        // ==========================================

        const communitiesResult = await pool.query(
            `SELECT COUNT(*)::int AS count
             FROM community_members
             WHERE user_id = $1`,
            [userId]
        );


        // ==========================================
        // RECENT PROJECTS
        // ==========================================

        const projectsListResult = await pool.query(
            `
            SELECT
                p.id,
                p.name,
                p.description,
                p.status,
                p.owner_id,
                p.created_at,

                u.name AS owner_name,
                u.username AS owner_username,

                COUNT(DISTINCT pm_all.id)::INTEGER AS member_count,

                EXISTS (
                    SELECT 1
                    FROM project_members current_member
                    WHERE current_member.project_id = p.id
                    AND current_member.user_id = $1
                ) AS is_member

            FROM projects p

            JOIN users u
                ON p.owner_id = u.id

            LEFT JOIN project_members pm_all
                ON p.id = pm_all.project_id

            WHERE EXISTS (
                SELECT 1
                FROM project_members member_check
                WHERE member_check.project_id = p.id
                AND member_check.user_id = $1
            )

            GROUP BY
                p.id,
                u.id

            ORDER BY p.created_at DESC

            LIMIT 6
            `,
            [userId]
        );

        const activityResult = await pool.query(
            `
            SELECT *
            FROM (
                SELECT
                    'post' AS type,
                    p.id AS related_id,
                    'Created a post' AS title,
                    c.name AS context,
                    p.created_at AS activity_time
                FROM posts p
                JOIN communities c
                    ON p.community_id = c.id
                WHERE p.user_id = $1

                UNION ALL

                SELECT
                    'project_created' AS type,
                    p.id AS related_id,
                    'Created a project' AS title,
                    p.name AS context,
                    p.created_at AS activity_time
                FROM projects p
                WHERE p.owner_id = $1

                UNION ALL

                SELECT
                    'project_joined' AS type,
                    p.id AS related_id,
                    'Joined a project' AS title,
                    p.name AS context,
                    pm.joined_at AS activity_time
                FROM project_members pm
                JOIN projects p
                    ON pm.project_id = p.id
                WHERE pm.user_id = $1
                AND p.owner_id <> $1

                UNION ALL

                SELECT
                    'community_joined' AS type,
                    c.id AS related_id,
                    'Joined a community' AS title,
                    c.name AS context,
                    cm.joined_at AS activity_time
                FROM community_members cm
                JOIN communities c
                    ON cm.community_id = c.id
                WHERE cm.user_id = $1
                AND c.created_by <> $1

                UNION ALL

                SELECT
                    'community_created' AS type,
                    c.id AS related_id,
                    'Created a community' AS title,
                    c.name AS context,
                    c.created_at AS activity_time
                FROM communities c
                WHERE c.created_by = $1

            ) activities

            ORDER BY activity_time DESC
            LIMIT 8
            `,
            [userId]
        );


        // ==========================================
        // RESPONSE
        // ==========================================

        res.json({
            success: true,
            user: userResult.rows[0],

            stats: {
                posts: postsResult.rows[0].count,
                projects: projectsResult.rows[0].count,
                communities: communitiesResult.rows[0].count
            },

            projects: projectsListResult.rows,

            activities: activityResult.rows
        });


    } catch (error) {

        console.error(
            "Get profile error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Server error while loading profile"

        });

    }
}


async function getPublicProfile(req, res) {
    try {
        const requestedUserId = Number(req.params.userId);

        if (!Number.isInteger(requestedUserId) || requestedUserId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID"
            });
        }

        const userResult = await pool.query(
            `SELECT id, name, username, bio, avatar_url, created_at
             FROM users
             WHERE id = $1`,
            [requestedUserId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const [postsResult, projectsResult, communitiesResult] =
            await Promise.all([
                pool.query(
                    `SELECT COUNT(*)::int AS count
                     FROM posts
                     WHERE user_id = $1`,
                    [requestedUserId]
                ),

                pool.query(
                    `SELECT COUNT(DISTINCT pm.project_id)::int AS count
                     FROM project_members pm
                     JOIN projects p ON p.id = pm.project_id
                     WHERE pm.user_id = $1`,
                    [requestedUserId]
                ),

                pool.query(
                    `SELECT COUNT(*)::int AS count
                     FROM community_members
                     WHERE user_id = $1`,
                    [requestedUserId]
                )
            ]);

        res.json({
            success: true,
            user: userResult.rows[0],
            stats: {
                posts: postsResult.rows[0].count,
                projects: projectsResult.rows[0].count,
                communities: communitiesResult.rows[0].count
            }
        });
    } catch (error) {
        console.error("Get public profile error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load profile"
        });
    }
}

// ==============================
// UPDATE PROFILE
// ==============================

async function updateProfile(req, res) {
    try {
        const userId = req.user.id;

        const { name, bio } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Name is required"
            });
        }

        const result = await pool.query(
            `UPDATE users
             SET name = $1,
                 bio = $2
             WHERE id = $3
             RETURNING
                id,
                name,
                username,
                email,
                bio,
                avatar_url,
                created_at`,
            [
                name.trim(),
                bio ? bio.trim() : "",
                userId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            message: "Profile updated successfully",
            user: result.rows[0]
        });

    } catch (error) {

        console.error(
            "Update profile error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error while updating profile"
        });
    }
}


module.exports = {
    register,
    login,
    getProfile,
    getPublicProfile,
    updateProfile,
    updateAvatar,
    uploadAvatar
};