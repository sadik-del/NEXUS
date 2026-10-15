const express = require("express");

const {
    getTasks,
    createTask,
    updateTask,
    deleteTask
} = require("../controllers/taskController");

const {
    authenticateToken
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
    "/:projectId",
    authenticateToken,
    getTasks
);

router.post(
    "/:projectId",
    authenticateToken,
    createTask
);

router.put(
    "/:taskId",
    authenticateToken,
    updateTask
);

router.delete(
    "/:taskId",
    authenticateToken,
    deleteTask
);

module.exports = router;