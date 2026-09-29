import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";

import Sidebar from "./components/Sidebar";
import LoloOrb from "./components/LoloOrb";
import ToolActivity from "./components/ToolActivity";

import "./App.css";

const API_URL = "http://127.0.0.1:5000";

function App() {
    const [activePage, setActivePage] = useState("dashboard");
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [agentState, setAgentState] = useState("ready");
    const [activities, setActivities] = useState([]);

    const [recording, setRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);

    const greetingStarted = useRef(false);
    const audioRef = useRef(null);
    const audioUrlRef = useRef(null);

    const [systemStatus, setSystemStatus] = useState({
        overall: "checking",
        services: {
            node: {
                status: "checking",
            },
            python: {
                status: "checking",
            },
            llama: {
                status: "checking",
            },
        },
    });

    /*
    |--------------------------------------------------------------------------
    | System Status Polling
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        const fetchSystemStatus = async () => {
            try {
                const response = await axios.get(
                    `${API_URL}/api/status`
                );

                setSystemStatus(response.data);
            } catch (error) {
                console.error(
                    "System status error:",
                    error
                );

                setSystemStatus({
                    overall: "offline",
                    services: {
                        node: {
                            status: "offline",
                        },
                        python: {
                            status: "offline",
                        },
                        llama: {
                            status: "offline",
                        },
                    },
                });
            }
        };

        fetchSystemStatus();

        const interval = setInterval(
            fetchSystemStatus,
            10000
        );

        return () => clearInterval(interval);
    }, []);

    /*
    |--------------------------------------------------------------------------
    | Socket.IO Agent Status
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        const socket = io(API_URL);

        socket.on("connect", () => {
            console.log(
                "🔌 Connected to Lolo Socket.IO:",
                socket.id
            );
        });

        socket.on("agent:status", (data) => {
            console.log(
                "🤖 Lolo status:",
                data
            );

            setAgentState(data.state);

            setActivities((previous) => [
                ...previous,
                {
                    state: data.state,
                    message: data.message,
                    tool: data.tool || null,
                    timestamp:
                        new Date().toISOString(),
                },
            ]);
        });

        socket.on("disconnect", () => {
            console.log(
                "🔌 Disconnected from Lolo Socket.IO"
            );

            setAgentState("error");
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    /*
    |--------------------------------------------------------------------------
    | Browser Audio / TTS
    |--------------------------------------------------------------------------
    */

    const stopCurrentAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }

        if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
        }
    };

    const speakText = async (text) => {
        const trimmedText = text?.trim();

        if (!trimmedText) {
            return;
        }

        try {
            stopCurrentAudio();

            setAgentState("speaking");

            console.log(
                "👄 Requesting Lolo TTS..."
            );

            const response = await axios.post(
                `${API_URL}/api/voice/speak`,
                {
                    text: trimmedText,
                },
                {
                    responseType: "blob",
                    timeout: 120000,
                }
            );

            const audioUrl =
                URL.createObjectURL(
                    response.data
                );

            audioUrlRef.current = audioUrl;

            const audio = new Audio(audioUrl);

            audioRef.current = audio;

            audio.onended = () => {
                console.log(
                    "👄 Lolo finished speaking."
                );

                if (
                    audioRef.current === audio
                ) {
                    audioRef.current = null;
                }

                if (
                    audioUrlRef.current ===
                    audioUrl
                ) {
                    URL.revokeObjectURL(
                        audioUrl
                    );
                    audioUrlRef.current =
                        null;
                }

                setAgentState("ready");
            };

            audio.onerror = (error) => {
                console.error(
                    "❌ Audio playback error:",
                    error
                );

                if (
                    audioRef.current === audio
                ) {
                    audioRef.current = null;
                }

                if (
                    audioUrlRef.current ===
                    audioUrl
                ) {
                    URL.revokeObjectURL(
                        audioUrl
                    );
                    audioUrlRef.current =
                        null;
                }

                setAgentState("ready");
            };

            await audio.play();

            console.log(
                "🔊 Lolo is speaking..."
            );
        } catch (error) {
            console.error(
                "❌ Browser TTS error:",
                error
            );

            /*
             * Chrome/Safari may block automatic
             * playback until the user interacts
             * with the page.
             */
            if (
                error?.name ===
                "NotAllowedError"
            ) {
                console.warn(
                    "🔊 Browser blocked automatic audio playback. Interact with the page and try again."
                );
            }

            stopCurrentAudio();
            setAgentState("ready");
        }
    };

    /*
    |--------------------------------------------------------------------------
    | Startup Greeting
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        if (greetingStarted.current) {
            return;
        }

        greetingStarted.current = true;

        const loadStartupGreeting =
            async () => {
                try {
                    console.log(
                        "👋 Requesting Lolo startup greeting..."
                    );

                    const response =
                        await axios.get(
                            `${API_URL}/api/voice/greeting`,
                            {
                                timeout: 120000,
                            }
                        );

                    const greeting =
                        response.data?.greeting?.trim();

                    if (!greeting) {
                        return;
                    }

                    console.log(
                        "👋 Lolo greeting:",
                        greeting
                    );

                    setMessages(
                        (previous) => [
                            ...previous,
                            {
                                role: "assistant",
                                content:
                                    greeting,
                            },
                        ]
                    );

                    await speakText(greeting);
                } catch (error) {
                    console.error(
                        "❌ Startup greeting error:",
                        error
                    );
                }
            };

        loadStartupGreeting();
    }, []);

    /*
    |--------------------------------------------------------------------------
    | Voice Recording
    |--------------------------------------------------------------------------
    */

    const startRecording = async () => {
        try {
            const stream =
                await navigator.mediaDevices.getUserMedia(
                    {
                        audio: true,
                    }
                );

            const recorder =
                new MediaRecorder(stream);

            const audioChunks = [];

            recorder.ondataavailable = (
                event
            ) => {
                if (event.data.size > 0) {
                    audioChunks.push(
                        event.data
                    );
                }
            };

            recorder.onstop = async () => {
                stream
                    .getTracks()
                    .forEach((track) =>
                        track.stop()
                    );

                const audioBlob = new Blob(
                    audioChunks,
                    {
                        type: "audio/webm",
                    }
                );

                console.log(
                    "🎤 Recording ready for transcription."
                );

                setAgentState(
                    "transcribing"
                );

                await sendVoiceAudio(
                    audioBlob
                );
            };

            recorder.start();

            console.log(
                "🎤 Recording started..."
            );

            setMediaRecorder(recorder);
            setRecording(true);
            setAgentState("listening");
        } catch (error) {
            console.error(
                "Microphone access error:",
                error
            );

            setRecording(false);
            setMediaRecorder(null);
            setAgentState("error");
        }
    };

    const stopRecording = () => {
        if (!mediaRecorder) {
            return;
        }

        console.log(
            "🎤 Recording stopped..."
        );

        setAgentState(
            "transcribing"
        );

        mediaRecorder.stop();

        setMediaRecorder(null);
        setRecording(false);
    };

    /*
    |--------------------------------------------------------------------------
    | Voice → Whisper → Same Lolo Chat Pipeline
    |--------------------------------------------------------------------------
    */

    const sendVoiceAudio = async (
        audioBlob
    ) => {
        try {
            const formData = new FormData();

            formData.append(
                "audio",
                audioBlob,
                "voice.webm"
            );

            console.log(
                "🎤 Sending audio for transcription..."
            );

            setAgentState(
                "transcribing"
            );

            const response =
                await axios.post(
                    `${API_URL}/api/voice/transcribe`,
                    formData,
                    {
                        timeout: 120000,
                    }
                );

            const transcript =
                response.data.transcript
                    ?.trim() || "";

            if (!transcript) {
                console.log(
                    "🎤 No speech detected."
                );

                setAgentState("ready");
                return;
            }

            console.log(
                "🎤 Transcript:",
                transcript
            );

            /*
            |--------------------------------------------------------------------------
            | Send the transcript through the SAME
            | Lolo chat pipeline used by typed messages.
            |--------------------------------------------------------------------------
            */

            await sendMessageToLolo(
                transcript
            );
        } catch (error) {
            console.error(
                "Voice processing error:",
                error
            );

            setAgentState("error");

            setMessages((previous) => [
                ...previous,
                {
                    role: "assistant",
                    content:
                        "I couldn't process the voice request.",
                },
            ]);
        }
    };

    /*
    |--------------------------------------------------------------------------
    | Send Message To Lolo
    |--------------------------------------------------------------------------
    */

    const sendMessageToLolo = async (
        userText
    ) => {
        const trimmedMessage =
            userText?.trim();

        if (
            !trimmedMessage ||
            loading
        ) {
            return;
        }

        const userMessage = {
            role: "user",
            content: trimmedMessage,
        };

        setMessages((previous) => [
            ...previous,
            userMessage,
        ]);

        setMessage("");
        setLoading(true);
        setAgentState("thinking");

        try {
            console.log(
                "🧠 Sending message to Lolo:",
                trimmedMessage
            );

            const response =
                await axios.post(
                    `${API_URL}/api/chat`,
                    {
                        message:
                            trimmedMessage,
                    },
                    {
                        timeout: 120000,
                    }
                );

            const responseText =
                response.data?.response?.trim() ||
                "I didn't receive a response.";

            console.log(
                "🤖 Lolo response:",
                responseText
            );

            const assistantMessage = {
                role: "assistant",
                content: responseText,
            };

            setMessages((previous) => [
                ...previous,
                assistantMessage,
            ]);

            /*
             * Wait for the voice response to
             * finish before returning to READY.
             */
            await speakText(
                responseText
            );
        } catch (error) {
            console.error(
                "Lolo connection error:",
                error
            );

            setMessages((previous) => [
                ...previous,
                {
                    role: "assistant",
                    content:
                        "I couldn't connect to the Lolo AI service. Please check that the backend services are running.",
                },
            ]);

            setAgentState("error");
        } finally {
            setLoading(false);
        }
    };

    /*
    |--------------------------------------------------------------------------
    | Typed Message
    |--------------------------------------------------------------------------
    */

    const sendMessage = async (
        event
    ) => {
        event.preventDefault();

        const trimmedMessage =
            message.trim();

        if (
            !trimmedMessage ||
            loading ||
            recording
        ) {
            return;
        }

        await sendMessageToLolo(
            trimmedMessage
        );
    };

    /*
    |--------------------------------------------------------------------------
    | Clear Conversation
    |--------------------------------------------------------------------------
    */

    const clearConversation = () => {
        stopCurrentAudio();

        setMessages([]);
        setActivities([]);
        setAgentState("ready");
    };

    /*
    |--------------------------------------------------------------------------
    | Orb State
    |--------------------------------------------------------------------------
    */

    const getOrbStatus = () => {
        if (
            agentState === "listening" ||
            agentState === "transcribing"
        ) {
            return "listening";
        }

        if (
            agentState === "speaking"
        ) {
            return "speaking";
        }

        if (
            agentState === "ready" ||
            agentState === "completed"
        ) {
            return "idle";
        }

        return "thinking";
    };

    return (
        <div className="app-shell">
            <Sidebar
                activePage={activePage}
                setActivePage={
                    setActivePage
                }
            />

            <main className="main-area">
                <header className="topbar">
                    <div>
                        <div className="page-label">
                            PERSONAL AI
                            ASSISTANT
                        </div>

                        <h1>
                            {activePage}
                        </h1>
                    </div>

                    <div className="topbar-status">
                        <span
                            className={`status-dot ${systemStatus.overall}`}
                        ></span>

                        SYSTEM{" "}
                        {systemStatus.overall.toUpperCase()}
                    </div>
                </header>

                {activePage ===
                    "dashboard" ||
                    activePage ===
                    "chat" ? (
                    <div className="dashboard-grid">
                        <section className="center-column">
                            <div className="hero-card">
                                <LoloOrb
                                    status={getOrbStatus()}
                                />

                                <h2>
                                    Lolo
                                </h2>

                                <p className="hero-description">
                                    Your local
                                    AI assistant
                                    powered by
                                    Llama 3.1,
                                    RAG and
                                    agent tools.
                                </p>
                            </div>

                            <section className="chat-card">
                                <div className="chat-header">
                                    <div>
                                        <div className="chat-title">
                                            Conversation
                                        </div>

                                        <div className="chat-subtitle">
                                            Connected
                                            to Lolo
                                            Agent
                                        </div>
                                    </div>

                                    {messages.length >
                                        0 && (
                                            <button
                                                type="button"
                                                className="clear-button"
                                                onClick={
                                                    clearConversation
                                                }
                                            >
                                                Clear
                                            </button>
                                        )}
                                </div>

                                <div className="messages">
                                    {messages.length ===
                                        0 && (
                                            <div className="empty-state">
                                                <div className="empty-state-title">
                                                    Hello,
                                                    Boss.
                                                </div>

                                                <div className="empty-state-text">
                                                    Ask Lolo
                                                    about
                                                    your
                                                    project,
                                                    architecture,
                                                    calculations,
                                                    current
                                                    information,
                                                    or
                                                    anything
                                                    else.
                                                </div>

                                                <div className="suggestion-row">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setMessage(
                                                                "What model does Lolo use?"
                                                            )
                                                        }
                                                    >
                                                        Ask
                                                        about
                                                        architecture
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setMessage(
                                                                "Calculate 25 * 40"
                                                            )
                                                        }
                                                    >
                                                        Try
                                                        calculator
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                    {messages.map(
                                        (
                                            item,
                                            index
                                        ) => (
                                            <div
                                                key={
                                                    index
                                                }
                                                className={`message-row ${item.role}`}
                                            >
                                                <div className="message-badge">
                                                    {item.role ===
                                                        "user"
                                                        ? "YOU"
                                                        : "LOLO"}
                                                </div>

                                                <div className="message-bubble">
                                                    {
                                                        item.content
                                                    }
                                                </div>
                                            </div>
                                        )
                                    )}

                                    {loading && (
                                        <div className="message-row assistant">
                                            <div className="message-badge">
                                                LOLO
                                            </div>

                                            <div className="message-bubble thinking-message">
                                                <span></span>
                                                <span></span>
                                                <span></span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <form
                                    className="input-area"
                                    onSubmit={
                                        sendMessage
                                    }
                                >
                                    <button
                                        type="button"
                                        className={`voice-button ${recording
                                                ? "recording"
                                                : ""
                                            }`}
                                        onClick={
                                            recording
                                                ? stopRecording
                                                : startRecording
                                        }
                                        disabled={
                                            loading
                                        }
                                    >
                                        {recording
                                            ? "Stop"
                                            : "Mic"}
                                    </button>

                                    <input
                                        type="text"
                                        value={message}
                                        onChange={(
                                            event
                                        ) =>
                                            setMessage(
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        placeholder="Talk to Lolo..."
                                        disabled={
                                            loading ||
                                            recording
                                        }
                                    />

                                    <button
                                        type="submit"
                                        disabled={
                                            loading ||
                                            recording
                                        }
                                    >
                                        {loading
                                            ? "Thinking"
                                            : "Send"}
                                    </button>
                                </form>
                            </section>
                        </section>

                        <aside className="right-column">
                            <ToolActivity
                                activities={
                                    activities
                                }
                            />

                            <section className="system-panel">
                                <div className="panel-heading">
                                    SYSTEM STATUS
                                </div>

                                <div className="system-list">
                                    <div className="system-row">
                                        <span>
                                            Node
                                            Backend
                                        </span>

                                        <strong
                                            className={
                                                systemStatus
                                                    .services
                                                    .node
                                                    .status
                                            }
                                        >
                                            {systemStatus.services.node.status.toUpperCase()}
                                        </strong>
                                    </div>

                                    <div className="system-row">
                                        <span>
                                            Python
                                            AI
                                        </span>

                                        <strong
                                            className={
                                                systemStatus
                                                    .services
                                                    .python
                                                    .status
                                            }
                                        >
                                            {systemStatus.services.python.status.toUpperCase()}
                                        </strong>
                                    </div>

                                    <div className="system-row">
                                        <span>
                                            Llama
                                            3.1 8B
                                        </span>

                                        <strong
                                            className={
                                                systemStatus
                                                    .services
                                                    .llama
                                                    .status
                                            }
                                        >
                                            {systemStatus.services.llama.status.toUpperCase()}
                                        </strong>
                                    </div>

                                    <div className="system-row">
                                        <span>
                                            FAISS
                                            RAG
                                        </span>

                                        <strong>
                                            READY
                                        </strong>
                                    </div>

                                    <div className="system-row">
                                        <span>
                                            Agent
                                            Tools
                                        </span>

                                        <strong>
                                            READY
                                        </strong>
                                    </div>
                                </div>
                            </section>
                        </aside>
                    </div>
                ) : (
                    <div className="placeholder-page">
                        <div className="placeholder-card">
                            <h2>
                                {activePage.replace(
                                    "-",
                                    " "
                                )}
                            </h2>

                            <p>
                                This section
                                will be
                                connected
                                in the next
                                development
                                phase.
                            </p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;