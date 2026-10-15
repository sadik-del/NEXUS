const express = require("express");

const {
    createCommunity,
    getCommunities,
    getCommunity,
    joinCommunity,
    leaveCommunity,
    getCommunityMembers
} = require("../controllers/communityController");

const {
    authenticateToken
} = require("../middleware/authMiddleware");

const router = express.Router();


// Get all communities
router.get("/", authenticateToken, getCommunities);


// Get single community
router.get("/:id", authenticateToken, getCommunity);


// Create community
router.post("/", authenticateToken, createCommunity);


// Join community
router.post("/:id/join", authenticateToken, joinCommunity);


// Leave community
router.delete("/:id/leave", authenticateToken, leaveCommunity);

router.get(
    "/:id/members",
    authenticateToken,
    getCommunityMembers
);

module.exports = router;

