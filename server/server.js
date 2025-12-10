const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);

// Import routes
const embedScript = require("./routes/embed");
const organizationUi = require("./routes/uiController");
const chatHistoryRouter = require("./routes/chatHistory");
const call = require("./routes/callController");
const userDetail = require("./routes/userDetail");
const { generateAIResponse, generateVoiceResponse } = require("./rasa");
const fs = require("fs");
const expressStaticGzip = require("express-static-gzip");

// Serve static chatbot files
const publicDirectoryPath = path.join(__dirname, "./dist");
const distExists = fs.existsSync(publicDirectoryPath);

if (distExists) {
  // Serve pre-compressed files (Brotli and Gzip)
  app.use(
    expressStaticGzip(publicDirectoryPath, {
      enableBrotli: true,
      orderPreference: ["br", "gz"], // Prefer Brotli, fallback to Gzip
      index: false, // Don't auto-serve index.html
      serveStatic: {
        maxAge: "0",
        etag: true,
        lastModified: true,
        immutable: true,
        setHeaders: (res, filePath) => {
          res.setHeader("X-Content-Type-Options", "nosniff");

          // Aggressive caching for hashed assets
          if (
            /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp|avif)$/i.test(
              filePath
            )
          ) {
            res.setHeader("Cache-Control", "public, max-age=0, immutable");
          }
          // No cache for HTML
          else if (filePath.endsWith(".html")) {
            res.setHeader(
              "Cache-Control",
              "no-cache, no-store, must-revalidate"
            );
            res.setHeader("Pragma", "no-cache");
          }
        },
      },
    })
  );
}

// Configure CORS
const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? [process.env.FRONTEND_URL || "https://your-domain.vercel.app"]
    : [
        "http://localhost:3000",
        "http://localhost:4173",
        "http://172.18.32.1:3000",
        "http://localhost:5173",
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

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// API routes FIRST (before static files)
app.use("/embed", embedScript);
app.use("/rest/v1/ui", organizationUi);
app.use("/rest/v1/chat", chatHistoryRouter);
app.use("/rest/v1/call", call);
app.use("/rest/v1/user", userDetail);

app.get("/bot", (req, res) => {
  res.sendFile(path.join(path.join(__dirname), "index.html"));
});

app.use(express.static(publicDirectoryPath));

// Catch-all route for chatbot host
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDirectoryPath, "index.html"));
});

// Socket.IO logic
const activeSessions = new Map();

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  activeSessions.set(socket.id, {
    connectedAt: new Date(),
    messageCount: 0,
  });

  socket.on("user-message", async (data) => {
    const { message, details, sender, source, userDetails, attachment } = data;
    console.log(
      `Message from ${sender}: ${
        message ? message : JSON.stringify(attachment)
      }`
    );

    const session = activeSessions.get(socket.id);
    if (session) {
      session.messageCount++;
    }

    socket.emit("bot-typing");

    try {
      const aiResponse = await generateAIResponse(
        message,
        details,
        sender,
        source,
        userDetails,
        attachment
      );

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
    const { audio, details, sender, source, filename, type } = data;
    console.log(`Voice message from ${sender} of ${filename}`);

    const session = activeSessions.get(socket.id);
    if (session) {
      session.messageCount++;
    }

    socket.emit("bot-typing");

    try {
      const voiceResponse = await generateVoiceResponse(
        audio,
        details,
        sender,
        source,
        filename,
        type
      );

      console.log(voiceResponse, "voice response after posting in dashboard");

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
