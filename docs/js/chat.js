
(() => {
    const token = localStorage.getItem("nexusToken");
    const user = JSON.parse(localStorage.getItem("nexusUser") || "null");

    if (!token || !user) {
        window.location.href = "/auth.html";
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const projectId = Number(params.get("projectId")) || null;
    const directUserId = Number(params.get("userId")) || null;

    const $ = id => document.getElementById(id);

    const messagesElement = $("messages");
    const input = $("messageInput");
    const form = $("messageForm");
    const sendButton = $("sendButton");
    const statusElement = $("connectionStatus");
    const subtitle = $("chatSubtitle");
    const notice = $("notice");
    const searchForm = $("userSearchForm");
    const searchInput = $("userSearchInput");
    const searchNotice = $("searchNotice");
    const userResults = $("userResults");
    const peoplePanel = $("peoplePanel");
    const conversationList = $("conversationList");
    let conversationRefreshTimer = null;

    let conversationId = null;
    let socket = null;
    let sending = false;
    let typingTimer = null;
    let activeConversationKey = "";
    const renderedMessageIds = new Set();

    const apiHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };

    function setNotice(message, isError = false) {
        notice.textContent = message;
        notice.classList.toggle("error", isError);
    }

    function showError(message) {
        messagesElement.replaceChildren();
        const box = document.createElement("div");
        box.className = "welcome error";
        box.textContent = message;
        messagesElement.appendChild(box);
    }

    function showWelcome(message) {
        messagesElement.replaceChildren();
        const box = document.createElement("div");
        box.className = "welcome";
        box.textContent = message;
        messagesElement.appendChild(box);
    }

    function formatTime(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return date.toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short"
        });
    }

    function renderMessage(message) {
        if (renderedMessageIds.has(String(message.id))) return;
        renderedMessageIds.add(String(message.id));

        const empty = messagesElement.querySelector(".welcome");
        if (empty) empty.remove();

        const ownMessage = Number(message.sender_id) === Number(user.id);
        const card = document.createElement("article");
        card.id = `message-${message.id}`;
        card.className = `message${ownMessage ? " mine" : ""}`;

        const meta = document.createElement("div");
        meta.className = "message-meta";

        const sender = document.createElement("strong");
        sender.textContent = ownMessage
            ? "You"
            : (message.sender_name || message.sender_username || "Member");

        const time = document.createElement("span");
        time.textContent = formatTime(message.created_at);

        const content = document.createElement("div");
        content.className = "message-content";
        content.textContent = message.content;

        meta.append(sender, time);
        card.append(meta, content);
        messagesElement.appendChild(card);
        messagesElement.scrollTop = messagesElement.scrollHeight;
    }

    function highlightRequestedMessage() {
        const messageId = Number(params.get("messageId"));
        if (!Number.isInteger(messageId) || messageId <= 0) return;

        const card = document.getElementById(`message-${messageId}`);
        if (!card) {
            setNotice("The requested message could not be found in this conversation.", true);
            return;
        }

        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.style.outline = "3px solid #3B82F6";
        card.style.outlineOffset = "4px";
        card.style.borderRadius = "10px";

        setTimeout(() => {
            card.style.outline = "";
            card.style.outlineOffset = "";
            card.style.borderRadius = "";
        }, 5000);

        params.delete("messageId");
        const query = params.toString();
        window.history.replaceState(
            {},
            document.title,
            window.location.pathname + (query ? `?${query}` : "")
        );
    }

    async function apiRequest(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: { ...apiHeaders, ...(options.headers || {}) }
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Request failed");
        }

        return data;
    }

    function connectSocket() {
        if (typeof window.io !== "function") {
            statusElement.textContent = "Live updates unavailable";
            setNotice("You can send messages, but live updates are unavailable.", true);
            return;
        }

        if (socket) {
            socket.disconnect();
            socket = null;
        }

        socket = window.io({ auth: { token } });

        socket.on("chatError", data => {
            setNotice(data.message || "Chat access denied.", true);
        });

        socket.on("conversationJoined", data => {
            console.log("Authorized conversation:", data.conversationId);
        });

        socket.on("connect", () => {
            statusElement.textContent = "Live connection ready";
            if (conversationId) {
                socket.emit("joinConversation", conversationId);
            }
        });

        socket.on("connect_error", () => {
            statusElement.textContent = "Live connection unavailable";
        });

        socket.on("newMessage", message => {
            if (Number(message.conversation_id) === Number(conversationId)) {
                renderMessage(message);
            }

            scheduleConversationRefresh();
        });

        socket.on("userTyping", data => {
            if (Number(data.conversation_id) !== Number(conversationId)) return;
            if (Number(data.user_id) === Number(user.id)) return;
            setNotice(`${data.username || "Someone"} is typing...`);
        });

        socket.on("userStoppedTyping", data => {
            if (Number(data.conversation_id) === Number(conversationId)) {
                setNotice("Messages are saved to NEXUS.");
            }
        });
    }

    async function loadConversation(id, title, description) {
        conversationId = Number(id);
        activeConversationKey = String(id);

        $("chatTitle").textContent = title;
        subtitle.textContent = description;
        input.disabled = false;
        sendButton.disabled = false;
        input.placeholder = "Write a message...";
        statusElement.textContent = "Loading messages...";

        renderedMessageIds.clear();
        showWelcome("Loading messages...");

        const history = await apiRequest(`/api/chat/${conversationId}/messages`);
        messagesElement.replaceChildren();

        if (!history.messages.length) {
            showWelcome("No messages yet. Start the conversation!");
        } else {
            history.messages.forEach(renderMessage);
        }

        highlightRequestedMessage();

        if (socket && socket.connected) {
            socket.emit("joinConversation", conversationId);
        }

        statusElement.textContent = socket?.connected
            ? "Live connection ready"
            : "Connecting...";
    }

    async function openProjectChat(id) {
        const projectData = await apiRequest(`/api/projects/${id}`);
        const chatData = await apiRequest(`/api/chat/project/${id}`);

        await loadConversation(
            chatData.conversation.id,
            projectData.project.name,
            "Project conversation"
        );
    }

    async function openDirectChat(id) {
        const data = await apiRequest(`/api/chat/direct/${id}`);

        await loadConversation(
            data.conversation.id,
            data.user.name || data.user.username,
            `Direct message · @${data.user.username}`
        );

        params.set("userId", String(id));
        params.delete("projectId");
        const query = params.toString();
        window.history.replaceState(
            {},
            document.title,
            window.location.pathname + (query ? `?${query}` : "")
        );
    }

    function renderUsers(users) {
        userResults.replaceChildren();

        if (!users.length) {
            searchNotice.textContent = "No users found. Try another name or username.";
            return;
        }

        searchNotice.textContent = `${users.length} user(s) found.`;

        for (const person of users) {
            const row = document.createElement("div");
            row.className = "person";

            const details = document.createElement("div");
            const name = document.createElement("strong");
            name.textContent = person.name || person.username;
            const username = document.createElement("small");
            username.textContent = `@${person.username}`;

            details.append(name, username);

            const button = document.createElement("button");
            button.type = "button";
            button.textContent = "Message";

            button.addEventListener("click", async () => {
                button.disabled = true;
                try {
                    await openDirectChat(person.id);
                    setNotice(`Conversation with @${person.username} is ready.`);
                } catch (error) {
                    setNotice(error.message, true);
                } finally {
                    button.disabled = false;
                }
            });

            row.append(details, button);
            userResults.appendChild(row);
        }
    }

    searchForm.addEventListener("submit", async event => {
        event.preventDefault();
        const query = searchInput.value.trim();

        if (query.length < 2) {
            searchNotice.textContent = "Enter at least 2 characters.";
            return;
        }

        searchNotice.textContent = "Searching...";
        userResults.replaceChildren();

        try {
            const data = await apiRequest(
                `/api/chat/users?q=${encodeURIComponent(query)}`
            );
            renderUsers(data.users);
        } catch (error) {
            searchNotice.textContent = error.message;
        }
    });

    input.addEventListener("input", () => {
        if (!socket || !conversationId) return;

        socket.emit("typing", { conversation_id: conversationId });
        clearTimeout(typingTimer);

        typingTimer = setTimeout(() => {
            socket.emit("stopTyping", { conversation_id: conversationId });
        }, 1000);
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const content = input.value.trim();

        if (!content || !conversationId || sending) return;

        sending = true;
        sendButton.disabled = true;

        try {
            const data = await apiRequest(
                `/api/chat/${conversationId}/messages`,
                {
                    method: "POST",
                    body: JSON.stringify({ content })
                }
            );

            renderMessage(data.message);
            input.value = "";
            setNotice("Message sent and saved.");
            scheduleConversationRefresh();
        } catch (error) {
            setNotice(error.message || "Unable to send message.", true);
        } finally {
            sending = false;
            sendButton.disabled = !conversationId;
            input.focus();
        }
    });

    async function loadConversations() {
        if (!conversationList) return;

        try {
            const data = await apiRequest("/api/chat/conversations");
            const conversations = data.conversations || [];

            conversationList.replaceChildren();

            if (!conversations.length) {
                const empty = document.createElement("p");
                empty.className = "conversation-empty";
                empty.textContent =
                    "No conversations yet. Search for a user or open a project chat.";
                conversationList.appendChild(empty);
                return;
            }

            for (const item of conversations) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "conversation-item";

                const isProject = item.type === "project";
                const isActive =
                    Number(item.conversation_id) === Number(conversationId);

                if (isActive) {
                    button.classList.add("active");
                }

                const title = document.createElement("span");
                title.className = "conversation-title";
                title.textContent =
                    `${isProject ? "🚀 " : "💬 "}${item.title || "Conversation"}`;

                const preview = document.createElement("span");
                preview.className = "conversation-preview";

                if (item.last_message) {
                    const prefix =
                        Number(item.last_sender_id) === Number(user.id)
                            ? "You: "
                            : "";

                    preview.textContent = prefix + item.last_message;
                } else {
                    preview.textContent = "No messages yet";
                }

                button.append(title, preview);

                button.addEventListener("click", async () => {
                    button.disabled = true;

                    try {
                        if (isProject && item.project_id) {
                            const url =
                                `/chat.html?projectId=${encodeURIComponent(item.project_id)}`;

                            window.location.href = url;
                            return;
                        }

                        if (!isProject && item.other_user_id) {
                            await openDirectChat(item.other_user_id);
                            await loadConversations();
                            setNotice("Conversation opened.");
                        }
                    } catch (error) {
                        setNotice(error.message, true);
                    } finally {
                        button.disabled = false;
                    }
                });

                conversationList.appendChild(button);
            }
        } catch (error) {
            console.error("Load conversations error:", error);

            conversationList.replaceChildren();

            const message = document.createElement("p");
            message.className = "conversation-empty error";
            message.textContent = "Unable to load conversations. Refresh to retry.";
            conversationList.appendChild(message);
        }
    }

    function scheduleConversationRefresh() {
        clearTimeout(conversationRefreshTimer);

        conversationRefreshTimer = setTimeout(() => {
            loadConversations();
        }, 300);
    }

    async function initializeChat() {
        connectSocket();
        loadConversations();

        if (projectId && Number.isInteger(projectId) && projectId > 0) {
            peoplePanel.classList.add("hidden");
            try {
                await openProjectChat(projectId);
            } catch (error) {
                console.error(error);
                statusElement.textContent = "Unable to connect";
                showError(error.message);
            }
            return;
        }

        peoplePanel.classList.remove("hidden");

        if (directUserId && Number.isInteger(directUserId) && directUserId > 0) {
            try {
                await openDirectChat(directUserId);
            } catch (error) {
                console.error(error);
                showError(error.message);
                setNotice(error.message, true);
            }
        } else {
            $("chatTitle").textContent = "Direct Messages";
            subtitle.textContent = "Search for a user to start a conversation.";
            showWelcome("Search for a NEXUS user, then select Message to open a private conversation.");
        }
    }

    initializeChat();
})();