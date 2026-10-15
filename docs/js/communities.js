// ==============================
// NEXUS COMMUNITIES
// ==============================

document.addEventListener("DOMContentLoaded", () => {

    checkAuthentication();

    loadUser();

    loadCommunities();

    setupSearch();

    setupCreateCommunity();

});


// ==============================
// AUTHENTICATION
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
// LOAD USER
// ==============================

function loadUser() {

    const userData =
        localStorage.getItem("nexusUser");

    if (!userData) return;

    try {

        const user =
            JSON.parse(userData);

        const name =
            user.name || "User";

        const username =
            user.username || "user";

        const initial =
            name.charAt(0).toUpperCase();


        const sidebarName =
            document.getElementById(
                "sidebarName"
            );

        const sidebarAvatar =
            document.getElementById(
                "sidebarAvatar"
            );

        const topAvatar =
            document.getElementById(
                "topAvatar"
            );


        if (sidebarName) {

            sidebarName.textContent =
                name;

        }


        if (sidebarAvatar) {

            sidebarAvatar.textContent =
                initial;

        }


        if (topAvatar) {

            topAvatar.textContent =
                initial;

        }

    } catch (error) {

        console.error(
            "Unable to load user:",
            error
        );

    }

}


// ==============================
// LOAD COMMUNITIES
// ==============================

async function loadCommunities() {

    const params = new URLSearchParams(
        window.location.search
    );

    const communityId = params.get("communityId");

    if (communityId) {
        loadCommunityDetail(communityId);
        return;
    }

    const container =
        document.getElementById(
            "communitiesContainer"
        );

    if (!container) return;


    const token =
        localStorage.getItem(
            "nexusToken"
        );


    try {

        const response =
            await fetch(
                "/api/communities",
                {
                    method: "GET",

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
                "Unable to load communities"
            );

        }


        if (
            !data.communities ||
            data.communities.length === 0
        ) {

            container.innerHTML = `

                <div class="community-status">

                    <div class="empty-icon">
                        ◉
                    </div>

                    <h3>
                        No communities yet
                    </h3>

                    <p>
                        Create the first community
                        and start building your space.
                    </p>

                </div>

            `;

            return;

        }


        renderCommunities(
            data.communities
        );


    } catch (error) {

        console.error(
            "Community loading error:",
            error
        );


        container.innerHTML = `

            <div class="community-status">

                <div class="empty-icon">
                    !
                </div>

                <h3>
                    Unable to load communities
                </h3>

                <p>
                    Please refresh the page
                    and try again.
                </p>

            </div>

        `;

    }

}


// ==============================
// RENDER COMMUNITIES
// ==============================

function renderCommunities(
    communities
) {

    const container =
        document.getElementById(
            "communitiesContainer"
        );


    container.innerHTML =
        communities.map(
            community => {

                const icon =
                    community.icon || "◎";


                const memberText =
                    community.member_count === 1
                        ? "1 member"
                        : `${community.member_count} members`;


                let buttonText;

                let buttonClass;


                if (community.is_member) {

                    buttonText =
                        "Joined ✓";

                    buttonClass =
                        "community-join-btn joined";

                } else {

                    buttonText =
                        "Join Community";

                    buttonClass =
                        "community-join-btn";

                }


                return `

                    <div
                        class="community-page-card"
                        data-name="${escapeHTML(
                            community.name
                        )}"
                        data-category="${escapeHTML(
                            community.category
                        )}"
                        data-description="${escapeHTML(
                            community.description || ""
                        )}"
                    >


                        <div class="community-page-top">


                            <div class="community-page-icon">

                                ${escapeHTML(icon)}

                            </div>


                            <span
                                class="community-category"
                            >

                                ${escapeHTML(
                                    community.category
                                )}

                            </span>


                        </div>



                        <h3>

                            ${escapeHTML(
                                community.name
                            )}

                        </h3>



                        <p>

                            ${
                                escapeHTML(
                                    community.description ||
                                    "No description provided."
                                )
                            }

                        </p>



                        <div
                            class="community-meta"
                        >

                            <span>

                                👥 ${memberText}

                            </span>


                            <span>

                                @${escapeHTML(
                                    community.creator
                                )}

                            </span>

                        </div>



                        <button
                            class="${buttonClass}"
                            data-community-id="${community.id}"
                            data-is-member="${community.is_member}"
                        >

                            ${buttonText}

                        </button>


                    </div>

                `;

            }
        ).join("");


    setupCommunityButtons();
    setupCommunityCards();

}

