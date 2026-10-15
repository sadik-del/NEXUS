const express = require("express");

const {
    getNotifications,
    getUnreadCount,
    markNotificationRead,
    markAllNotificationsRead
} = require("../controllers/notificationController");

const {
    authenticateToken
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
    "/",
    authenticateToken,
    getNotifications
);

router.get(
    "/unread-count",
    authenticateToken,
    getUnreadCount
);

router.put(
    "/:id/read",
    authenticateToken,
    markNotificationRead
);

router.put(
    "/read-all",
    authenticateToken,
    markAllNotificationsRead
);

module.exports = router;
