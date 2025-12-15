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
const botPath = path.join(__dirname, "./dist");
const botDistExists = fs.existsSync(botPath);

const livechatPath = path.join(__dirname, "./livechat");
const livechatdistExists = fs.existsSync(livechatPath);

if (botDistExists) {
  // Serve pre-compressed files (Brotli and Gzip)
  app.use(
    "/chatbot",
    expressStaticGzip(botPath, {
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

if (livechatdistExists) {
  // Serve pre-compressed files (Brotli and Gzip)
  app.use(
    "/livechat",
    expressStaticGzip(livechatPath, {
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

const io = socketIo(server, {
  maxHttpBufferSize: 1e8,
});

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
app.use(express.static(botPath));
app.use(express.static(livechatPath));

app.get("/livechat", (req, res) => {
  res.sendFile(path.join(livechatPath, "index.html"));
});

// // Catch-all route for chatbot host
app.get("/chatbot", (req, res) => {
  res.sendFile(path.join(botPath, "index.html"));
});

app.get("*", (req, res) => {
  res.send("hello")
})

const { init } = require("./socket");
init(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
