const { createNotification } = require("./notificationService");
const { pool } = require("../db");


// ==============================
// GET POSTS
// ==============================


async function getPosts(req, res) {
    try {
        const userId = req.user.id;
        const communityId = req.query.communityId
            ? Number(req.query.communityId)
            : null;

        if (
            communityId !== null &&
            (!Number.isInteger(communityId) || communityId <= 0)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid community ID"
            });
        }

        let query;
        let params;

        if (communityId !== null) {
            query = `
                SELECT
                    p.id,
                    p.content,
                    p.created_at,
                    u.id AS user_id,
                    u.name AS author_name,
                    u.username AS author_username,
                    u.avatar_url,
                    c.id AS community_id,
                    c.name AS community_name,
                    c.icon AS community_icon,
                    COUNT(DISTINCT pl.id)::INTEGER AS like_count,
                    COUNT(DISTINCT co.id)::INTEGER AS comment_count,
                    EXISTS (
                        SELECT 1
                        FROM post_likes current_like
                        WHERE current_like.post_id = p.id
                          AND current_like.user_id = $1
                    ) AS liked
                FROM posts p
                JOIN users u ON p.user_id = u.id
                JOIN communities c ON p.community_id = c.id
                LEFT JOIN post_likes pl ON p.id = pl.post_id
                LEFT JOIN comments co ON p.id = co.post_id
                WHERE p.community_id = $2
                GROUP BY p.id, u.id, c.id
                ORDER BY p.created_at DESC
            `;
            params = [userId, communityId];
        } else {
            query = `
                SELECT
                    p.id,
                    p.content,
                    p.created_at,
                    u.id AS user_id,
                    u.name AS author_name,
                    u.username AS author_username,
                    u.avatar_url,
                    c.id AS community_id,
                    c.name AS community_name,
                    c.icon AS community_icon,
                    COUNT(DISTINCT pl.id)::INTEGER AS like_count,
                    COUNT(DISTINCT co.id)::INTEGER AS comment_count,
                    EXISTS (
                        SELECT 1
                        FROM post_likes current_like
                        WHERE current_like.post_id = p.id
                          AND current_like.user_id = $1
                    ) AS liked
                FROM posts p
                JOIN users u ON p.user_id = u.id
                JOIN communities c ON p.community_id = c.id
                LEFT JOIN post_likes pl ON p.id = pl.post_id
                LEFT JOIN comments co ON p.id = co.post_id
                GROUP BY p.id, u.id, c.id
                ORDER BY p.created_at DESC
            `;
            params = [userId];
        }

        const result = await pool.query(query, params);

        return res.json({
            success: true,
            posts: result.rows
        });
    } catch (error) {
        console.error("Get posts error:", error.stack || error);

        return res.status(500).json({
            success: false,
            message: error.message || "Unable to load posts"
        });
    }
}


// ==============================
// CREATE POST
// ==============================

async function createPost(req, res) {

    try {

        const userId = req.user.id;

        const {
            content,
            communityId
        } = req.body;


        if (!content || !content.trim()) {

            return res.status(400).json({
                success: false,
                message: "Post content is required"
            });

        }


        if (!communityId) {

            return res.status(400).json({
                success: false,
                message: "Please select a community"
            });

        }


        // Check membership

        const membership =
            await pool.query(
                `
                SELECT id
                FROM community_members
                WHERE community_id = $1
                AND user_id = $2
                `,
                [communityId, userId]
            );


        if (membership.rows.length === 0) {

            return res.status(403).json({
                success: false,
                message:
                    "You must join the community before posting"
            });

        }


        const result =
            await pool.query(
                `
                INSERT INTO posts
                (user_id, community_id, content)

                VALUES ($1, $2, $3)

                RETURNING *
                `,
                [
                    userId,
                    communityId,
                    content.trim()
                ]
            );


        res.status(201).json({

            success: true,

            message: "Post created successfully",

            post: result.rows[0]

        });


    } catch (error) {

        console.error(
            "Create post error:",
            error
        );


        res.status(500).json({
            success: false,
            message: "Unable to create post"
        });

    }

}


