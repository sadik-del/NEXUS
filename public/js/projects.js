const token = localStorage.getItem("nexusToken");
const user = JSON.parse(localStorage.getItem("nexusUser") || "null");

if (!token) {
    window.location.href = "/auth.html";
}

let currentProjectId = null;
let editingTaskId = null;
let currentTaskStatus = "todo";

const projectsSection = document.getElementById("projectsSection");
const workspace = document.getElementById("workspace");

const projectsGrid = document.getElementById("projectsGrid");

const projectModal = document.getElementById("projectModal");
const taskModal = document.getElementById("taskModal");

const projectMessage = document.getElementById("projectMessage");
const taskMessage = document.getElementById("taskMessage");


// ==============================
// USER
// ==============================

function loadUser() {

    if (!user) return;

    const name = user.name || user.username || "User";

    document.getElementById("userName").textContent = name;

    document.getElementById("userUsername").textContent =
        "@" + (user.username || "user");

    document.getElementById("userAvatar").textContent =
        name.charAt(0).toUpperCase();
}


// ==============================
// API HEADERS
// ==============================

function headers() {

    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };

}


// ==============================
// LOAD PROJECTS
// ==============================

async function loadProjects() {

    try {

        const response = await fetch("/api/projects", {
            headers: headers()
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message);
        }

        renderProjects(data.projects);

    } catch (error) {

        console.error(error);

        projectsGrid.innerHTML = `
            <div class="empty">
                Unable to load projects.
            </div>
        `;

    }

}


// ==============================
// RENDER PROJECTS
// ==============================

function renderProjects(projects) {

    if (!projects.length) {

        projectsGrid.innerHTML = `
            <div class="empty">
                <h3>No projects yet</h3>
                <p>Create your first project to start collaborating.</p>
            </div>
        `;

        return;
    }


    projectsGrid.innerHTML = projects.map(project => {

        const isOwner =
            Number(project.owner_id) === Number(user.id);

        const isMember =
            project.is_member;


        let actionButton = "";

        if (isOwner) {

            actionButton = `
                <button
                    class="delete-btn"
                    onclick="deleteProject(${project.id})">
                    Delete
                </button>
            `;

        } else if (isMember) {

            actionButton = `
                <button
                    onclick="leaveProject(${project.id})">
                    Leave
                </button>
            `;

        } else {

            actionButton = `
                <button
                    onclick="joinProject(${project.id})">
                    Join
                </button>
            `;

        }


        return `
            <div class="project-card">

                <h3>
                    ${escapeHTML(project.name)}
                </h3>

                <p>
                    ${escapeHTML(
                        project.description || "No description"
                    )}
                </p>

                <div class="project-meta">

                    <span>
                        👥 ${project.member_count} members
                    </span>

                    <span>
                        ${escapeHTML(project.status)}
                    </span>

                </div>

                <div class="project-actions">

                    <button
                        class="open-btn"
                        onclick="openProject(${project.id})">
                        Open Workspace
                    </button>

                    ${actionButton}

                </div>

            </div>
        `;

    }).join("");

}


// ==============================
// CREATE PROJECT
// ==============================

document
    .getElementById("createProjectBtn")
    .addEventListener("click", () => {

        projectMessage.textContent = "";

        projectModal.style.display = "flex";

    });


document
    .getElementById("closeProjectModal")
    .addEventListener("click", closeProjectModal);


function closeProjectModal() {

    projectModal.style.display = "none";

    document.getElementById("projectName").value = "";

    document.getElementById("projectDescription").value = "";

    projectMessage.textContent = "";

}


// SAVE PROJECT

document
    .getElementById("saveProject")
    .addEventListener("click", async () => {

        const name =
            document.getElementById("projectName").value.trim();

        const description =
            document.getElementById("projectDescription").value.trim();

        const status =
            document.getElementById("projectStatus").value;


        if (!name) {

            projectMessage.textContent =
                "Project name is required.";

            return;

        }


        try {

            const response = await fetch("/api/projects", {

                method: "POST",

                headers: headers(),

                body: JSON.stringify({
                    name,
                    description,
                    status
                })

            });


            const data = await response.json();


            if (!response.ok) {

                projectMessage.textContent =
                    data.message || "Unable to create project";

                return;

            }


            closeProjectModal();

            loadProjects();

        } catch (error) {

            console.error(error);

            projectMessage.textContent =
                "Server error.";

        }

    });


// ==============================
// JOIN PROJECT
// ==============================

async function joinProject(projectId) {

    try {

        const response = await fetch(
            `/api/projects/${projectId}/join`,
            {
                method: "POST",
                headers: headers()
            }
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.message);
            return;
        }

        loadProjects();

    } catch (error) {

        console.error(error);

    }

}


// ==============================
// LEAVE PROJECT
// ==============================

