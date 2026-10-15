
(() => {
    "use strict";

    const token = localStorage.getItem("nexusToken");

    if (!token) {
        window.location.href = "/auth.html";
        return;
    }

    const notificationList = document.getElementById("notificationList");
    const markAllBtn = document.getElementById("markAllBtn");
    const refreshBtn = document.getElementById("refreshBtn");
    const navCount = document.getElementById("navNotificationCount");

    const escapeHtml = (value) => {
        const element = document.createElement("div");
        element.textContent = String(value ?? "");
        return element.innerHTML;
    };

    async function apiRequest(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(options.headers || {})
            }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Request failed.");
        }

        return data;
    }

    function formatDate(date) {
        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return "";
        }

        return parsedDate.toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short"
        });
    }

    function getNotificationIcon(type) {
        const icons = {
            project: "🚀",
            message: "💬",
            comment: "💭",
            like: "❤️",
            community: "👥",
            task: "✅",
            mention: "📢"
        };

        return icons[type] || "🔔";
    }

    function updateUnreadCount(notifications) {
        const unreadCount = notifications.filter(
            notification =>
                !(
                    notification.is_read === true ||
                    notification.is_read === 1 ||
                    notification.is_read === "true"
                )
        ).length;

        if (!navCount) return;

        if (unreadCount > 0) {
            navCount.style.display = "grid";
            navCount.textContent = unreadCount > 99 ? "99+" : unreadCount;
        } else {
            navCount.style.display = "none";
            navCount.textContent = "";
        }
    }

    
    function getNotificationUrl(notification) {
        const type = String(notification.type || "").toLowerCase();

        switch (type) {
            case "task": {
                const projectId = Number(notification.target_project_id);
                const taskId = Number(notification.target_task_id);

                if (
                    Number.isInteger(projectId) && projectId > 0 &&
                    Number.isInteger(taskId) && taskId > 0
                ) {
                    return `/projects.html?projectId=${projectId}&taskId=${taskId}`;
                }

                return "/projects.html";
            }

            case "project":
                return "/projects.html";

            case "community":
            case "community_join":
                return "/communities.html";

            case "like":
            case "comment":
                if (notification.related_id) {
                    return `/feed.html?postId=${encodeURIComponent(notification.related_id)}`;
                }
                return "/feed.html";

            
            
            case "message": {
                const projectId = Number(notification.target_chat_project_id);
                const directUserId = Number(notification.target_direct_user_id);
                const messageId = Number(notification.related_id);

                // Existing project chat notifications
                if (
                    Number.isInteger(projectId) && projectId > 0 &&
                    Number.isInteger(messageId) && messageId > 0
                ) {
                    return `/chat.html?projectId=${projectId}&messageId=${messageId}`;
                }

                // Direct message notifications
                if (
                    Number.isInteger(directUserId) && directUserId > 0 &&
                    Number.isInteger(messageId) && messageId > 0
                ) {
                    return `/chat.html?userId=${directUserId}&messageId=${messageId}`;
                }

                return "/chat.html";
            }

            default:
                return null;
        }
    }

    
    function renderNotifications(notifications) {
        if (!notificationList) return;

        if (!Array.isArray(notifications) || notifications.length === 0) {
            notificationList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔔</div>
                    <h3>You're all caught up</h3>
                    <p>New activity and updates will appear here.</p>
                </div>
            `;
            return;
        }

        notificationList.innerHTML = notifications.map(notification => {
            const isRead =
                notification.is_read === true ||
                notification.is_read === 1 ||
                notification.is_read === "true";

            const id = Number(notification.id);
            const targetUrl = getNotificationUrl(notification);

            return `
                <div
                    class="notification ${isRead ? "" : "unread"}"
                    data-id="${Number.isFinite(id) ? id : ""}"
                    data-target="${escapeHtml(targetUrl || "")}"
                    ${targetUrl ? 'role="link" tabindex="0"' : ""}
                >
                    <div class="notification-icon">
                        ${getNotificationIcon(notification.type)}
                    </div>

                    <div class="notification-content">
                        <div class="notification-title">
                            ${escapeHtml(notification.title)}
                        </div>

                        <div class="notification-message">
                            ${escapeHtml(notification.message || "")}
                        </div>

                        <div class="notification-time">
                            ${escapeHtml(formatDate(notification.created_at))}
                        </div>
                    </div>

                    ${
                        !isRead && Number.isFinite(id) && id > 0
                            ? `
                                <button
                                    class="read-btn"
                                    type="button"
                                    data-action="mark-read"
                                    data-id="${id}"
                                >
                                    Mark read
                                </button>
                                <div class="unread-dot"></div>
                            `
                            : ""
                    }
                </div>
            `;
        }).join("");
    }

    async function loadNotifications() {
        if (!notificationList) return;

        notificationList.innerHTML = `
            <div class="loading">Loading notifications...</div>
        `;

        try {
            const data = await apiRequest("/api/notifications");

            const notifications = Array.isArray(data.notifications)
                ? data.notifications
                : [];

            renderNotifications(notifications);
            updateUnreadCount(notifications);
        } catch (error) {
            console.error("Load notifications error:", error);

            notificationList.innerHTML = `
                <div class="error">
                    ${escapeHtml(error.message)}
                </div>
            `;
        }
    }

    async function markAsRead(notificationId) {
        try {
            await apiRequest(
                `/api/notifications/${notificationId}/read`,
                { method: "PUT" }
            );

            await loadNotifications();
        } catch (error) {
            console.error("Mark notification error:", error);
            alert(error.message);
        }
    }

    async function markAllAsRead() {
        if (!markAllBtn) return;

        markAllBtn.disabled = true;

        try {
            await apiRequest("/api/notifications/read-all", {
                method: "PUT"
            });

            await loadNotifications();
        } catch (error) {
            console.error("Mark all notifications error:", error);
            alert(error.message);
        } finally {
            markAllBtn.disabled = false;
        }
    }

    // One delegated handler supports every Mark read button.
    
    if (notificationList) {
        notificationList.addEventListener("click", event => {
            const button = event.target.closest(
                '[data-action="mark-read"]'
            );

            if (button) {
                event.stopPropagation();

                const id = Number(button.dataset.id);

                if (Number.isInteger(id) && id > 0) {
                    markAsRead(id);
                }

                return;
            }

            const card = event.target.closest(".notification");

            if (card && card.dataset.target) {
                window.location.href = card.dataset.target;
            }
        });

        notificationList.addEventListener("keydown", event => {
            if (event.key !== "Enter" && event.key !== " ") return;

            const card = event.target.closest(
                '.notification[role="link"]'
            );

            if (!card || !card.dataset.target) return;

            event.preventDefault();
            window.location.href = card.dataset.target;
        });
    }

    // Register each control only once.
    if (markAllBtn) {
        markAllBtn.addEventListener("click", markAllAsRead);
    }

    if (refreshBtn) {
        refreshBtn.addEventListener("click", loadNotifications);
    }

    loadNotifications();

    // Refresh the page's notification list when a new notification arrives.
    if (typeof window.io === "function") {
        const notificationSocket = window.io({
            auth: { token }
        });

        notificationSocket.on("connect_error", error => {
            console.error("Notification socket error:", error.message);
        });

        notificationSocket.on("newNotification", () => {
            loadNotifications();
        });
    }
})();