// ==============================
// LIKE / UNLIKE POST
// ==============================


async function toggleLike(req, res) {
    try {
        const userId = req.user.id;
        const postId = req.params.id;

        const existingLike = await pool.query(
            `SELECT id
             FROM post_likes
             WHERE post_id = $1 AND user_id = $2`,
            [postId, userId]
        );

        // Unlike: remove the existing like, without a notification
        if (existingLike.rows.length > 0) {
            await pool.query(
                `DELETE FROM post_likes
                 WHERE post_id = $1 AND user_id = $2`,
                [postId, userId]
            );

            return res.json({
                success: true,
                liked: false,
                message: "Post unliked"
            });
        }

        // Like the post
        const result = await pool.query(
            `INSERT INTO post_likes (post_id, user_id)
             VALUES ($1, $2)
             RETURNING id`,
            [postId, userId]
        );

        // Find the post owner and the person who liked it
        const details = await pool.query(
            `SELECT
                p.user_id AS post_owner_id,
                u.name AS actor_name
             FROM posts p
             JOIN users u ON u.id = $2
             WHERE p.id = $1`,
            [postId, userId]
        );

        if (details.rows.length > 0) {
            const post = details.rows[0];

            if (String(post.post_owner_id) !== String(userId)) {
                await createNotification({
                    userId: post.post_owner_id,
                    type: "like",
                    title: "Someone liked your post",
                    message: `${post.actor_name || "Someone"} liked your post.`,
                    relatedId: postId
                });
            }
        }

        return res.json({
            success: true,
            liked: true,
            message: "Post liked"
        });

    } catch (error) {
        console.error("Like post error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update like"
        });
    }
}


// ==============================
// ADD COMMENT
// ==============================


async function addComment(req, res) {
    try {
        const userId = req.user.id;
        const postId = req.params.id;
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({
                success: false,
                message: "Comment cannot be empty"
            });
        }

        // Find the post owner and commenter's name
        const details = await pool.query(
            `SELECT
                p.user_id AS post_owner_id,
                u.name AS actor_name
             FROM posts p
             JOIN users u ON u.id = $2
             WHERE p.id = $1`,
            [postId, userId]
        );

        if (details.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Post not found"
            });
        }

        // Save the comment
        const result = await pool.query(
            `INSERT INTO comments (post_id, user_id, content)
             VALUES ($1, $2, $3)
             RETURNING id, content, created_at`,
            [postId, userId, content.trim()]
        );

        const post = details.rows[0];

        // Notify the post author, but never notify the commenter
        // about their own comment.
        if (String(post.post_owner_id) !== String(userId)) {
            const preview = content.trim();

            await createNotification({
                userId: post.post_owner_id,
                type: "comment",
                title: "New comment on your post",
                message: `${post.actor_name || "Someone"} commented: ${
                    preview.length > 100
                        ? preview.slice(0, 100) + "…"
                        : preview
                }`,
                relatedId: postId
            });
        }

        return res.status(201).json({
            success: true,
            message: "Comment added",
            comment: result.rows[0]
        });

    } catch (error) {
        console.error("Add comment error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to add comment"
        });
    }
}


// ==============================
// DELETE POST
// ==============================

async function deletePost(req, res) {

    try {

        const userId = req.user.id;

        const postId = req.params.id;


        const result =
            await pool.query(
                `
                DELETE FROM posts

                WHERE id = $1
                AND user_id = $2

                RETURNING id
                `,
                [postId, userId]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message:
                    "Post not found or you are not the author"
            });

        }


        res.json({
            success: true,
            message: "Post deleted"
        });


    } catch (error) {

        console.error(
            "Delete post error:",
            error
        );


        res.status(500).json({
            success: false,
            message: "Unable to delete post"
        });

    }

}