async function leaveProject(projectId) {

    if (!confirm("Leave this project?")) {
        return;
    }

    try {

        const response = await fetch(
            `/api/projects/${projectId}/leave`,
            {
                method: "DELETE",
                headers: headers()
            }
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.message);
            return;
        }

        loadProjects();

    } catch (error) {

        console.error(error);

    }

}


// ==============================
// DELETE PROJECT
// ==============================

async function deleteProject(projectId) {

    if (!confirm("Delete this project permanently?")) {
        return;
    }

    try {

        const response = await fetch(
            `/api/projects/${projectId}`,
            {
                method: "DELETE",
                headers: headers()
            }
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.message);
            return;
        }

        loadProjects();

    } catch (error) {

        console.error(error);

    }

}


// ==============================
// OPEN PROJECT WORKSPACE
// ==============================

async function openProject(projectId) {

    try {

        const response = await fetch(
            `/api/projects/${projectId}`,
            {
                headers: headers()
            }
        );

        const data = await response.json();

        if (!response.ok) {

            alert(data.message);

            return;
        }


        currentProjectId = projectId;


        document.getElementById("workspaceTitle")
            .textContent = data.project.name;


        document.getElementById("workspaceDescription")
            .textContent =
            data.project.description ||
            "Project workspace";


        projectsSection.style.display = "none";

        workspace.style.display = "block";


        await loadTasks();

    } catch (error) {

        console.error(error);

        alert("Unable to open project.");

    }

}


// ==============================
// BACK TO PROJECTS
// ==============================

document
    .getElementById("backToProjects")
    .addEventListener("click", () => {

        workspace.style.display = "none";

        projectsSection.style.display = "block";

        currentProjectId = null;

        loadProjects();

    });


// ==============================
// LOAD TASKS
// ==============================

async function loadTasks() {

    if (!currentProjectId) return;

    try {

        const response = await fetch(
            `/api/tasks/${currentProjectId}`,
            {
                headers: headers()
            }
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.message);
            return;
        }

        renderTasks(data.tasks);
        highlightRequestedTask();

    } catch (error) {

        console.error(error);

    }

}


// ==============================
// RENDER TASKS
// ==============================

function renderTasks(tasks) {

    const todo =
        document.getElementById("todoTasks");

    const progress =
        document.getElementById("progressTasks");

    const completed =
        document.getElementById("completedTasks");


    todo.innerHTML = "";
    progress.innerHTML = "";
    completed.innerHTML = "";


    let todoCount = 0;
    let progressCount = 0;
    let completedCount = 0;


    tasks.forEach(task => {

        const card = createTaskCard(task);


        if (task.status === "todo") {

            todo.innerHTML += card;

            todoCount++;

        } else if (task.status === "in_progress") {

            progress.innerHTML += card;

            progressCount++;

        } else {

            completed.innerHTML += card;

            completedCount++;

        }

    });


    document.getElementById("todoCount")
        .textContent = todoCount;

    document.getElementById("progressCount")
        .textContent = progressCount;

    document.getElementById("completedCount")
        .textContent = completedCount;

}


// ==============================
// TASK CARD
// ==============================

function createTaskCard(task) {

    return `
        <div class="task-card" id="task-${Number(task.id)}">

            <h4>
                ${escapeHTML(task.title)}
            </h4>

            ${
                task.description
                    ? `<p>${escapeHTML(task.description)}</p>`
                    : ""
            }

            <div class="task-footer">

                <span class="priority">
                    ${escapeHTML(task.priority)}
                </span>

                <div class="task-buttons">

                    <button
                        onclick="editTask(${task.id})">
                        Edit
                    </button>

                    <button
                        onclick="deleteTask(${task.id})">
                        Delete
                    </button>

                </div>

            </div>

        </div>
    `;

}


// ==============================
// LOAD PROJECT MEMBERS
// ==============================

async function loadProjectMembers(selectedUserId = "") {
    const assigneeSelect = document.getElementById("taskAssignee");

    assigneeSelect.innerHTML = `
        <option value="">Unassigned</option>
    `;

    if (!currentProjectId) return;

    try {
        const response = await fetch(
            `/api/projects/${currentProjectId}/members`,
            { headers: headers() }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to load members");
        }

        data.members.forEach(member => {
            const option = document.createElement("option");

            option.value = member.id;
            option.textContent =
                `${member.name || member.username} (@${member.username})`;

            assigneeSelect.appendChild(option);
        });

        assigneeSelect.value = selectedUserId
            ? String(selectedUserId)
            : "";

    } catch (error) {
        console.error("Load project members error:", error);

        taskMessage.textContent =
            "Unable to load project members. Please try again.";
    }
}



// ==============================
// ADD TASK BUTTONS
// ==============================

