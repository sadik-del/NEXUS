// ==============================
// NEXUS FEED
// ==============================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        checkAuthentication();

        loadUser();

        loadCommunities();

        loadPosts();

        setupCreatePost();

    }
);


// ==============================
// AUTH
// ==============================

function checkAuthentication() {

    const token =
        localStorage.getItem("nexusToken");

    if (!token) {

        window.location.href =
            "/auth.html";

    }

}


// ==============================
// USER
// ==============================

function loadUser() {

    const data =
        localStorage.getItem("nexusUser");

    if (!data) return;


    try {

        const user =
            JSON.parse(data);

        const name =
            user.name || "User";

        const initial =
            name.charAt(0).toUpperCase();


        const nameElement =
            document.getElementById(
                "userName"
            );

        const avatar =
            document.getElementById(
                "userAvatar"
            );

        const sidebarAvatar =
            document.getElementById(
                "sidebarAvatar"
            );

        const sidebarName =
            document.getElementById(
                "sidebarName"
            );

        const topAvatar =
            document.getElementById(
                "topAvatar"
            );


        if (nameElement)
            nameElement.textContent = name;

        if (avatar)
            avatar.textContent = initial;

        if (sidebarAvatar)
            sidebarAvatar.textContent = initial;

        if (sidebarName)
            sidebarName.textContent = name;

        if (topAvatar)
            topAvatar.textContent = initial;


    } catch (error) {

        console.error(error);

    }

}


// ==============================
// LOAD COMMUNITIES
// ==============================

async function loadCommunities() {

    const select =
        document.getElementById(
            "postCommunity"
        );


    if (!select) return;


    const token =
        localStorage.getItem(
            "nexusToken"
        );


    try {

        const response =
            await fetch(
                "/api/communities",
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
                data.message
            );

        }


        const joined =
            data.communities.filter(
                community =>
                    community.is_member
            );


        if (joined.length === 0) {

            select.innerHTML = `
                <option value="">
                    Join a community to post
                </option>
            `;

            return;

        }


        select.innerHTML = `
            <option value="">
                Select community
            </option>

            ${joined.map(
                community => `
                    <option
                        value="${community.id}"
                    >
                        ${escapeHTML(
                            community.name
                        )}
                    </option>
                `
            ).join("")}
        `;


    } catch (error) {

        console.error(
            "Community loading error:",
            error
        );

    }

}


// ==============================
// LOAD POSTS
// ==============================

async function loadPosts() {

    const container =
        document.getElementById(
            "postsContainer"
        );


    const token =
        localStorage.getItem(
            "nexusToken"
        );


    try {

        const response =
            await fetch(
                "/api/posts",
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
                data.message
            );

        }


        renderPosts(
            data.posts
        );


    } catch (error) {

        console.error(
            "Post loading error:",
            error
        );


        container.innerHTML = `
            <div class="feed-empty">
                Unable to load the feed.
            </div>
        `;

    }

}


// ==============================
// RENDER POSTS
// ==============================