async function loadCommunityDetail(communityId) {

    const token =
        localStorage.getItem("nexusToken");

    const detailView =
        document.getElementById(
            "communityDetailView"
        );

    const container =
        document.getElementById(
            "communitiesContainer"
        );

    if (!detailView) return;

    if (container) {
        container.style.display = "none";
    }

    const heading =
        document.querySelector(
            ".communities-heading"
        );

    if (heading) {
        heading.style.display = "none";
    }

    try {

        detailView.classList.add("active");

        detailView.innerHTML = `
            <div class="community-detail-empty">
                Loading community...
            </div>
        `;

        const response =
            await fetch(
                `/api/communities/${communityId}`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to load community"
            );
        }

        const community =
            data.community;

        await renderFullCommunityDetail(
            community
        );

    } catch (error) {

        console.error(
            "Community detail loading error:",
            error
        );

        detailView.innerHTML = `
            <div class="community-detail-empty">

                <h3>
                    Unable to load community
                </h3>

                <p>
                    ${escapeHTML(error.message)}
                </p>

                <br>

                <button
                    class="community-back-btn"
                    onclick="window.location.href='/communities.html'"
                >
                    ← Back to Communities
                </button>

            </div>
        `;
    }
}

async function renderFullCommunityDetail(community) {

    const token =
        localStorage.getItem("nexusToken");

    const detailView =
        document.getElementById(
            "communityDetailView"
        );

    const communityId =
        community.id;

    const icon =
        community.icon || "◎";

    const memberCount =
        community.member_count || 0;

    const memberText =
        memberCount === 1
            ? "1 member"
            : `${memberCount} members`;

    detailView.innerHTML = `

        <!-- COMMUNITY HEADER -->

        <div class="community-detail-header">

            <div class="community-detail-top">

                <div class="community-detail-info">

                    <div class="community-detail-icon">
                        ${escapeHTML(icon)}
                    </div>

                    <div class="community-detail-title">

                        <h1>
                            ${escapeHTML(
                                community.name
                            )}
                        </h1>

                        <p>
                            ${escapeHTML(
                                community.category ||
                                "General"
                            )}
                        </p>

                    </div>

                </div>

                <div class="community-detail-actions">

                    <button
                        class="community-back-btn"
                        id="communityBackBtn"
                    >
                        ← Back
                    </button>

                    <button
                        class="community-join-btn ${
                            community.is_member
                                ? "joined"
                                : ""
                        }"
                        id="communityDetailJoinBtn"
                        data-community-id="${communityId}"
                        data-is-member="${community.is_member}"
                    >
                        ${
                            community.is_member
                                ? "Joined ✓"
                                : "Join Community"
                        }
                    </button>

                </div>

            </div>

            <div class="community-detail-description">

                ${
                    escapeHTML(
                        community.description ||
                        "No description provided."
                    )
                }

            </div>

            <div class="community-detail-meta">

                <span>
                    👥 ${memberText}
                </span>

                <span>
                    @${escapeHTML(
                        community.creator || "unknown"
                    )}
                </span>

            </div>

        </div>


        <!-- COMMUNITY CONTENT -->

        <div class="community-detail-grid">


            <!-- FEED -->

            <div class="community-detail-panel">

                <div class="community-feed-header">

                    <div>
                        <h2>
                            Community Feed
                        </h2>

                        <p>
                            Discussions and updates
                            from the community.
                        </p>
                    </div>

                    <button
                        class="community-back-btn"
                        id="refreshCommunityFeed"
                    >
                        ↻ Refresh
                    </button>

                </div>


                ${
                    community.is_member
                        ? `
                        <div class="community-create-post">

                            <textarea
                                id="communityPostContent"
                                placeholder="Share something with the community..."
                                rows="3"
                            ></textarea>

                            <div class="community-post-actions">

                                <span>
                                    Post to
                                    <strong>
                                        ${escapeHTML(
                                            community.name
                                        )}
                                    </strong>
                                </span>

                                <button
                                    class="community-join-btn"
                                    id="createCommunityPost"
                                >
                                    Publish
                                </button>

                            </div>

                        </div>
                        `
                        : `
                        <div class="community-detail-empty">

                            Join this community to
                            participate in discussions.

                        </div>
                        `
                }


                <div
                    id="communityPosts"
                    class="community-posts"
                >

                    <div class="community-detail-empty">
                        Loading posts...
                    </div>

                </div>

            </div>


            <!-- MEMBERS -->

            <div class="community-detail-panel">

                <div class="community-feed-header">

                    <div>

                        <h2>
                            Members
                        </h2>

                        <p>
                            ${memberText}
                        </p>

                    </div>

                </div>


                <div
                    id="communityMembers"
                    class="community-members"
                >

                    <div class="community-detail-empty">
                        Loading members...
                    </div>

                </div>

            </div>

        </div>
    `;


    // ==============================
    // BACK BUTTON
    // ==============================

    document
        .getElementById("communityBackBtn")
        ?.addEventListener(
            "click",
            () => {
                window.location.href =
                    "/communities.html";
            }
        );


    // ==============================
    // JOIN / LEAVE
    // ==============================

    setupCommunityDetailButton();


    // ==============================
    // CREATE POST
    // ==============================

    const createPostButton =
        document.getElementById(
            "createCommunityPost"
        );

    if (createPostButton) {

        createPostButton.addEventListener(
            "click",
            async () => {

                const textarea =
                    document.getElementById(
                        "communityPostContent"
                    );

                const content =
                    textarea.value.trim();

                if (!content) {
                    alert(
                        "Write something before publishing."
                    );
                    return;
                }

                createPostButton.disabled = true;
                createPostButton.textContent =
                    "Publishing...";

                try {

                    const response =
                        await fetch(
                            "/api/posts",
                            {
                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json",

                                    Authorization:
                                        `Bearer ${token}`
                                },

                                body: JSON.stringify({
                                    content,
                                    communityId
                                })
                            }
                        );

                    const data =
                        await response.json();

                    if (!response.ok) {
                        throw new Error(
                            data.message ||
                            "Unable to create post"
                        );
                    }

                    textarea.value = "";

                    await loadCommunityPosts(
                        communityId
                    );

                } catch (error) {

                    alert(error.message);

                } finally {

                    createPostButton.disabled =
                        false;

                    createPostButton.textContent =
                        "Publish";
                }
            }
        );
    }


    // ==============================
    // REFRESH FEED
    // ==============================

    document
        .getElementById(
            "refreshCommunityFeed"
        )
        ?.addEventListener(
            "click",
            () => {
                loadCommunityPosts(
                    communityId
                );
            }
        );


    // ==============================
    // LOAD DATA
    // ==============================

    await Promise.all([
        loadCommunityPosts(communityId),
        loadCommunityMembers(communityId)
    ]);
}