document
    .querySelectorAll(".add-task-btn")
    .forEach(button => {

        button.addEventListener("click", async () => {

            currentTaskStatus =
                button.dataset.status;

            editingTaskId = null;

            document.getElementById("taskModalTitle")
                .textContent = "Create Task";

            document.getElementById("saveTask")
                .textContent = "Create Task";

            document.getElementById("taskTitle")
                .value = "";

            document.getElementById("taskDescription")
                .value = "";

            document.getElementById("taskStatus")
                .value = currentTaskStatus;

            document.getElementById("taskPriority")
                .value = "medium";

            // Reset and load project members for assignment
            document.getElementById("taskAssignee").value = "";

            await loadProjectMembers();

            taskMessage.textContent = "";

            taskModal.style.display = "flex";

        });

    });


// ==============================
// CLOSE TASK MODAL
// ==============================

document
    .getElementById("closeTaskModal")
    .addEventListener("click", () => {

        taskModal.style.display = "none";

    });


// ==============================
// SAVE TASK
// ==============================

document
    .getElementById("saveTask")
    .addEventListener("click", async () => {

        const title =
            document.getElementById("taskTitle")
                .value.trim();

        const description =
            document.getElementById("taskDescription")
                .value.trim();

        const status =
            document.getElementById("taskStatus")
                .value;

        const priority =
            document.getElementById("taskPriority")
                .value;


        if (!title) {

            taskMessage.textContent =
                "Task title is required.";

            return;

        }


        try {

            const method =
                editingTaskId ? "PUT" : "POST";


            const url =
                editingTaskId
                    ? `/api/tasks/${editingTaskId}`
                    : `/api/tasks/${currentProjectId}`;


            const response = await fetch(url, {

                method,

                headers: headers(),

                body: JSON.stringify({
                    title,
                    description,
                    status,
                    priority,
                    assigned_to:
                        document.getElementById("taskAssignee").value || null
                })

            });


            const data = await response.json();


            if (!response.ok) {

                taskMessage.textContent =
                    data.message ||
                    "Unable to save task";

                return;

            }


            taskModal.style.display = "none";

            editingTaskId = null;

            loadTasks();

        } catch (error) {

            console.error(error);

            taskMessage.textContent =
                "Server error.";

        }

    });


// ==============================
// EDIT TASK
// ==============================

async function editTask(taskId) {

    try {

        const response = await fetch(
            `/api/tasks/${currentProjectId}`,
            {
                headers: headers()
            }
        );

        const data = await response.json();

        const task =
            data.tasks.find(
                item => Number(item.id) === Number(taskId)
            );


        if (!task) return;


        editingTaskId = task.id;


        document.getElementById("taskModalTitle")
            .textContent = "Edit Task";


        document.getElementById("saveTask")
            .textContent = "Save Changes";


        document.getElementById("taskTitle")
            .value = task.title;


        document.getElementById("taskDescription")
            .value = task.description || "";


        document.getElementById("taskStatus")
            .value = task.status;


        document.getElementById("taskPriority")
            .value = task.priority;

        
        await loadProjectMembers(task.assigned_to);

        taskMessage.textContent = "";

        taskModal.style.display = "flex";

    } catch (error) {

        console.error(error);

    }

}


// ==============================
// DELETE TASK
// ==============================

async function deleteTask(taskId) {

    if (!confirm("Delete this task?")) {
        return;
    }


    try {

        const response = await fetch(
            `/api/tasks/${taskId}`,
            {
                method: "DELETE",
                headers: headers()
            }
        );


        const data = await response.json();


        if (!response.ok) {

            alert(data.message);

            return;

        }


        loadTasks();

    } catch (error) {

        console.error(error);

    }

}


// ==============================
// ESCAPE HTML
// ==============================

function escapeHTML(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}



// ==============================
// START
// ==============================

loadUser();

const initialParams = new URLSearchParams(window.location.search);
const requestedProjectId = initialParams.get("projectId");
const requestedTaskId = initialParams.get("taskId");

loadProjects().then(async () => {
    if (!requestedProjectId) return;

    const projectId = Number(requestedProjectId);

    if (!Number.isInteger(projectId) || projectId <= 0) {
        return;
    }

    // Keep taskId in the URL until the task has been highlighted.
    // Remove projectId so the project list won't reopen automatically.
    initialParams.delete("projectId");

    const remainingQuery = initialParams.toString();

    window.history.replaceState(
        {},
        document.title,
        window.location.pathname +
            (remainingQuery ? `?${remainingQuery}` : "")
    );

    await openProject(projectId);
});

document
    .getElementById("openProjectChat")
    ?.addEventListener("click", () => {
        if (!currentProjectId) {
            alert("Please open a project first.");
            return;
        }

        window.location.href =
            `/chat.html?projectId=${encodeURIComponent(currentProjectId)}`;
    });