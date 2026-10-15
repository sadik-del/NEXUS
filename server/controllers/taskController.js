const { pool } = require("../db");
const { createNotification } = require("./notificationService");

// GET ALL TASKS FOR A PROJECT
async function getTasks(req, res) {
    try {
        const projectId = req.params.projectId;

        const result = await pool.query(
            `
            SELECT
                t.id,
                t.project_id,
                t.title,
                t.description,
                t.status,
                t.priority,
                t.assigned_to,
                t.created_by,
                t.created_at,
                t.updated_at,
                creator.name AS creator_name,
                assignee.name AS assignee_name,
                assignee.username AS assignee_username
            FROM project_tasks t
            JOIN users creator
                ON t.created_by = creator.id
            LEFT JOIN users assignee
                ON t.assigned_to = assignee.id
            WHERE t.project_id = $1
            ORDER BY t.created_at DESC
            `,
            [projectId]
        );

        res.json({
            success: true,
            tasks: result.rows
        });

    } catch (error) {
        console.error("Get tasks error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load tasks"
        });
    }
}


// CREATE TASK
async function createTask(req, res) {
    try {
        const userId = req.user.id;
        const projectId = req.params.projectId;

        const {
            title,
            description,
            status,
            priority,
            assigned_to
        } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({
                success: false,
                message: "Task title is required"
            });
        }

        // Check project exists
        const project = await pool.query(
            `
            SELECT id
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

        // Check creator is a project member
        const membership = await pool.query(
            `
            SELECT id
            FROM project_members
            WHERE project_id = $1
            AND user_id = $2
            `,
            [projectId, userId]
        );

        if (membership.rows.length === 0) {
            return res.status(403).json({
                success: false,
                message: "You must be a project member"
            });
        }

        if (assigned_to) {
            const assigneeMembership = await pool.query(
                `
                SELECT id
                FROM project_members
                WHERE project_id = $1
                AND user_id = $2
                `,
                [projectId, assigned_to]
            );

            if (assigneeMembership.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "The assigned user must be a project member"
                });
            }
        }

        const result = await pool.query(
            `
            INSERT INTO project_tasks
            (
                project_id,
                title,
                description,
                status,
                priority,
                assigned_to,
                created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            `,
            [
                projectId,
                title.trim(),
                description || "",
                status || "todo",
                priority || "medium",
                assigned_to || null,
                userId
            ]
        );

        // Send notifications without affecting task creation
        try {
            const projectDetails = await pool.query(
                `
                SELECT
                    p.owner_id,
                    p.name AS project_name,
                    u.name AS creator_name,
                    u.username AS creator_username
                FROM projects p
                JOIN users u ON u.id = $2
                WHERE p.id = $1
                `,
                [projectId, userId]
            );

            const details = projectDetails.rows[0];
            const task = result.rows[0];

            if (details && String(details.owner_id) !== String(userId)) {
                await createNotification({
                    userId: details.owner_id,
                    type: "task",
                    title: "New task created",
                    message: `${details.creator_name || details.creator_username || "A member"} created task "${task.title}" in project "${details.project_name}".`,
                    relatedId: task.id
                });
            }

            if (assigned_to && String(assigned_to) !== String(userId)) {
                await createNotification({
                    userId: assigned_to,
                    type: "task",
                    title: "Task assigned to you",
                    message: `You have been assigned the task "${task.title}".`,
                    relatedId: task.id
                });
            }
        } catch (notificationError) {
            console.error(
                "Task notification error:",
                notificationError.message
            );
        }

        res.status(201).json({
            success: true,
            message: "Task created successfully",
            task: result.rows[0]
        });

    } catch (error) {
        console.error("Create task error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to create task"
        });
    }
}


// UPDATE TASK
async function updateTask(req, res) {
    try {
        const userId = req.user.id;
        const taskId = req.params.taskId;

        const {
            title,
            description,
            status,
            priority,
            assigned_to
        } = req.body;

        const taskCheck = await pool.query(
            `
            SELECT
                t.id,
                t.project_id,
                t.title,
                t.status AS previous_status,
                t.created_by,
                t.assigned_to,
                p.name AS project_name
            FROM project_tasks t
            JOIN project_members pm
                ON t.project_id = pm.project_id
            JOIN projects p
                ON p.id = t.project_id
            WHERE t.id = $1
            AND pm.user_id = $2
            `,
            [taskId, userId]
        );

        if (taskCheck.rows.length === 0) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this task"
            });
        }

        const oldTask = taskCheck.rows[0];

        const result = await pool.query(
            `
            UPDATE project_tasks
            SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                status = COALESCE($3, status),
                priority = COALESCE($4, priority),
                assigned_to = $5,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $6
            RETURNING *
            `,
            [
                title !== undefined ? title.trim() : null,
                description !== undefined ? description : null,
                status !== undefined ? status : null,
                priority !== undefined ? priority : null,
                assigned_to || null,
                taskId
            ]
        );

        const updatedTask = result.rows[0];

        const completedStatuses = ["done", "completed", "complete"];

        const wasCompleted = completedStatuses.includes(
            String(oldTask.previous_status).toLowerCase()
        );

        const isCompleted = completedStatuses.includes(
            String(updatedTask.status).toLowerCase()
        );

        // Notify only when the task changes from incomplete to complete
        if (!wasCompleted && isCompleted) {
            const recipientIds = new Set([
                String(oldTask.created_by),
                ...(oldTask.assigned_to
                    ? [String(oldTask.assigned_to)]
                    : [])
            ]);

            recipientIds.delete(String(userId));

            for (const recipientId of recipientIds) {
                await createNotification({
                    userId: recipientId,
                    type: "task",
                    title: "Task completed",
                    message: `Task "${updatedTask.title}" in project "${oldTask.project_name}" has been completed.`,
                    relatedId: updatedTask.id
                });
            }
        }

        res.json({
            success: true,
            message: "Task updated successfully",
            task: result.rows[0]
        });

    } catch (error) {
        console.error("Update task error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update task"
        });
    }
}


// DELETE TASK
async function deleteTask(req, res) {
    try {
        const userId = req.user.id;
        const taskId = req.params.taskId;

        const result = await pool.query(
            `
            DELETE FROM project_tasks
            WHERE id = $1
            AND (
                created_by = $2
                OR project_id IN (
                    SELECT project_id
                    FROM projects
                    WHERE owner_id = $2
                )
            )
            RETURNING id
            `,
            [taskId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({
                success: false,
                message: "You cannot delete this task"
            });
        }

        res.json({
            success: true,
            message: "Task deleted successfully"
        });

    } catch (error) {
        console.error("Delete task error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to delete task"
        });
    }
}


module.exports = {
    getTasks,
    createTask,
    updateTask,
    deleteTask
};