async function loadCommunityPosts(communityId) {

    const token =
        localStorage.getItem("nexusToken");

    const container =
        document.getElementById(
            "communityPosts"
        );

    if (!container) return;

    try {

        container.innerHTML = `
            <div class="community-detail-empty">
                Loading posts...
            </div>
        `;

        const response =
            await fetch(
                `/api/posts?communityId=${communityId}`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to load posts"
            );
        }

        const posts =
            data.posts || [];

        if (posts.length === 0) {

            container.innerHTML = `
                <div class="community-detail-empty">

                    <div style="font-size:28px;">
                        💬
                    </div>

                    <h3>
                        No posts yet
                    </h3>

                    <p>
                        Be the first person to
                        start a discussion.
                    </p>

                </div>
            `;

            return;
        }

        container.innerHTML =
            posts.map(
                post =>
                    renderCommunityPost(post)
            ).join("");


        setupCommunityPostActions();

    } catch (error) {

        console.error(
            "Community posts error:",
            error
        );

        container.innerHTML = `
            <div class="community-detail-empty">
                Unable to load posts.
            </div>
        `;
    }
}

function renderCommunityPost(post) {

    const initial =
        (post.author_name || "U")
            .charAt(0)
            .toUpperCase();

    const date =
        new Date(
            post.created_at
        ).toLocaleString(
            "en-IN",
            {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit"
            }
        );

    return `
        <article
            class="community-post"
            data-post-id="${post.id}"
        >

            <div class="community-post-header">

                <div class="community-post-author">

                    ${
                        post.avatar_url
                            ? `
                            <img
                                src="${escapeHTML(
                                    post.avatar_url
                                )}"
                                class="community-post-avatar"
                                alt=""
                            >
                            `
                            : `
                            <div
                                class="community-post-avatar"
                            >
                                ${initial}
                            </div>
                            `
                    }

                    <div>

                        <div class="community-post-name">
                            ${escapeHTML(
                                post.author_name
                            )}
                        </div>

                        <div class="community-post-username">
                            @${escapeHTML(
                                post.author_username
                            )}
                            · ${date}
                        </div>

                    </div>

                </div>

            </div>


            <div class="community-post-content">

                ${escapeHTML(
                    post.content
                )}

            </div>


            <div class="community-post-footer">

                <button
                    class="post-action like-post ${
                        post.liked
                            ? "liked"
                            : ""
                    }"
                    data-post-id="${post.id}"
                >
                    ❤️
                    <span>
                        ${post.like_count || 0}
                    </span>
                </button>

                <button
                    class="post-action comment-post"
                    data-post-id="${post.id}"
                >
                    💬
                    <span>
                        ${post.comment_count || 0}
                    </span>
                </button>

                ${
                    post.user_id ==
                    getCurrentUserId()
                        ? `
                        <button
                            class="post-action delete-post"
                            data-post-id="${post.id}"
                        >
                            🗑️
                        </button>
                        `
                        : ""
                }

            </div>


            <div
                class="community-comments"
                id="comments-${post.id}"
                style="display:none;"
            >

                <div class="comments-list"></div>

                <div class="comment-input-row">

                    <input
                        type="text"
                        class="comment-input"
                        placeholder="Write a comment..."
                    >

                    <button
                        class="community-join-btn add-comment"
                        data-post-id="${post.id}"
                    >
                        Send
                    </button>

                </div>

            </div>

        </article>
    `;
}

