const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// Import UI controller routes
const organizationUi = require("./routes/uiController");
const chatHistoryRouter = require("./routes/chatHistory");
const call = require("./routes/callController");
const userDetail = require("./routes/userDetail");
const { generateAIResponse, generateVoiceResponse } = require("./rasa");

// Configure CORS for Socket.IO with environment-aware origins
const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? [process.env.FRONTEND_URL || "https://your-domain.vercel.app"]
    : [
        "http://localhost:3000",
        "http://172.18.32.1:3000",
        "file:///D:/Projects/Bots/chat-bot/embed-example.html",
        "http://localhost:5500",
      ];

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());

// Health check endpoint for Vercel
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Use UI controller routes
app.use("/rest/v1/ui", organizationUi);
app.use("/rest/v1/chat", chatHistoryRouter);
app.use("/rest/v1/call", call);
app.use("/rest/v1/user", userDetail);

// Store active sessions
const activeSessions = new Map();

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Store session
  activeSessions.set(socket.id, {
    connectedAt: new Date(),
    messageCount: 0,
  });

  socket.on("user-message", async (data) => {
    const { message, details, sender, source, userDetails, attachment } = data;
    console.log(`Message from ${sender}: ${message ? message : attachment}`);

    // Update session
    const session = activeSessions.get(socket.id);
    if (session) {
      session.messageCount++;
    }

    // Emit typing indicator
    socket.emit("bot-typing");

    try {
      // Generate AI response
      const aiResponse = await generateAIResponse(
        message,
        details,
        sender,
        source,
        userDetails,
        attachment
      );

      // Stop typing and send response
      socket.emit("bot-stop-typing");
      socket.emit("bot-message", aiResponse);
    } catch (error) {
      console.error("Error generating AI response:", error);
      socket.emit("bot-stop-typing");
      socket.emit("bot-message", {
        message: "I'm sorry, I encountered an error. Please try again.",
        messageId: Date.now().toString(),
      });
    }
  });

  socket.on("voice-message", async (data) => {
    const { audio, details, sender, source, filename, from_chatbot } = data;
    console.log(`Voice message from ${sender} of ${filename}`);

    // Update session
    const session = activeSessions.get(socket.id);
    if (session) {
      session.messageCount++;
    }

    // Emit typing indicator
    socket.emit("bot-typing");

    try {
      // Generate voice response
      const voiceResponse = await generateVoiceResponse(
        audio,
        details,
        sender,
        source,
        filename,
        from_chatbot
      );

      console.log(voiceResponse, "voice response after posting in dashboard");

      // Stop typing and send response
      socket.emit("bot-stop-typing");
      socket.emit("voice-response", voiceResponse);
    } catch (error) {
      console.error("Error generating voice response:", error);
      socket.emit("bot-stop-typing");
      socket.emit("bot-message", {
        message:
          "I'm sorry, I couldn't process your voice message. Please try again.",
        messageId: Date.now().toString(),
      });
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    activeSessions.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
