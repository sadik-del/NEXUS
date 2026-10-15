const express = require("express");

const {
    getPosts,
    createPost,
    toggleLike,
    addComment,
    getComments,
    deletePost
} = require("../controllers/postController");
const {
    authenticateToken
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
    "/:id/comments",
    authenticateToken,
    getComments
);

router.get(
    "/",
    authenticateToken,
    getPosts
);


router.post(
    "/",
    authenticateToken,
    createPost
);


router.post(
    "/:id/like",
    authenticateToken,
    toggleLike
);


router.post(
    "/:id/comments",
    authenticateToken,
    addComment
);


router.delete(
    "/:id",
    authenticateToken,
    deletePost
);


module.exports = router;