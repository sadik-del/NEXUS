
const express = require("express");

const {
    register,
    login,
    getProfile,
    getPublicProfile,
    updateProfile,
    updateAvatar,
    uploadAvatar
} = require("../controllers/authController");

const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();


// ==============================
// REGISTER
// ==============================

router.post(
    "/register",
    register
);


// ==============================
// LOGIN
// ==============================

router.post(
    "/login",
    login
);


// ==============================
// GET PROFILE
// ==============================

router.get(
    "/users/:userId/profile",
    authenticateToken,
    getPublicProfile
);

router.get(
    "/profile",
    authenticateToken,
    getProfile
);


// ==============================
// UPDATE PROFILE
// ==============================

router.put(
    "/profile",
    authenticateToken,
    updateProfile
);

// ==============================
// UPDATE AVATAR
// ==============================

router.put(
    "/profile/avatar",
    authenticateToken,
    uploadAvatar.single("avatar"),
    updateAvatar
);

module.exports = router;