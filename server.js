const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const { testDatabase, pool } = require("./server/db");
const { initializeDatabase } = require("./server/database");

const authRoutes = require("./server/routes/authRoutes");
const communityRoutes = require("./server/routes/communityRoutes");
const postRoutes = require("./server/routes/postRoutes");
const projectRoutes = require("./server/routes/projectRoutes");
const taskRoutes = require("./server/routes/taskRoutes");
const chatRoutes = require("./server/routes/chatRoutes");
const notificationRoutes =
    require("./server/routes/notificationRoutes");
    
const searchRoutes =
    require("./server/routes/searchRoutes");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

const PORT = process.env.PORT || 5000;


// ==============================
// SOCKET.IO AVAILABLE TO API
// ==============================

app.set("io", io);
global.nexusIO = io;

// ==============================
// MIDDLEWARE
// ==============================

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

app.use(
    "/api/notifications",
    notificationRoutes
);

// ==============================
// API ROUTES
// ==============================

app.use("/api/auth", authRoutes);
app.use("/api/communities", communityRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/search", searchRoutes);

// ==============================
// SERVE FRONTEND
// ==============================

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

app.get("/debug-files", (req, res) => {
    const fs = require("fs");

    res.json({
        projectDirectory: __dirname,
        publicDirectory: path.join(__dirname, "public"),
        communitiesExists: fs.existsSync(
            path.join(__dirname, "public", "communities.html")
        )
    });
});


// ==============================
// TEST API
// ==============================

app.get("/api/status", (req, res) => {

    res.json({
        success: true,
        message: "NEXUS server is running 🚀"
    });

});


// ==============================
// SOCKET.IO AUTHENTICATION
// ==============================

io.use((socket, next) => {

    try {

        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(
                new Error("Authentication required")
            );
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        socket.user = {
            id: decoded.id
        };

        next();

    } catch (error) {

        console.error(
            "Socket authentication failed:",
            error.message
        );

        next(
            new Error("Invalid or expired token")
        );
    }

});


// ==============================
// SOCKET.IO REAL-TIME CHAT
// ==============================

io.on("connection", (socket) => {
    socket.join(`user_${socket.user.id}`);

    console.log(
        `🔔 User ${socket.user.id} joined notification room`
    );

    console.log(
        `💬 Authenticated chat user ${socket.user.id} connected`
    );

// ==============================
// TYPING INDICATOR
// ==============================

socket.on("typing", async (data) => {

    try {

        const conversationId =
            Number(data.conversation_id);

        if (!Number.isInteger(conversationId)) {
            return;
        }

        const membership = await pool.query(
            `
            SELECT id
            FROM conversation_members
            WHERE conversation_id = $1
            AND user_id = $2
            `,
            [
                conversationId,
                socket.user.id
            ]
        );

        if (membership.rows.length === 0) {
            return;
        }

        const userResult = await pool.query(
    `
            SELECT username
            FROM users
            WHERE id = $1
            `,
            [socket.user.id]
        );

        const username =
            userResult.rows[0]?.username || "Someone";

        socket.to(
            `conversation_${conversationId}`
        ).emit("userTyping", {
            conversation_id: conversationId,
            user_id: socket.user.id,
            username
        });
    } catch (error) {

        console.error(
            "Typing error:",
            error.message
        );

    }

});


socket.on("stopTyping", (data) => {

    const conversationId =
        Number(data.conversation_id);

    if (!Number.isInteger(conversationId)) {
        return;
    }

    socket.to(
        `conversation_${conversationId}`
    ).emit("userStoppedTyping", {
        conversation_id: conversationId,
        user_id: socket.user.id
    });

});


    // ==============================
    // JOIN CONVERSATION
    // ==============================

    socket.on("joinConversation", async (conversationId) => {

        try {

            const id = Number(conversationId);

            if (!Number.isInteger(id) || id <= 0) {

                socket.emit("chatError", {
                    message: "Invalid conversation"
                });

                return;
            }


            // Check whether the user
            // belongs to this conversation

            const membership = await pool.query(
                `
                SELECT id
                FROM conversation_members
                WHERE conversation_id = $1
                AND user_id = $2
                `,
                [
                    id,
                    socket.user.id
                ]
            );


            // User is NOT a member

            if (membership.rows.length === 0) {

                socket.emit("chatError", {
                    message:
                        "You are not a member of this conversation."
                });

                console.log(
                    `🚫 User ${socket.user.id} denied access to conversation ${id}`
                );

                return;
            }


            // User is authorized

            socket.join(
                `conversation_${id}`
            );


            socket.emit(
                "conversationJoined",
                {
                    conversationId: id
                }
            );


            console.log(
                `👥 User ${socket.user.id} joined conversation ${id}`
            );

        } catch (error) {

            console.error(
                "Join conversation error:",
                error.message
            );

            socket.emit("chatError", {
                message:
                    "Unable to join conversation."
            });

        }

    });


    // ==============================
    // DISCONNECT
    // ==============================

    socket.on("disconnect", () => {

        console.log(
            `💬 Chat user ${socket.user.id} disconnected`
        );

    });

});


// ==============================
// START SERVER
// ==============================

server.listen(PORT, async () => {

    console.log("");

    console.log("=================================");

    console.log("       NEXUS SERVER");

    console.log("=================================");

    console.log(
        `🚀 Server: http://localhost:${PORT}`
    );


    // ==============================
    // TEST DATABASE
    // ==============================

    await testDatabase();


    // ==============================
    // INITIALIZE DATABASE
    // ==============================

    await initializeDatabase();


    console.log("=================================");

    console.log("");

});