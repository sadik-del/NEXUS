
"use strict";

// ========================================
// NEXUS DASHBOARD
// ========================================

document.addEventListener("DOMContentLoaded", async () => {
    console.log("NEXUS dashboard loaded.");

    const token = localStorage.getItem("nexusToken");

    if (!token) {
        window.location.replace("/auth.html");
        return;
    }

    loadUserData();
    setupNavigation();
    setupLogout();
    setupDashboardButtons();
    updateDashboardDate();
    await loadDashboardData();

    // Refresh unread notification count periodically.
    await loadNotificationCount();
    setInterval(loadNotificationCount, 15000);
});


// ========================================
// API HELPER
// ========================================

async function apiRequest(url) {
    const token = localStorage.getItem("nexusToken");

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error("The server returned an invalid response.");
    }

    if (!response.ok || data.success === false) {
        throw new Error(data.message || `Request failed: ${response.status}`);
    }

    return data;
}


// ========================================
// USER DATA AND GREETING
// ========================================

function loadUserData() {
    const userData = localStorage.getItem("nexusUser");
    let user = {};

    try {
        user = userData ? JSON.parse(userData) : {};
    } catch (error) {
        console.error("Unable to parse saved user:", error);
    }

    const name = user.name || user.username || "User";
    const username = user.username || "user";
    const initial = name.charAt(0).toUpperCase();

    const setText = (selector, value) => {
        const element = document.querySelector(selector);
        if (element) element.textContent = value;
    };

    setText(".workspace-info strong", name);
    setText(".workspace .avatar", initial);
    setText(".user-card .user-info strong", name);
    setText(".user-card .user-info span", `@${username}`);
    setText(".user-card .avatar", initial);
    setText(".top-avatar", initial);
    setText("#dashboardUserName", name);

    const heading = document.querySelector(".welcome h1");

    if (heading) {
        heading.replaceChildren(
            document.createTextNode(
                `Good ${getTimeGreeting()}, ${name} `
            )
        );

        const emoji = document.createElement("span");
        emoji.textContent = "👋";
        heading.appendChild(emoji);
    }
}

function getTimeGreeting() {
    const hour = new Date().getHours();

    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
}

function updateDashboardDate() {
    const element = document.getElementById("dashboardDate");
    if (!element) return;

    element.textContent = new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    }).toUpperCase();
}


// ========================================
// DASHBOARD DATA
// ========================================

async function loadDashboardData() {
    try {
        const [projectsResult, communitiesResult] = await Promise.all([
            apiRequest("/api/projects"),
            apiRequest("/api/communities")
        ]);

        const projects = Array.isArray(projectsResult.projects)
            ? projectsResult.projects
            : [];

        const allCommunities = Array.isArray(communitiesResult.communities)
            ? communitiesResult.communities
            : [];

        const communities = allCommunities.filter(
            community => community.is_member === true
        );

        setStat("statProjects", projects.length);
        setStat("statCommunities", communities.length);

        renderProjects(projects);
        renderCommunities(allCommunities);

        await loadDashboardTasks(projects);
    } catch (error) {
        console.error("Dashboard loading error:", error);

        showMessage(
            "dashboardProjectList",
            "Unable to load projects. Please refresh the page."
        );

        showMessage(
            "dashboardTaskList",
            "Unable to load tasks. Please try again."
        );

        setStat("statProjects", "—");
        setStat("statCommunities", "—");
        setStat("statOpenTasks", "—");
    }
}

function setStat(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function showMessage(id, message) {
    const element = document.getElementById(id);
    if (!element) return;

    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    element.replaceChildren(paragraph);
}


// ========================================
// RECENT PROJECTS
// ========================================

function renderProjects(projects) {
    const container = document.getElementById("dashboardProjectList");
    if (!container) return;

    if (!projects.length) {
        showMessage(container.id, "No projects yet. Create or join a project to get started.");
        return;
    }

    container.replaceChildren();

    projects.slice(0, 4).forEach(project => {
        const card = document.createElement("div");
        card.className = "project";
        card.tabIndex = 0;
        card.setAttribute("role", "link");
        card.setAttribute("aria-label", `Open project ${project.name}`);

        const logo = document.createElement("div");
        logo.className = "project-logo purple-bg";
        logo.textContent = (project.name || "P").charAt(0).toUpperCase();

        const info = document.createElement("div");
        info.className = "project-info";

        const name = document.createElement("strong");
        name.textContent = project.name || "Untitled project";

        const detail = document.createElement("span");
        const memberCount = Number(project.member_count) || 0;
        detail.textContent =
            `${memberCount} ${memberCount === 1 ? "member" : "members"}`;

        info.append(name, detail);
        card.append(logo, info);

        const openProject = () => {
            window.location.href =
                `/projects.html?projectId=${encodeURIComponent(project.id)}`;
        };

        card.addEventListener("click", openProject);
        card.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openProject();
            }
        });

        container.appendChild(card);
    });
}


// ========================================
// YOUR COMMUNITIES
// ========================================

function renderCommunities(communities) {
    const container = document.getElementById("communityGrid");
    if (!container) return;

    if (!communities.length) {
        showMessage(
            container.id,
            "No communities are available yet. Explore communities to join one."
        );
        return;
    }

    container.replaceChildren();

    communities.slice(0, 6).forEach(community => {
        const card = document.createElement("div");
        card.className = "community";
        card.dataset.communityId = community.id;
        card.style.cursor = "pointer";
        card.tabIndex = 0;
        card.setAttribute("role", "link");

        const icon = document.createElement("div");
        icon.className = "community-icon purple-bg";
        icon.textContent = community.icon || "◎";

        const name = document.createElement("strong");
        name.textContent = community.name || "Community";

        const members = document.createElement("span");
        const count = Number(community.member_count) || 0;
        members.textContent =
            `${count} ${count === 1 ? "member" : "members"}`;

        card.append(icon, name, members);

        const openCommunity = () => {
            window.location.href =
                `/communities.html?communityId=${encodeURIComponent(community.id)}`;
        };

        card.addEventListener("click", openCommunity);
        card.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openCommunity();
            }
        });

        container.appendChild(card);
    });
}