function setupCommunityPostActions() {

    document
        .querySelectorAll(".like-post")
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    const postId =
                        button.dataset.postId;

                    const token =
                        localStorage.getItem(
                            "nexusToken"
                        );

                    try {

                        const response =
                            await fetch(
                                `/api/posts/${postId}/like`,
                                {
                                    method: "POST",
                                    headers: {
                                        Authorization:
                                            `Bearer ${token}`
                                    }
                                }
                            );

                        if (!response.ok) {
                            throw new Error(
                                "Unable to update like"
                            );
                        }

                        const communityId =
                            new URLSearchParams(
                                window.location.search
                            ).get("communityId");

                        loadCommunityPosts(
                            communityId
                        );

                    } catch (error) {

                        console.error(
                            error
                        );

                    }
                }
            );
        });


    document
        .querySelectorAll(".comment-post")
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    const postId =
                        button.dataset.postId;

                    const box =
                        document.getElementById(
                            `comments-${postId}`
                        );

                    if (!box) return;

                    if (
                        box.style.display ===
                        "none"
                    ) {

                        box.style.display =
                            "block";

                        await loadComments(
                            postId,
                            box
                        );

                    } else {

                        box.style.display =
                            "none";
                    }
                }
            );
        });


    document
        .querySelectorAll(".delete-post")
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    const postId =
                        button.dataset.postId;

                    if (
                        !confirm(
                            "Delete this post?"
                        )
                    ) {
                        return;
                    }

                    const token =
                        localStorage.getItem(
                            "nexusToken"
                        );

                    const response =
                        await fetch(
                            `/api/posts/${postId}`,
                            {
                                method: "DELETE",
                                headers: {
                                    Authorization:
                                        `Bearer ${token}`
                                }
                            }
                        );

                    if (response.ok) {

                        const communityId =
                            new URLSearchParams(
                                window.location.search
                            ).get(
                                "communityId"
                            );

                        loadCommunityPosts(
                            communityId
                        );
                    }
                }
            );
        });


    document
        .querySelectorAll(".add-comment")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => addCommunityComment(
                    button
                )
            );
        });
}