// ==============================
// COMMUNITY CARD NAVIGATION
// ==============================

function setupCommunityCards() {

    const cards =
        document.querySelectorAll(
            ".community-page-card"
        );

    cards.forEach(card => {

        card.addEventListener("click", event => {

            // Do not navigate when clicking
            // the Join / Leave button
            if (
                event.target.closest(
                    ".community-join-btn"
                )
            ) {
                return;
            }

            const button =
                card.querySelector(
                    ".community-join-btn"
                );

            const communityId =
                button?.dataset.communityId;

            if (!communityId) return;

            window.location.href =
                `/communities.html?communityId=${communityId}`;

        });

    });

}


// ==============================
// JOIN / LEAVE BUTTONS
// ==============================

function setupCommunityButtons() {

    const buttons =
        document.querySelectorAll(
            ".community-join-btn"
        );


    buttons.forEach(button => {

        button.addEventListener(
            "click",
            async () => {

                const communityId =
                    button.dataset.communityId;


                const isMember =
                    button.dataset.isMember ===
                    "true";


                if (isMember) {

                    await leaveCommunity(
                        communityId,
                        button
                    );

                } else {

                    await joinCommunity(
                        communityId,
                        button
                    );

                }

            }
        );

    });

}


// ==============================
// JOIN COMMUNITY
// ==============================

async function joinCommunity(
    communityId,
    button
) {

    const token =
        localStorage.getItem(
            "nexusToken"
        );


    button.disabled = true;

    button.textContent =
        "Joining...";


    try {

        const response =
            await fetch(
                `/api/communities/${communityId}/join`,
                {
                    method: "POST",

                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(data.message);

            button.disabled =
                false;

            button.textContent =
                "Join Community";

            return;

        }


        await loadCommunities();


    } catch (error) {

        console.error(
            "Join community error:",
            error
        );


        alert(
            "Unable to join community."
        );


        button.disabled =
            false;

        button.textContent =
            "Join Community";

    }

}


// ==============================
// LEAVE COMMUNITY
// ==============================

async function leaveCommunity(
    communityId,
    button
) {

    const confirmed =
        confirm(
            "Are you sure you want to leave this community?"
        );


    if (!confirmed) return;


    const token =
        localStorage.getItem(
            "nexusToken"
        );


    button.disabled = true;

    button.textContent =
        "Leaving...";


    try {

        const response =
            await fetch(
                `/api/communities/${communityId}/leave`,
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

            alert(data.message);

            button.disabled =
                false;

            button.textContent =
                "Joined ✓";

            return;

        }


        await loadCommunities();


    } catch (error) {

        console.error(
            "Leave community error:",
            error
        );


        alert(
            "Unable to leave community."
        );


        button.disabled =
            false;

        button.textContent =
            "Joined ✓";

    }

}


// ==============================
// SEARCH
// ==============================

function setupSearch() {

    const searchInputs = [

        document.getElementById(
            "communitySearch"
        ),

        document.getElementById(
            "topSearch"
        )

    ];


    searchInputs.forEach(input => {

        if (!input) return;


        input.addEventListener(
            "input",
            () => {

                filterCommunities(
                    input.value
                );

            }
        );

    });

}


// ==============================
// FILTER COMMUNITIES
// ==============================

function filterCommunities(
    searchText
) {

    const search =
        searchText
            .toLowerCase()
            .trim();


    const cards =
        document.querySelectorAll(
            ".community-page-card"
        );


    cards.forEach(card => {

        const name =
            card.dataset.name
                .toLowerCase();


        const category =
            card.dataset.category
                .toLowerCase();


        const description =
            card.dataset.description
                .toLowerCase();


        const matches =
            name.includes(search) ||
            category.includes(search) ||
            description.includes(search);


        card.style.display =
            matches ? "" : "none";

    });

}


// ==============================
// CREATE COMMUNITY
// ==============================

function setupCreateCommunity() {

    const openButton =
        document.getElementById(
            "createCommunityBtn"
        );


    const modal =
        document.getElementById(
            "createCommunityModal"
        );


    const closeButton =
        document.getElementById(
            "closeCommunityModal"
        );


    const cancelButton =
        document.getElementById(
            "cancelCommunityBtn"
        );


    const form =
        document.getElementById(
            "createCommunityForm"
        );


    if (
        !openButton ||
        !modal ||
        !form
    ) {

        return;

    }


    // OPEN MODAL

    openButton.addEventListener(
        "click",
        () => {

            modal.classList.add(
                "active"
            );

            setTimeout(() => {

                document
                    .getElementById(
                        "communityName"
                    )
                    ?.focus();

            }, 100);

        }
    );


    // CLOSE MODAL

    closeButton?.addEventListener(
        "click",
        closeCreateModal
    );


    cancelButton?.addEventListener(
        "click",
        closeCreateModal
    );


    // CLICK OUTSIDE MODAL

    modal.addEventListener(
        "click",
        event => {

            if (
                event.target === modal
            ) {

                closeCreateModal();

            }

        }
    );


    // ESCAPE KEY

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                modal.classList.contains(
                    "active"
                )
            ) {

                closeCreateModal();

            }

        }
    );


    // ICON SUGGESTIONS

    const iconButtons =
        document.querySelectorAll(
            ".icon-suggestions button"
        );


    iconButtons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                document.getElementById(
                    "communityIcon"
                ).value =
                    button.dataset.icon;

            }
        );

    });


    // FORM SUBMIT

    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            await createCommunity();

        }
    );

}


