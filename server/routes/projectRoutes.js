const express = require("express");
const { pool } = require("../db");

const {
    getProjects,
    getProject,
    createProject,
    joinProject,
    leaveProject,
    deleteProject
} = require("../controllers/projectController");

const {
    authenticateToken
} = require("../middleware/authMiddleware");

const router = express.Router();


// GET ALL PROJECTS

router.get(
    "/",
    authenticateToken,
    getProjects
);


// GET MEMBERS OF A PROJECT
router.get("/:id/members", authenticateToken, async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.user.id;

        // Only project members can view the member list
        const access = await pool.query(
            `SELECT id FROM project_members
             WHERE project_id = $1 AND user_id = $2`,
            [projectId, userId]
        );

        if (access.rows.length === 0) {
            return res.status(403).json({
                success: false,
                message: "You must be a project member"
            });
        }

        const result = await pool.query(
            `SELECT u.id, u.name, u.username
             FROM project_members pm
             JOIN users u ON u.id = pm.user_id
             WHERE pm.project_id = $1
             ORDER BY u.name ASC, u.username ASC`,
            [projectId]
        );

        res.json({
            success: true,
            members: result.rows
        });
    } catch (error) {
        console.error("Get project members error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load project members"
        });
    }
});


// GET SINGLE PROJECT

router.get(
    "/:id",
    authenticateToken,
    getProject
);


// CREATE PROJECT

router.post(
    "/",
    authenticateToken,
    createProject
);


// JOIN PROJECT

router.post(
    "/:id/join",
    authenticateToken,
    joinProject
);


// LEAVE PROJECT

router.delete(
    "/:id/leave",
    authenticateToken,
    leaveProject
);


// DELETE PROJECT

router.delete(
    "/:id",
    authenticateToken,
    deleteProject
);


module.exports = router;