async function loadCommunityMembers(
    communityId
) {

    const token =
        localStorage.getItem(
            "nexusToken"
        );

    const container =
        document.getElementById(
            "communityMembers"
        );

    if (!container) return;

    try {

        const response =
            await fetch(
                `/api/communities/${communityId}/members`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to load members"
            );
        }

        const members =
            data.members || [];

        if (members.length === 0) {

            container.innerHTML = `
                <div class="community-detail-empty">
                    No members found.
                </div>
            `;

            return;
        }

        container.innerHTML =
            members.map(
                member => {

                    const initial =
                        (
                            member.name ||
                            member.username ||
                            "U"
                        )
                            .charAt(0)
                            .toUpperCase();

                    return `
                        <div
                            class="community-member-info"
                            style="cursor:pointer;"
                            data-user-id="${member.id}"
                        >

                            ${
                                member.avatar_url
                                    ? `
                                    <img
                                        src="${escapeHTML(
                                            member.avatar_url
                                        )}"
                                        class="community-member-avatar"
                                        alt=""
                                        style="object-fit:cover;"
                                    >
                                    `
                                    : `
                                    <div
                                        class="community-member-avatar"
                                    >
                                        ${initial}
                                    </div>
                                    `
                            }

                            <div>

                                <div
                                    class="community-member-name"
                                >
                                    ${escapeHTML(
                                        member.name ||
                                        member.username
                                    )}

                                    ${
                                        member.role ===
                                        "admin"
                                            ? `
                                            <span
                                                style="
                                                    margin-left:6px;
                                                    color:#60a5fa;
                                                    font-size:10px;
                                                "
                                            >
                                                ADMIN
                                            </span>
                                            `
                                            : ""
                                    }

                                </div>

                                <div
                                    class="community-member-role"
                                >
                                    @${escapeHTML(
                                        member.username
                                    )}
                                </div>

                            </div>

                        </div>
                    `;
                }
            ).join("");


        container
            .querySelectorAll(
                ".community-member-info"
            )
            .forEach(member => {

                member.addEventListener(
                    "click",
                    () => {

                        const userId =
                            member.dataset.userId;

                        window.location.href =
                            `/profile.html?userId=${userId}`;
                    }
                );
            });

    } catch (error) {

        console.error(
            "Community members error:",
            error
        );

        container.innerHTML = `
            <div class="community-detail-empty">
                Unable to load members.
            </div>
        `;
    }
}


async function getComments(req, res) {
    try {
        const postId = req.params.id;

        const post = await pool.query(
            "SELECT id FROM posts WHERE id = $1",
            [postId]
        );

        if (post.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Post not found"
            });
        }

        const result = await pool.query(
            `SELECT
                co.id,
                co.content,
                co.created_at,
                u.id AS user_id,
                u.name AS author_name,
                u.username AS author_username,
                u.avatar_url
             FROM comments co
             JOIN users u ON u.id = co.user_id
             WHERE co.post_id = $1
             ORDER BY co.created_at ASC`,
            [postId]
        );

        res.json({
            success: true,
            comments: result.rows
        });
    } catch (error) {
        console.error("Get comments error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to load comments"
        });
    }
}


module.exports = {
    getPosts,
    createPost,
    toggleLike,
    addComment,
    getComments,
    deletePost
};