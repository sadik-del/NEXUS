const express = require("express");

const {
    globalSearch
} = require("../controllers/searchController");

const {
    authenticateToken
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
    "/",
    authenticateToken,
    globalSearch
);

module.exports = router;