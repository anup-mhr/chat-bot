const express = require("express");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");
var cookieParser = require("cookie-parser");
const routeManager = require("./routes");

const app = express();
var server = require("http").Server(app);

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
const allowedOrigins = (process.env.SOCKET_ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const io = socketIo(server);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use("/", routeManager);
app.use(express.static(publicDirectoryPath));

// Catch-all route for chatbot host
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDirectoryPath, "index.html"));
});

const { init } = require("./socket");
init(io);

// io.on("connection", (socket) => {
//   console.log(`User connected: ${socket.id}`);

//   activeSessions.set(socket.id, {
//     connectedAt: new Date(),
//     messageCount: 0,
//   });

//   socket.on("user-message", async (data) => {
//     const { message, details, sender, source, userDetails, attachment } = data;
//     console.log(
//       `Message from ${sender}: ${
//         message ? message : JSON.stringify(attachment)
//       }`
//     );

//     const session = activeSessions.get(socket.id);
//     if (session) {
//       session.messageCount++;
//     }

//     socket.emit("bot-typing");

//     try {
//       const aiResponse = await generateAIResponse(
//         message,
//         details,
//         sender,
//         source,
//         userDetails,
//         attachment
//       );

//       socket.emit("bot-stop-typing");
//       socket.emit("bot-message", aiResponse);
//     } catch (error) {
//       console.error("Error generating AI response:", error);
//       socket.emit("bot-stop-typing");
//       socket.emit("bot-message", {
//         message: "I'm sorry, I encountered an error. Please try again.",
//         messageId: Date.now().toString(),
//       });
//     }
//   });

//   socket.on("voice-message", async (data) => {
//     const { audio, details, sender, source, filename, type } = data;
//     console.log(`Voice message from ${sender} of ${filename}`);

//     const session = activeSessions.get(socket.id);
//     if (session) {
//       session.messageCount++;
//     }

//     socket.emit("bot-typing");

//     try {
//       const voiceResponse = await generateVoiceResponse(
//         audio,
//         details,
//         sender,
//         source,
//         filename,
//         type
//       );

//       console.log(voiceResponse, "voice response after posting in dashboard");

//       socket.emit("bot-stop-typing");
//       socket.emit("voice-response", voiceResponse);
//     } catch (error) {
//       console.error("Error generating voice response:", error);
//       socket.emit("bot-stop-typing");
//       socket.emit("bot-message", {
//         message:
//           "I'm sorry, I couldn't process your voice message. Please try again.",
//         messageId: Date.now().toString(),
//       });
//     }
//   });

//   socket.on("disconnect", () => {
//     console.log(`User disconnected: ${socket.id}`);
//     activeSessions.delete(socket.id);
//   });
// });

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