// ==============================
// CLOSE CREATE MODAL
// ==============================

function closeCreateModal() {

    const modal =
        document.getElementById(
            "createCommunityModal"
        );


    const form =
        document.getElementById(
            "createCommunityForm"
        );


    const message =
        document.getElementById(
            "createCommunityMessage"
        );


    if (modal) {

        modal.classList.remove(
            "active"
        );

    }


    if (form) {

        form.reset();

    }


    if (message) {

        message.textContent = "";

        message.className =
            "form-message";

    }

}


// ==============================
// CREATE COMMUNITY API
// ==============================

async function createCommunity() {

    const name =
        document.getElementById(
            "communityName"
        ).value.trim();


    const description =
        document.getElementById(
            "communityDescription"
        ).value.trim();


    const category =
        document.getElementById(
            "communityCategory"
        ).value;


    const icon =
        document.getElementById(
            "communityIcon"
        ).value.trim();


    const message =
        document.getElementById(
            "createCommunityMessage"
        );


    const submitButton =
        document.getElementById(
            "submitCommunityBtn"
        );


    if (!name) {

        message.textContent =
            "Community name is required.";

        message.className =
            "form-message error";

        return;

    }


    const token =
        localStorage.getItem(
            "nexusToken"
        );


    submitButton.disabled =
        true;

    submitButton.textContent =
        "Creating...";


    message.textContent =
        "Creating your community...";

    message.className =
        "form-message";


    try {

        const response =
            await fetch(
                "/api/communities",
                {
                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${token}`

                    },

                    body: JSON.stringify({

                        name,
                        description,
                        category,
                        icon

                    })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Unable to create community"
            );

        }


        message.textContent =
            "Community created successfully!";

        message.className =
            "form-message success";


        submitButton.textContent =
            "Created ✓";


        // Refresh community list

        await loadCommunities();


        // Close after short delay

        setTimeout(() => {

            closeCreateModal();

        }, 700);


    } catch (error) {

        console.error(
            "Create community error:",
            error
        );


        message.textContent =
            error.message ||
            "Unable to create community.";


        message.className =
            "form-message error";


        submitButton.disabled =
            false;


        submitButton.textContent =
            "Create Community";

    }

}


// ==============================
// HTML SECURITY
// ==============================

function escapeHTML(text) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        text;


    return div.innerHTML;

}


async function loadCommunityDetail(communityId) {
    const token = localStorage.getItem("nexusToken");
    const detailView = document.getElementById("communityDetailView");
    const container = document.getElementById("communitiesContainer");

    if (!detailView) return;

    if (container) container.style.display = "none";

    const heading = document.querySelector(".communities-heading");
    if (heading) heading.style.display = "none";

    detailView.classList.add("active");
    detailView.innerHTML = `<div class="community-detail-empty">Loading community...</div>`;

    try {
        const response = await fetch(`/api/communities/${communityId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load community");

        const community = data.community;
        if (!community) throw new Error("Community not found");

        const count = Number(community.member_count || 0);
        const memberText = `${count} ${count === 1 ? "member" : "members"}`;
        const joined = community.is_member === true;

        detailView.innerHTML = `
            <div class="community-detail-header">
                <div class="community-detail-top">
                    <div class="community-detail-info">
                        <div class="community-detail-icon">${escapeHTML(community.icon || "◎")}</div>
                        <div class="community-detail-title">
                            <h1>${escapeHTML(community.name)}</h1>
                            <p>${escapeHTML(community.category || "Community")}</p>
                        </div>
                    </div>
                    <button class="community-back-btn" id="communityBackBtn">← Back</button>
                </div>

                <div class="community-detail-description">
                    ${escapeHTML(community.description || "No description provided.")}
                </div>

                <div class="community-detail-meta">
                    <span>👥 <span id="communityMemberCount">${memberText}</span></span>
                    <span>@${escapeHTML(community.creator || "unknown")}</span>
                </div>
            </div>

            <div class="community-detail-grid">
                <section class="community-detail-panel">
                    <h2>Community discussions</h2>
                    <p>Share ideas and collaborate with community members.</p>

                    ${joined ? `
                        <form id="communityPostForm" class="community-post-form">
                            <textarea id="communityPostContent"
                                maxlength="5000"
                                placeholder="What's on your mind?"
                                required></textarea>
                            <button type="submit" id="communityPostSubmit">Publish post</button>
                            <p id="communityPostMessage" role="status"></p>
                        </form>
                    ` : `
                        <p>Join this community to publish posts and participate in discussions.</p>
                    `}

                    <div id="communityPosts">
                        <p>Loading discussions...</p>
                    </div>
                </section>

                <aside class="community-detail-panel">
                    <h2>Community</h2>
                    <p>${memberText}</p>
                    <button
                        class="community-join-btn ${joined ? "joined" : ""}"
                        data-community-id="${community.id}"
                        data-is-member="${joined}"
                        id="communityDetailJoinBtn">
                        ${joined ? "Joined ✓" : "Join Community"}
                    </button>

                    <h3 style="margin-top:24px">Members</h3>
                    <div id="communityMembers"><p>Loading members...</p></div>
                </aside>
            </div>
        `;

        document.getElementById("communityBackBtn").addEventListener("click", () => {
            window.location.href = "/communities.html";
        });

        setupCommunityDetailButton();
        setupCommunityPostForm(communityId);
        loadCommunityPosts(communityId);
        loadCommunityMembers(communityId);

    } catch (error) {
        console.error("Community detail loading error:", error);
        detailView.innerHTML = `
            <div class="community-detail-empty">
                <h3>Unable to load community</h3>
                <p>${escapeHTML(error.message)}</p>
                <button class="community-back-btn" onclick="window.location.href='/communities.html'">
                    ← Back to Communities
                </button>
            </div>
        `;
    }
}

function setupCommunityDetailButton() {

    const button =
        document.getElementById(
            "communityDetailJoinBtn"
        );

    if (!button) return;

    button.addEventListener(
        "click",
        async function () {

            const communityId =
                button.dataset.communityId;

            const isMember =
                button.dataset.isMember === "true";

            if (!communityId) return;

            const token =
                localStorage.getItem(
                    "nexusToken"
                );

            if (!token) {
                window.location.href =
                    "/auth.html";
                return;
            }

            try {

                button.disabled = true;

                if (isMember) {

                    const response =
                        await fetch(
                            `/api/communities/${communityId}/leave`,
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
                            data.message ||
                            "Unable to leave community"
                        );
                    }

                } else {

                    const response =
                        await fetch(
                            `/api/communities/${communityId}/join`,
                            {
                                method: "POST",
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
                            "Unable to join community"
                        );
                    }
                }

                // Reload the detail page
                await loadCommunityDetail(
                    communityId
                );

            } catch (error) {

                console.error(
                    "Community membership error:",
                    error
                );

                alert(error.message);

                button.disabled = false;
            }
        }
    );
}


function getNexusUser() {
    try {
        return JSON.parse(localStorage.getItem("nexusUser") || "{}");
    } catch {
        return {};
    }
}

function setupCommunityPostForm(communityId) {
    const form = document.getElementById("communityPostForm");
    if (!form) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const textarea = document.getElementById("communityPostContent");
        const message = document.getElementById("communityPostMessage");
        const button = document.getElementById("communityPostSubmit");
        const content = textarea.value.trim();

        if (!content) {
            message.textContent = "Write something before publishing.";
            return;
        }

        button.disabled = true;
        button.textContent = "Publishing...";
        message.textContent = "";

        try {
            const response = await fetch("/api/posts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("nexusToken")}`
                },
                body: JSON.stringify({ content, communityId: Number(communityId) })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Unable to publish post");

            textarea.value = "";
            message.textContent = "Post published successfully.";
            await loadCommunityPosts(communityId);
        } catch (error) {
            message.textContent = error.message;
        } finally {
            button.disabled = false;
            button.textContent = "Publish post";
        }
    });
}

