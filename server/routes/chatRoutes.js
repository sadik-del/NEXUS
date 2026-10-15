
const express = require("express");

const {
    getProjectConversation,
    searchUsers,
    getDirectConversation,
    getConversations,
    getMessages,
    sendMessage
} = require("../controllers/chatController");

const {
    authenticateToken
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/users", authenticateToken, searchUsers);

// Keep this before the dynamic conversation routes.
router.get("/conversations", authenticateToken, getConversations);

router.get("/project/:projectId", authenticateToken, getProjectConversation);

router.get("/direct/:userId", authenticateToken, getDirectConversation);

router.get("/:conversationId/messages", authenticateToken, getMessages);

router.post("/:conversationId/messages", authenticateToken, sendMessage);

module.exports = router;