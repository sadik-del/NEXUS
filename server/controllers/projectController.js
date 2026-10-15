const { pool } = require("../db");

const {
    createNotification
} = require("./notificationService");


// ==============================
// GET ALL PROJECTS
// ==============================

async function getProjects(req, res) {

    try {

        const userId = req.user.id;

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


                res.json({
                    success: true,
                    projects: projectsListResult.rows
                });


            } catch (error) {

                console.error(
                    "Get projects error:",
                    error
                );

                res.status(500).json({
                    success: false,
                    message: "Unable to load projects"
                });

            }

        }


// ==============================
// GET SINGLE PROJECT
// ==============================

async function getProject(req, res) {

    try {

        const projectId = req.params.id;

        const result = await pool.query(
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

                COUNT(DISTINCT pm.id)::INTEGER AS member_count

            FROM projects p

            JOIN users u
                ON p.owner_id = u.id

            LEFT JOIN project_members pm
                ON p.id = pm.project_id

            WHERE p.id = $1

            GROUP BY
                p.id,
                u.id
            `,
            [projectId]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Project not found"
            });

        }


        res.json({
            success: true,
            project: result.rows[0]
        });


    } catch (error) {

        console.error(
            "Get project error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to load project"
        });

    }

}


// ==============================
// CREATE PROJECT
// ==============================

async function createProject(req, res) {

    try {

        const userId = req.user.id;

        const {
            name,
            description,
            status
        } = req.body;


        if (!name || !name.trim()) {

            return res.status(400).json({
                success: false,
                message: "Project name is required"
            });

        }


        const result = await pool.query(
            `
            INSERT INTO projects
            (
                name,
                description,
                status,
                owner_id
            )

            VALUES ($1, $2, $3, $4)

            RETURNING *
            `,
            [
                name.trim(),
                description || "",
                status || "active",
                userId
            ]
        );


        const project = result.rows[0];


        // Automatically make creator the project owner

        await pool.query(
            `
            INSERT INTO project_members
            (
                project_id,
                user_id,
                role
            )

            VALUES ($1, $2, 'owner')
            `,
            [
                project.id,
                userId
            ]
        );


        res.status(201).json({

            success: true,

            message: "Project created successfully",

            project

        });


    } catch (error) {

        console.error(
            "Create project error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to create project"
        });

    }

}


// ==============================
// JOIN PROJECT
// ==============================

async function joinProject(req, res) {

    try {

        const userId = req.user.id;

        const projectId = req.params.id;


        // ==============================
        // GET PROJECT
        // ==============================

        const project = await pool.query(
            `
            SELECT
                id,
                name,
                owner_id
            FROM projects
            WHERE id = $1
            `,
            [projectId]
        );


        if (project.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Project not found"
            });

        }


        const projectData = project.rows[0];


        // ==============================
        // CHECK EXISTING MEMBER
        // ==============================

        const existingMember = await pool.query(
            `
            SELECT id
            FROM project_members
            WHERE project_id = $1
            AND user_id = $2
            `,
            [
                projectId,
                userId
            ]
        );


        if (existingMember.rows.length > 0) {

            return res.status(409).json({
                success: false,
                message: "You are already a project member"
            });

        }


        // ==============================
        // ADD MEMBER
        // ==============================

        await pool.query(
            `
            INSERT INTO project_members
            (
                project_id,
                user_id,
                role
            )

            VALUES ($1, $2, 'member')
            `,
            [
                projectId,
                userId
            ]
        );


        // ==============================
        // GET JOINING USER
        // ==============================

        const userResult = await pool.query(
            `
            SELECT
                name,
                username
            FROM users
            WHERE id = $1
            `,
            [userId]
        );


        const joiningUser =
            userResult.rows[0];


        const joiningUserName =
            joiningUser?.name ||
            joiningUser?.username ||
            "Someone";


        // ==============================
        // NOTIFY PROJECT OWNER
        // ==============================

        if (
            projectData.owner_id !== userId
        ) {

            await createNotification({

                userId:
                    projectData.owner_id,

                type:
                    "project",

                title:
                    "New project member",

                message:
                    `${joiningUserName} joined your project "${projectData.name}".`,

                relatedId:
                    projectData.id

            });

        }


        // ==============================
        // RESPONSE
        // ==============================

        res.json({

            success: true,

            message:
                "Joined project successfully"

        });


    } catch (error) {

        console.error(
            "Join project error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Unable to join project"

        });

    }

}


// ==============================
// LEAVE PROJECT
// ==============================

async function leaveProject(req, res) {

    try {

        const userId = req.user.id;

        const projectId = req.params.id;


        const result = await pool.query(
            `
            DELETE FROM project_members

            WHERE project_id = $1
            AND user_id = $2

            RETURNING id
            `,
            [
                projectId,
                userId
            ]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "You are not a member of this project"
            });

        }


        res.json({

            success: true,

            message: "Left project successfully"

        });


    } catch (error) {

        console.error(
            "Leave project error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to leave project"
        });

    }

}


// ==============================
// DELETE PROJECT
// ==============================

async function deleteProject(req, res) {

    try {

        const userId = req.user.id;

        const projectId = req.params.id;


        const result = await pool.query(
            `
            DELETE FROM projects

            WHERE id = $1
            AND owner_id = $2

            RETURNING id
            `,
            [
                projectId,
                userId
            ]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message:
                    "Project not found or you are not the owner"
            });

        }


        res.json({

            success: true,

            message: "Project deleted successfully"

        });


    } catch (error) {

        console.error(
            "Delete project error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to delete project"
        });

    }

}


// ==============================
// EXPORT
// ==============================

module.exports = {

    getProjects,

    getProject,

    createProject,

    joinProject,

    leaveProject,

    deleteProject

};