async function loadCommunityPosts(communityId) {
    const container = document.getElementById("communityPosts");
    if (!container) return;

    try {
        const response = await fetch(
            `/api/posts?communityId=${encodeURIComponent(communityId)}`,
            {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("nexusToken")}`
                }
            }
        );

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load posts");

        const posts = data.posts || [];

        if (!posts.length) {
            container.innerHTML = `
                <div class="community-detail-empty">
                    <h3>No discussions yet</h3>
                    <p>Be the first to share something with this community.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = posts.map(renderCommunityPost).join("");
        setupCommunityPostActions(communityId);
    } catch (error) {
        console.error("Community posts error:", error);
        container.innerHTML = `<p>Unable to load discussions. ${escapeHTML(error.message)}</p>`;
    }
}

function renderCommunityPost(post) {
    const user = getNexusUser();
    const ownPost = String(post.user_id) === String(user.id);
    const author = post.author_name || post.author_username || "Member";
    const date = post.created_at
        ? new Date(post.created_at).toLocaleString()
        : "";

    return `
        <article class="community-post" data-post-id="${post.id}"
            style="border:1px solid var(--border-color, #263246);border-radius:12px;padding:16px;margin-top:14px">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:start">
                <div>
                    <strong>${escapeHTML(author)}</strong>
                    <div style="font-size:12px;opacity:.7">
                        ${post.author_username ? "@" + escapeHTML(post.author_username) + " · " : ""}
                        ${escapeHTML(date)}
                    </div>
                </div>
                ${ownPost ? `<button type="button" class="community-delete-post">Delete</button>` : ""}
            </div>

            <p style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHTML(post.content)}</p>

            <div style="display:flex;gap:10px;flex-wrap:wrap">
                <button type="button" class="community-like-post">
                    ${post.liked ? "♥ Liked" : "♡ Like"} (${Number(post.like_count || 0)})
                </button>
                <button type="button" class="community-toggle-comments">
                    Comments (${Number(post.comment_count || 0)})
                </button>
            </div>

            <div class="community-comments" hidden>
                <div class="community-comments-list">Loading comments...</div>
                <form class="community-comment-form" style="display:flex;gap:8px;margin-top:10px">
                    <input name="content" maxlength="2000" placeholder="Write a comment..." required style="flex:1;min-width:0">
                    <button type="submit">Send</button>
                </form>
                <p class="community-comment-message" role="status"></p>
            </div>
        </article>
    `;
}

function setupCommunityPostActions(communityId) {
    const container = document.getElementById("communityPosts");
    if (!container) return;

    container.querySelectorAll(".community-like-post").forEach(button => {
        button.addEventListener("click", async () => {
            const post = button.closest("[data-post-id]");
            button.disabled = true;

            try {
                const response = await fetch(`/api/posts/${post.dataset.postId}/like`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("nexusToken")}`
                    }
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.message || "Unable to update like");

                await loadCommunityPosts(communityId);
            } catch (error) {
                alert(error.message);
                button.disabled = false;
            }
        });
    });

    container.querySelectorAll(".community-toggle-comments").forEach(button => {
        button.addEventListener("click", async () => {
            const post = button.closest("[data-post-id]");
            const section = post.querySelector(".community-comments");
            section.hidden = !section.hidden;

            if (!section.hidden && !section.dataset.loaded) {
                await loadPostComments(post);
            }
        });
    });

    container.querySelectorAll(".community-comment-form").forEach(form => {
        form.addEventListener("submit", async event => {
            event.preventDefault();

            const post = form.closest("[data-post-id]");
            const input = form.elements.content;
            const message = post.querySelector(".community-comment-message");
            const content = input.value.trim();

            if (!content) return;

            const button = form.querySelector("button");
            button.disabled = true;

            try {
                const response = await fetch(`/api/posts/${post.dataset.postId}/comments`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("nexusToken")}`
                    },
                    body: JSON.stringify({ content })
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.message || "Unable to add comment");

                input.value = "";
                message.textContent = "Comment added.";
                await loadPostComments(post);
                await loadCommunityPosts(communityId);
            } catch (error) {
                message.textContent = error.message;
            } finally {
                button.disabled = false;
            }
        });
    });

    container.querySelectorAll(".community-delete-post").forEach(button => {
        button.addEventListener("click", async () => {
            const post = button.closest("[data-post-id]");
            if (!confirm("Delete your post? This cannot be undone.")) return;

            button.disabled = true;

            try {
                const response = await fetch(`/api/posts/${post.dataset.postId}`, {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("nexusToken")}`
                    }
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.message || "Unable to delete post");

                await loadCommunityPosts(communityId);
            } catch (error) {
                alert(error.message);
                button.disabled = false;
            }
        });
    });
}

async function loadPostComments(postElement) {
    const list = postElement.querySelector(".community-comments-list");
    list.textContent = "Loading comments...";

    try {
        const response = await fetch(
            `/api/posts/${postElement.dataset.postId}/comments`,
            {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("nexusToken")}`
                }
            }
        );

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load comments");

        const comments = data.comments || [];

        list.innerHTML = comments.length
            ? comments.map(comment => `
                <div style="padding:10px 0;border-bottom:1px solid var(--border-color, #263246)">
                    <strong>${escapeHTML(comment.author_name || comment.author_username || "Member")}</strong>
                    <div style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHTML(comment.content)}</div>
                    <small style="opacity:.7">${escapeHTML(
                        comment.created_at ? new Date(comment.created_at).toLocaleString() : ""
                    )}</small>
                </div>
            `).join("")
            : "<p>No comments yet. Start the conversation.</p>";

        postElement.querySelector(".community-comments").dataset.loaded = "true";
    } catch (error) {
        list.textContent = error.message;
    }
}

async function loadCommunityMembers(communityId) {
    const container = document.getElementById("communityMembers");
    if (!container) return;

    try {
        const response = await fetch(`/api/communities/${communityId}/members`, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("nexusToken")}`
            }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load members");

        const members = data.members || [];

        container.innerHTML = members.length
            ? members.map(member => `
                <div style="display:flex;justify-content:space-between;gap:8px;padding:10px 0;border-bottom:1px solid var(--border-color, #263246)">
                    <div>
                        <strong>${escapeHTML(member.name || member.username || "Member")}</strong>
                        <div style="font-size:12px;opacity:.7">@${escapeHTML(member.username || "user")}</div>
                    </div>
                    <span style="font-size:12px;opacity:.8">${escapeHTML(member.role || "member")}</span>
                </div>
            `).join("")
            : "<p>No members found.</p>";
    } catch (error) {
        console.error("Community members error:", error);
        container.innerHTML = `<p>Unable to load members. ${escapeHTML(error.message)}</p>`;
    }
}