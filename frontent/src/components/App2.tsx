import { Mic, Send } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

import { CallOverlay } from "./CallOverlay";
import { FormDialog } from "./FormDialog";
import { useVisitor } from "../context/org.context";
import { connectSocket, disconnectSocket, getSocket } from "../socket/socket";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface Message {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
  type?: "text" | "voice";
  audioUrl?: string;
}

interface UserDetails {
  name: string;
  phone: string;
  email: string;
  subject: string;
}

type Attachment = {
  payload: {
    mediaId: string;
    path: string;
  } | null;
  type: string;
} | null;

function App2() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userDetails, setUserDetails] = useState<UserDetails>({
    name: "",
    phone: "",
    email: "",
    subject: "",
  });
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [showCallOverlay, setShowCallOverlay] = useState(false);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<{
    content: string;
    type: "text" | "voice";
    audioUrl?: string;
  } | null>(null);
  const [firstMessage, setFirstMessage] = useState(true);
  const [isFormForCall, setIsFormForCall] = useState(false);
  const [formSubmit, setFormSubmit] = useState(false);

  const { visitorData } = useVisitor();
  const env = import.meta.env;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const socket = connectSocket(
      () => {
        setIsConnected(true);
        console.log("Connected to socket server");
      },
      () => {
        setIsConnected(false);
        console.log("Disconnected from socket server");
      },
      (error) => {
        console.error("Connection error:", error);
        setIsConnected(false);
      },
      (data) => {
        setIsTyping(false);
        console.log(data, "Bot Message received>>>");
        renderMessage(
          data?.custom
            ? data.custom?.text
            : data?.result
            ? data.result
            : "Something went wrong",
          data.custom?.path ? data.custom.path : null,
          "bot",
          data.custom?.type === "audio" ? "voice" : "text"
        );
      },
      () => setIsTyping(true),
      () => setIsTyping(false),
      (voiceResponse) => {
        renderMessage(null, voiceResponse.path, "user", "voice");
        messageSend(null, {
          payload: { ...voiceResponse },
          type: "audio",
        });
      }
    );

    socketRef.current = socket;

    return () => {
      disconnectSocket();
    };
  }, [visitorData]);

  useEffect(() => {
    console.log(visitorData, "Visitor Details from context");
    if (
      visitorData?.userDetails?.first_name &&
      visitorData?.userDetails?.email
    ) {
      setUserDetails((prev) => ({
        ...prev,
        name: `${visitorData?.userDetails?.first_name} ${
          visitorData?.userDetails?.last_name || ""
        }`,
        email: visitorData?.userDetails?.email || "",
        phone: visitorData?.userDetails?.phone || "",
      }));
    }
  }, [visitorData]);

  useEffect(() => {
    if (userDetails.name && userDetails.email) {
      setFirstMessage(false);
    }
  }, [userDetails]);

  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "start-call") {
        if (!visitorData.details) return;
        if (firstMessage) {
          setIsFormForCall(true);
          setShowFormDialog(true);
        } else {
          setShowCallOverlay(true);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [firstMessage]);

  const userMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    // If form not filled, show form and store pending message
    if (firstMessage) {
      setPendingMessage({ content: inputValue, type: "text" });
      setShowFormDialog(true);
      setInputValue("");
      return;
    }

    // Form is filled, send message normally
    renderMessage(inputValue, null, "user", "text");
    messageSend(inputValue, null);
    setInputValue("");
    setIsTyping(true);
  };

  async function messageSend(message: string | null, attachment: Attachment) {
    const socket = getSocket();
    if (!socket) return;
    console.log("Sending message:", { message, attachment });
    socket.emit("user-message", {
      message: message || null,
      userDetails: userDetails,
      details: visitorData ? visitorData.details : null,
      sender: visitorData ? visitorData.visitorId : null,
      source: "web",
      attachment: attachment || null,
    });
  }

  async function renderMessage(
    message: string | null,
    audio: string | null,
    sender: "user" | "bot",
    type: any
  ) {
    const userMessage: Message = {
      id: Date.now().toString(),
      content: message ? message : type === "voice" ? "Voice message" : "",
      sender: sender,
      timestamp: new Date(),
      type: type,
      ...(audio ? { audioUrl: audio as string } : {}),
    };
    setMessages((prev) => [...prev, userMessage]);
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: "audio/wav" });
        console.log(audioBlob, "Recorded Audio Blob");
        sendVoiceMessage(audioBlob);
        setAudioChunks([]);

        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setAudioChunks(chunks);
    } catch (error: any) {
      console.error(`Error accessing microphone: ${error}`);
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        alert(
          "Microphone access is blocked. Please enable it from your browser settings."
        );
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const sendVoiceMessage = (audioBlob: Blob) => {
    // If form not filled, show form and store pending message
    if (firstMessage) {
      const audioUrl = URL.createObjectURL(audioBlob);
      setPendingMessage({ content: "Voice message", type: "voice", audioUrl });
      setShowFormDialog(true);
      return;
    }

    const socket = getSocket();
    if (!socket) return;
    console.log("Consoling formdata from getfile>>>", audioBlob);

    socket.emit("voice-message", {
      audio: audioBlob,
      details: visitorData.details,
      sender: visitorData.visitorId,
      source: "web",
      filename: `audiomessage_${Date.now()}.mp3`,
      type: "audio",
    });
  };

  const handleMicClick = () => {
    if (visitorData.details) {
      if (firstMessage) {
        setShowFormDialog(true);
        return;
      }
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    } else {
      return;
    }
  };

  const handleFormSubmit = async (name: string, email: string) => {
    try {
      setFormSubmit(true);
      const bodyData = {
        fullname: name,
        email,
        llmfields: visitorData.details,
        visitorId: visitorData.visitorId,
        source: "web",
      };
      const response = await fetch(
        `${env.VITE_SOCKET_PROTOCOL}://${env.VITE_SOCKET_HOST}:${env.VITE_SOCKET_PORT}/${env.VITE_BASEPATH}/user/userLeads`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(bodyData),
        }
      );

      const data = await response.json();
      if (data.status === "success" || data.success) {
        setUserDetails((prev) => ({
          ...prev,
          name: data.data.name,
          email: data.data.email,
        }));
        setFirstMessage(false);
        setShowFormDialog(false);
        setFormSubmit(false);
      }

      // If form was for call, trigger call
      if (isFormForCall) {
        setIsFormForCall(false);
        setShowCallOverlay(true);
      }
      // Send pending message if exists
      else if (pendingMessage) {
        if (pendingMessage.type === "text") {
          renderMessage(pendingMessage.content, null, "user", "text");
          messageSend(pendingMessage.content, null);
        } else if (pendingMessage.type === "voice" && pendingMessage.audioUrl) {
          renderMessage(null, pendingMessage.audioUrl, "user", "voice");
          // For voice, emit the event directly
          const socket = getSocket();
          if (socket) {
            socket.emit("voice-message", {
              audio: pendingMessage.audioUrl,
              details: visitorData.details,
              sender: visitorData.visitorId,
              source: "web",
              filename: `audiomessage_${Date.now()}.mp3`,
              from_chatbot: true,
            });
          }
        }
        setPendingMessage(null);
        setIsTyping(true);
      }
    } catch (error) {
      console.error(`Error while fetching user Details: ${error}`);
    }
  };

  return (
    // Chat Window
    <div className={`chat-window ${true ? "open" : ""}`}>
      {/* Header */}
      <div className="chat-header">
        <div className="header-content">
          <div className="bot-info">
            <div className="bot-avatar">
              <Avatar>
                <AvatarImage
                  src={visitorData?.details?.header_Logo || "/placeholder.svg"}
                />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
            </div>
            <div>
              <h3>{visitorData.details?.header_Name}</h3>
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
            <div className="message-avatar">
              <Avatar>
                <AvatarImage
                  src={visitorData?.details?.bot_Logo || "/placeholder.svg"}
                />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
            </div>
            <div className="welcome-text">
              {visitorData?.details?.Welcome_Message}
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
              <div className="message-avatar">
                <Avatar>
                  <AvatarImage
                    src={visitorData?.details?.bot_Logo || "/placeholder.svg"}
                  />
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
              </div>
            )}
            <div className="message-content">
              {message.type === "voice" && message.audioUrl ? (
                <div>
                  <p>{message.content}</p>
                  <audio
                    controls
                    src={message.audioUrl}
                    preload="metadata"
                    style={{
                      width: "220px",
                      margin: "unset",
                      borderRadius: "22px",
                      height: "40px",
                    }}
                  />
                </div>
              ) : (
                <p>{message.content}</p>
              )}
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
            <div className="message-avatar">
              <Avatar>
                <AvatarImage
                  src={visitorData?.details?.bot_Logo || "/placeholder.svg"}
                />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
            </div>
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

      <FormDialog
        isOpen={showFormDialog}
        onSubmit={handleFormSubmit}
        onClose={() => {
          setShowFormDialog(false);
          setIsFormForCall(false);
        }}
        isForCall={isFormForCall}
        onCallRequest={() => setShowCallOverlay(true)}
        formSubmit={formSubmit}
      />

      <CallOverlay
        isOpen={showCallOverlay && !showFormDialog}
        onClose={() => setShowCallOverlay(false)}
        organization={visitorData?.details?.org_id || ""}
        branch={visitorData?.details?.branch_id || ""}
        sender={visitorData?.visitorId || ""}
      />

      {/* Input */}
      <form className="chat-input-form" onSubmit={userMessage}>
        <div className="input-container">
          <Mic
            className={`cursor-pointer ${
              !visitorData.details
                ? "text-gray-400 cursor-not-allowed opacity-50"
                : isRecording
                ? "text-red-500 animate-pulse"
                : "text-gray-500"
            }`}
            onClick={handleMicClick}
            size={20}
          />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              isRecording ? "Recording voice..." : "Type your message..."
            }
            className="chat-input"
            disabled={!isConnected || isRecording}
          />
          <button
            type="submit"
            className="send-button"
            disabled={!inputValue.trim() || !isConnected || isRecording}
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
