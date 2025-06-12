const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const cors = require("cors")

const app = express()
const server = http.createServer(app)

// Configure CORS for Socket.IO with environment-aware origins
const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? [process.env.FRONTEND_URL || "https://your-domain.vercel.app"]
    : ["http://localhost:3000", "http://127.0.0.1:3000"]

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
})

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
)
app.use(express.json())

// Health check endpoint for Vercel
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() })
})

// Store active sessions
const activeSessions = new Map()

// Simulate AI responses (replace with actual AI integration)
const generateAIResponse = async (message) => {
  // Simulate processing time
  await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000))

  const responses = [
    "I understand your question. Let me help you with that.",
    "That's an interesting point. Here's what I think...",
    "I can definitely assist you with that. Let me provide some information.",
    "Thank you for asking! Here's my response to your query.",
    "I see what you're looking for. Let me explain this for you.",
  ]

  return (
    responses[Math.floor(Math.random() * responses.length)] +
    " " +
    `You asked: "${message}". This is a simulated response. In a real implementation, you would integrate with an AI service like OpenAI, Claude, or other AI providers.`
  )
}

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`)

  // Store session
  activeSessions.set(socket.id, {
    connectedAt: new Date(),
    messageCount: 0,
  })

  socket.on("user-message", async (data) => {
    const { message, sessionId } = data
    console.log(`Message from ${sessionId}: ${message}`)

    // Update session
    const session = activeSessions.get(socket.id)
    if (session) {
      session.messageCount++
    }

    // Emit typing indicator
    socket.emit("bot-typing")

    try {
      // Generate AI response
      const aiResponse = await generateAIResponse(message)

      // Stop typing and send response
      socket.emit("bot-stop-typing")
      socket.emit("bot-message", {
        message: aiResponse,
        messageId: Date.now().toString(),
      })
    } catch (error) {
      console.error("Error generating AI response:", error)
      socket.emit("bot-stop-typing")
      socket.emit("bot-message", {
        message: "I'm sorry, I encountered an error. Please try again.",
        messageId: Date.now().toString(),
      })
    }
  })

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`)
    activeSessions.delete(socket.id)
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`)
})