// ========================================
// TASKS ACROSS PROJECTS
// ========================================

async function loadDashboardTasks(projects) {
    const container = document.getElementById("dashboardTaskList");
    if (!container) return;

    try {
        const results = await Promise.allSettled(
            projects.map(project =>
                apiRequest(`/api/tasks/${encodeURIComponent(project.id)}`)
                    .then(data => ({
                        project,
                        tasks: Array.isArray(data.tasks) ? data.tasks : []
                    }))
            )
        );

        const successful = results
            .filter(result => result.status === "fulfilled")
            .map(result => result.value);

        const userData = JSON.parse(
            localStorage.getItem("nexusUser") || "{}"
        );

        const userId = userData.id ?? userData.user_id;

        let tasks = successful.flatMap(({ project, tasks }) =>
            tasks.map(task => ({
                ...task,
                project_name: project.name || "Project"
            }))
        );

        // Show tasks assigned to the logged-in user when their ID is available.
        if (userId != null) {
            tasks = tasks.filter(task =>
                String(task.assigned_to) === String(userId)
            );
        }

        const isCompleted = task =>
            ["completed", "done"].includes(
                String(task.status || "").toLowerCase()
            );

        const openTasks = tasks.filter(task => !isCompleted(task));

        setStat("statOpenTasks", openTasks.length);
        renderTasks(openTasks.slice(0, 5));

        if (results.length && successful.length === 0) {
            showMessage(
                container.id,
                "Unable to load task details. Open Projects & Tasks to check your board."
            );
        }
    } catch (error) {
        console.error("Dashboard task error:", error);
        setStat("statOpenTasks", "—");
        showMessage(
            "dashboardTaskList",
            "Unable to load tasks. Open Projects & Tasks to view your board."
        );
    }
}

function renderTasks(tasks) {
    const container = document.getElementById("dashboardTaskList");
    if (!container) return;

    if (!tasks.length) {
        showMessage(container.id, "You're all caught up! No open assigned tasks found.");
        return;
    }

    container.replaceChildren();

    tasks.forEach(task => {
        const row = document.createElement("div");
        row.className = "task";

        const details = document.createElement("div");

        const title = document.createElement("strong");
        title.textContent = task.title || "Untitled task";

        const project = document.createElement("small");
        project.textContent = task.project_name;

        details.append(title, project);

        const priority = document.createElement("span");
        const level = String(task.priority || "normal").toLowerCase();

        priority.className = `priority ${
            ["high", "urgent"].includes(level) ? "high" :
            level === "low" ? "low" : "medium"
        }`;
        priority.textContent = level.charAt(0).toUpperCase() + level.slice(1);

        row.append(details, priority);
        row.tabIndex = 0;
        row.style.cursor = "pointer";

        const openTask = () => {
            window.location.href =
                `/projects.html?projectId=${encodeURIComponent(task.project_id)}&taskId=${encodeURIComponent(task.id)}`;
        };

        row.addEventListener("click", openTask);
        row.addEventListener("keydown", event => {
            if (event.key === "Enter") openTask();
        });

        container.appendChild(row);
    });
}


// ========================================
// NAVIGATION
// ========================================

function setupNavigation() {
    const currentPage =
        window.location.pathname.split("/").pop() || "index.html";

    document.querySelectorAll(".navigation .nav-item").forEach(item => {
        const href = item.getAttribute("href");
        if (!href || href === "#") return;

        const targetPage = href.split("/").pop();
        item.classList.toggle("active", targetPage === currentPage);
    });
}

function setupDashboardButtons() {
    const createButton = document.getElementById("dashboardCreateButton");

    createButton?.addEventListener("click", () => {
        window.location.href = "/projects.html";
    });

    document.getElementById("exploreCommunities")
        ?.addEventListener("click", event => {
            event.preventDefault();
            window.location.href = "/communities.html";
        });

    document.querySelector(".notification-btn")
        ?.addEventListener("click", () => {
            window.location.href = "/notifications.html";
        });
}


// ========================================
// NOTIFICATION COUNT
// ========================================

async function loadNotificationCount() {
    try {
        const data = await apiRequest("/api/notifications/unread-count");

        if (data.success === false) return;

        const count = Number(data.count) || 0;

        setStat("statUnreadNotifications", count);
        updateNotificationBadge(count);
    } catch (error) {
        console.error("Notification count error:", error);
    }
}

function updateNotificationBadge(count) {
    const targets = [
        ...document.querySelectorAll(".notification-btn"),
        ...Array.from(document.querySelectorAll(".navigation .nav-item"))
            .filter(item => item.textContent.includes("Notifications"))
    ];

    targets.forEach(target => {
        let badge = target.querySelector(".notification-count");

        if (count > 0) {
            if (!badge) {
                badge = document.createElement("span");
                badge.className = "notification-count";
                target.appendChild(badge);
            }

            badge.textContent = count > 99 ? "99+" : String(count);
        } else {
            badge?.remove();
        }
    });
}


// ========================================
// LOGOUT
// ========================================

function setupLogout() {
    const logoutButton = document.querySelector(".more-btn");
    if (!logoutButton) return;

    logoutButton.addEventListener("click", () => {
        if (!confirm("Are you sure you want to logout?")) return;

        localStorage.removeItem("nexusToken");
        localStorage.removeItem("nexusUser");
        window.location.replace("/auth.html");
    });
}