"use client";

import { Send } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import "../src/App.css";

interface Message {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
}

function App2() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const connectSocket = () => {
    if (!socketRef.current) {
      const socketUrl = "ws://localhost:3001";

      socketRef.current = io(socketUrl, {
        transports: ["websocket", "polling"],
        autoConnect: true,
        timeout: 20000,
      });

      socketRef.current.on("connect", () => {
        setIsConnected(true);
        console.log("Connected to socket server");
      });

      socketRef.current.on("disconnect", () => {
        setIsConnected(false);
        console.log("Disconnected from socket server");
      });

      socketRef.current.on("connect_error", (error) => {
        console.error("Connection error:", error);
        setIsConnected(false);
      });

      socketRef.current.on(
        "bot-message",
        (data: { message: string; messageId: string }) => {
          setIsTyping(false);
          const newMessage: Message = {
            id: data.messageId,
            content: data.message,
            sender: "bot",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, newMessage]);
        }
      );

      socketRef.current.on("bot-typing", () => {
        setIsTyping(true);
      });

      socketRef.current.on("bot-stop-typing", () => {
        setIsTyping(false);
      });
    }
  };

  useEffect(() => {
    connectSocket();
  }, []);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !socketRef.current) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    socketRef.current.emit("user-message", {
      message: inputValue,
      sessionId: socketRef.current.id,
    });

    setInputValue("");
    setIsTyping(true);
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    // Chat Window
    <div className={`chat-window ${true ? "open" : ""}`}>
      {/* Header */}
      <div className="chat-header">
        <div className="header-content">
          <div className="bot-info">
            <div className="bot-avatar">🤖</div>
            <div>
              <h3>AI Assistant</h3>
              <span className={`status ${isConnected ? "online" : "offline"}`}>
                {isConnected ? "Online" : "Connecting..."}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {messages.length === 0 && (
          <div className="welcome-message">
            <div className="message-avatar">🤖</div>
            <div className="welcome-text">
              <h4>Welcome! How can I help you today?</h4>
              <p>Feel free to ask me anything.</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${
              message.sender === "user" ? "user-message" : "bot-message"
            }`}
          >
            {message.sender === "bot" && (
              <div className="message-avatar">🤖</div>
            )}
            <div className="message-content">
              <p>{message.content}</p>
              <span className="message-time">
                {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="message bot-message">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <div className="input-container">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your message..."
            className="chat-input"
            disabled={!isConnected}
          />
          <button
            type="submit"
            className="send-button"
            disabled={!inputValue.trim() || !isConnected}
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}

export default App2;
