const multer = require("multer");
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const http = require("http");
const { Server } = require("socket.io");

require("dotenv").config();

const app = express();

const upload = multer({
    storage: multer.memoryStorage(),
});

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
    },
});

const PORT = process.env.PORT || 5000;
const PYTHON_API_URL =
    process.env.PYTHON_API_URL ||
    "http://127.0.0.1:5001";

app.use(
    cors({
        origin: "http://localhost:5173",
    })
);

app.use(express.json());

/*
|--------------------------------------------------------------------------
| Socket.IO Connection
|--------------------------------------------------------------------------
*/

io.on("connection", (socket) => {
    console.log(
        `🔌 Socket connected: ${socket.id}`
    );

    socket.emit("agent:status", {
        state: "ready",
        message: "Lolo is ready.",
    });

    socket.on("disconnect", () => {
        console.log(
            `🔌 Socket disconnected: ${socket.id}`
        );
    });
});

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

app.get("/api/health", (req, res) => {
    res.json({
        status: "online",
        service: "Lolo Node Backend",
    });
});

/*
|--------------------------------------------------------------------------
| System Status
|--------------------------------------------------------------------------
*/

app.get("/api/status", async (req, res) => {
    const status = {
        node: {
            status: "online",
            service: "Lolo Node Backend",
        },

        python: {
            status: "offline",
            service: "Lolo Python AI",
        },

        llama: {
            status: "offline",
            service: "Llama 3.1",
        },
    };

    try {
        const pythonResponse = await axios.get(
            `${PYTHON_API_URL}/api/health`,
            {
                timeout: 5000,
            }
        );

        status.python = {
            status:
                pythonResponse.data.status === "online"
                    ? "online"
                    : "offline",
            service: pythonResponse.data.service,
            agent_loaded:
                pythonResponse.data.agent_loaded,
        };
    } catch (error) {
        console.log(
            "Python status check failed:",
            error.message
        );
    }

    try {
        const llamaResponse = await axios.get(
            "http://127.0.0.1:8000/v1/models",
            {
                timeout: 5000,
            }
        );

        const models =
            llamaResponse.data?.data || [];

        status.llama = {
            status:
                models.length > 0
                    ? "online"
                    : "offline",
            service: "Llama 3.1",
            model:
                models.length > 0
                    ? models[0].id
                    : null,
        };
    } catch (error) {
        console.log(
            "Llama status check failed:",
            error.message
        );
    }

    const allOnline =
        status.python.status === "online" &&
        status.llama.status === "online";

    res.json({
        overall: allOnline
            ? "online"
            : "degraded",
        services: status,
    });
});

/*
|--------------------------------------------------------------------------
| Agent Activity Relay
|--------------------------------------------------------------------------
*/

app.post("/api/agent-status", (req, res) => {
    const {
        state,
        message,
        tool,
    } = req.body;

    io.emit("agent:status", {
        state,
        message,
        tool: tool || null,
    });

    res.json({
        success: true,
    });
});

/*
|--------------------------------------------------------------------------
| Chat Endpoint
|--------------------------------------------------------------------------
*/

app.post("/api/chat", async (req, res) => {
    try {
        const { message } = req.body;

        if (
            !message ||
            typeof message !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid message is required.",
            });
        }

        console.log(
            `User: ${message}`
        );

        io.emit("agent:status", {
            state: "processing",
            message:
                "Lolo is processing your request.",
        });

        const response = await axios.post(
            `${PYTHON_API_URL}/api/chat`,
            {
                message,
            },
            {
                timeout: 120000,
            }
        );

        res.json({
            success: true,
            response:
                response.data.response,
        });

        io.emit("agent:status", {
            state: "completed",
            message:
                "Lolo completed the response.",
        });
    } catch (error) {
        console.error(
            "Python API Error:",
            error.message
        );

        io.emit("agent:status", {
            state: "error",
            message:
                "Lolo encountered an error.",
        });

        res.status(500).json({
            success: false,
            message:
                "Lolo AI service is unavailable.",
            error: error.message,
        });
    }
});

/*
|--------------------------------------------------------------------------
| Voice Transcription
|--------------------------------------------------------------------------
*/

app.post(
    "/api/voice/transcribe",
    upload.single("audio"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message:
                        "No audio file received.",
                });
            }

            console.log(
                `🎤 Voice received: ${req.file.originalname}`
            );

            const formData = new FormData();

            const audioBlob = new Blob(
                [req.file.buffer],
                {
                    type:
                        req.file.mimetype ||
                        "audio/webm",
                }
            );

            formData.append(
                "audio",
                audioBlob,
                req.file.originalname ||
                "voice.webm"
            );

            const response = await axios.post(
                `${PYTHON_API_URL}/api/voice/transcribe`,
                formData,
                {
                    timeout: 120000,
                }
            );

            res.json({
                success: true,
                transcript:
                    response.data.transcript,
            });
        } catch (error) {
            console.error(
                "❌ Voice API Error:",
                error.message
            );

            res.status(500).json({
                success: false,
                message:
                    "Voice transcription service is unavailable.",
                error: error.message,
            });
        }
    }
);

// -----------------------------------------
// VOICE - TEXT TO SPEECH
// -----------------------------------------
app.post("/api/voice/speak", async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({
                success: false,
                error: "Text cannot be empty."
            });
        }

        const response = await axios.post(
            `${PYTHON_API_URL}/api/voice/speak`,
            { text },
            {
                responseType: "arraybuffer",
                timeout: 120000
            }
        );

        res.set("Content-Type", "audio/wav");
        res.send(response.data);

    } catch (error) {
        console.error(
            "❌ TTS proxy error:",
            error.response?.data || error.message
        );

        res.status(500).json({
            success: false,
            error: "Failed to generate speech."
        });
    }
});

// -----------------------------------------
// VOICE - STARTUP GREETING
// -----------------------------------------
app.get("/api/voice/greeting", async (req, res) => {
    try {
        const response = await axios.get(
            `${PYTHON_API_URL}/api/voice/greeting`,
            {
                timeout: 120000
            }
        );

        res.json(response.data);

    } catch (error) {
        console.error(
            "❌ Greeting proxy error:",
            error.response?.data || error.message
        );

        res.status(500).json({
            success: false,
            error: "Failed to generate startup greeting."
        });
    }
});

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

const server = httpServer.listen(
    PORT,
    "127.0.0.1",
    () => {
        console.log(
            `🚀 Lolo Node Backend running on http://127.0.0.1:${PORT}`
        );

        console.log(
            "🔌 Socket.IO real-time server ready."
        );
    }
);

server.on("error", (error) => {
    console.error(
        "❌ Server error:",
        error
    );
});