function renderPosts(posts) {

    const container =
        document.getElementById(
            "postsContainer"
        );


    if (!posts.length) {

        container.innerHTML = `
            <div class="feed-empty">
                <strong>No posts yet.</strong>
                <br><br>
                Be the first person to share something.
            </div>
        `;

        return;

    }


    const currentUser =
        JSON.parse(
            localStorage.getItem(
                "nexusUser"
            ) || "{}"
        );


    container.innerHTML =
        posts.map(post => {

            const initial =
                (post.author_name || "U")
                    .charAt(0)
                    .toUpperCase();


            const deleteButton =
                Number(post.user_id) ===
                Number(currentUser.id)
                    ? `
                        <button
                            class="post-delete"
                            onclick="deletePost(${post.id})"
                            title="Delete post"
                        >
                            ×
                        </button>
                    `
                    : "";


            return `

                <article
                    class="post-card"
                    data-post-id="${post.id}"
                >

                    <div class="post-header">

                        <div class="post-author">

                            <div class="post-avatar">
                                ${escapeHTML(initial)}
                            </div>

                            <div
                                class="post-author-info"
                            >

                                <strong>
                                    ${escapeHTML(
                                        post.author_name
                                    )}
                                </strong>

                                <span>
                                    @${escapeHTML(
                                        post.author_username
                                    )}
                                </span>

                                <span
                                    class="post-community"
                                >
                                    ${escapeHTML(
                                        post.community_icon ||
                                        "◉"
                                    )}
                                    ${escapeHTML(
                                        post.community_name
                                    )}
                                </span>

                            </div>

                        </div>

                        ${deleteButton}

                    </div>


                    <div class="post-content">
                        ${escapeHTML(
                            post.content
                        )}
                    </div>


                    <div class="post-actions">

                        <button
                            class="post-action ${
                                post.liked
                                    ? "liked"
                                    : ""
                            }"
                            onclick="toggleLike(
                                ${post.id},
                                this
                            )"
                        >
                            ${post.liked
                                ? "♥"
                                : "♡"}
                            ${post.like_count}
                        </button>


                        <button
                            class="post-action"
                            onclick="toggleComments(
                                ${post.id}
                            )"
                        >
                            💬
                            ${post.comment_count}
                        </button>

                    </div>


                    <div
                        class="comment-box"
                        id="commentBox-${post.id}"
                    >

                        <input
                            type="text"
                            id="comment-${post.id}"
                            placeholder="Write a comment..."
                            maxlength="500"
                        >

                        <button
                            onclick="addComment(
                                ${post.id}
                            )"
                        >
                            Send
                        </button>

                    </div>

                </article>

            `;

        }).join("");

}


// ==============================
// CREATE POST
// ==============================

function setupCreatePost() {

    const button =
        document.getElementById(
            "createPostBtn"
        );


    button.addEventListener(
        "click",
        createPost
    );

}


async function createPost() {

    const content =
        document.getElementById(
            "postContent"
        ).value.trim();


    const communityId =
        document.getElementById(
            "postCommunity"
        ).value;


    const message =
        document.getElementById(
            "postMessage"
        );


    const button =
        document.getElementById(
            "createPostBtn"
        );


    if (!content) {

        message.textContent =
            "Write something first.";

        message.className =
            "post-message error";

        return;

    }


    if (!communityId) {

        message.textContent =
            "Select a community.";

        message.className =
            "post-message error";

        return;

    }


    const token =
        localStorage.getItem(
            "nexusToken"
        );


    button.disabled = true;

    button.textContent =
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
                data.message
            );

        }


        document.getElementById(
            "postContent"
        ).value = "";


        document.getElementById(
            "postCommunity"
        ).value = "";


        message.textContent =
            "Post published!";

        message.className =
            "post-message success";


        await loadPosts();


    } catch (error) {

        message.textContent =
            error.message ||
            "Unable to publish post.";

        message.className =
            "post-message error";

    }


    button.disabled = false;

    button.textContent =
        "Publish Post";

}


// ==============================
// LIKE
// ==============================

async function toggleLike(
    postId,
    button
) {

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
                "Unable to like post"
            );

        }


        await loadPosts();


    } catch (error) {

        console.error(error);

    }

}


// ==============================
// COMMENTS UI
// ==============================

function toggleComments(postId) {

    const box =
        document.getElementById(
            `commentBox-${postId}`
        );


    if (box) {

        box.classList.toggle(
            "active"
        );

    }

}


// ==============================
// ADD COMMENT
// ==============================

async function addComment(postId) {

    const input =
        document.getElementById(
            `comment-${postId}`
        );


    const content =
        input.value.trim();


    if (!content) return;


    const token =
        localStorage.getItem(
            "nexusToken"
        );


    try {

        const response =
            await fetch(
                `/api/posts/${postId}/comments`,
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${token}`

                    },

                    body: JSON.stringify({
                        content
                    })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message
            );

        }


        await loadPosts();


    } catch (error) {

        console.error(error);

        alert(
            error.message ||
            "Unable to add comment."
        );

    }

}


// ==============================
// DELETE POST
// ==============================

async function deletePost(postId) {

    const confirmed =
        confirm(
            "Delete this post?"
        );


    if (!confirmed) return;


    const token =
        localStorage.getItem(
            "nexusToken"
        );


    try {

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


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message
            );

        }


        await loadPosts();


    } catch (error) {

        alert(
            error.message ||
            "Unable to delete post."
        );

    }

}


// ==============================
// SECURITY
// ==============================

function escapeHTML(text) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        text ?? "";

    return div.innerHTML;

}