import { ImagePlus, Mic, Send, SendHorizontal } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

import { CallOverlay } from "./CallOverlay";
import { FormDialog } from "./FormDialog";
import { useVisitor } from "../context/org.context";
import { connectSocket, disconnectSocket, getSocket } from "../socket/socket";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import Messages from "./Messages";
import FormPopup from "./FormPopup";

interface Message {
  id: string;
  content: string;
  sender: "user" | "bot" | "agentMessage";
  timestamp: Date;
  type?: "text" | "audio" | "image" | "file" | "video" | "quick_reply";
  audioUrl?: string;
  buttons?: {
    title: string;
    payload: string;
  }[];
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

interface TransferRequest {
  text: string;
  id: string;
  type: string;
  ping?: boolean;
  notification?: boolean;
  buttons?: {
    title: string;
    payload: string;
  }[];
}

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
  // const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [showCallOverlay, setShowCallOverlay] = useState(false);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<{
    content: string;
    type: "text" | "audio" | "image" | "file" | "video";
    audioUrl?: string;
  } | null>(null);
  const [firstMessage, setFirstMessage] = useState(true);
  const [isFormForCall, setIsFormForCall] = useState(false);
  const [formSubmit, setFormSubmit] = useState(false);
  const [livechat, setLivechat] = useState(false);
  const [showLivechatRequest, setShowLivechatRequest] = useState(false);
  const [livechatTransferRequest, setlivechatTransferRequest] =
    useState<TransferRequest | null>(null);
  const livechatRef = useRef(livechat);

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

        socket.emit(
          "user:join",
          visitorData.visitorId,
          "all",
          "User",
          "web",
          null,
          visitorData.details,
          null,
          async (value: any, userData: any) => {
            if (!value) {
              return null;
            }
            if (value && value.hasOwnProperty("engagedWith")) {
              setLivechat(true);
            }
          }
        );
      },
      () => {
        console.log("socket disconnected>>");
        setIsConnected(false);
      },
      (error) => {
        console.error("Connection error:", error);
        setIsConnected(false);
      },
      (data) => {
        setIsTyping(false);
        console.log(data, "Bot Message received>>>");
        if (data.type === "livechatIncomingRequest") {
          setlivechatTransferRequest(data);
          setShowLivechatRequest(true);
        }
        if (data.type === "quick_reply") {
          renderMessage(
            data?.title ? data.title : "Something went wrong",
            null,
            "bot",
            data?.type ? data.type : "text",
            data?.data ? data.data : []
          );
        } else {
          renderMessage(
            data?.custom
              ? data?.custom?.text
              : data?.text
              ? data?.text
              : data?.result
              ? data?.result
              : data?.message
              ? data?.message
              : "Something went wrong",
            data?.custom?.path
              ? data.custom.path
              : data?.attachment?.payload
              ? data.attachment.payload
              : null,
            data?.type === "agentMessage" ? "agentMessage" : "bot",
            data.custom?.type === "audio"
              ? "audio"
              : data?.attachment?.type
              ? data?.attachment?.type
              : data?.type
              ? data.type
              : "text"
          );
        }
      },
      () => setIsTyping(true),
      () => setIsTyping(false),
      (voiceResponse) => {
        console.log(voiceResponse, "consoling voice Response>>");
        const match = voiceResponse.path.match(
          /\/uploads\/(live_chat_[^/]+)\//i
        );
        const type = match
          ? match[1] === "live_chat_audio"
            ? "audio"
            : match[1] === "live_chat_image"
            ? "image"
            : match[1] === "live_chat_file"
            ? "file"
            : match[1] === "live_chat_video"
            ? "video"
            : ""
          : null;
        renderMessage(null, voiceResponse.path, "user", type);
        messageSend(null, {
          payload: { ...voiceResponse },
          type: type as string,
        });
      },
      () => setLivechat(true),
      () => setLivechat(false)
    );

    socketRef.current = socket;

    return () => {
      disconnectSocket();
    };
  }, [visitorData?.visitorId]);

  useEffect(() => {
    livechatRef.current = livechat;
  }, [livechat]);

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
        if (livechatRef.current) {
          setlivechatTransferRequest({
            text: "Do you want to end this session?",
            id: Date.now().toString(),
            type: "livechatEndRequest",
            ping: true,
            notification: false,
            buttons: [
              {
                title: "Yes",
                payload: `livechat:end:menu`,
              },
              {
                title: "No",
                payload: `livechat:transferReject:No`,
              },
            ],
          });
          setShowLivechatRequest(true);
        } else {
          if (firstMessage) {
            setIsFormForCall(true);
            setShowFormDialog(true);
          } else {
            setShowCallOverlay(true);
          }
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [firstMessage, livechat]);

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
    !livechat && setIsTyping(true);
  };

  async function messageSend(message: string | null, attachment: Attachment) {
    const socket = getSocket();
    if (!socket) return;
    console.log("Sending message:", {
      message,
      attachment,
    });
    if (!livechatRef.current) {
      if (message?.startsWith("livechat:request:")) {
        socket.emit("livechat:request", message.split("livechat:request:")[1]);
        return;
      }
      try {
        socket.emit(
          "user:message",
          message || null,
          userDetails,
          visitorData ? visitorData.details : null,
          visitorData ? visitorData.visitorId : null,
          "web",
          attachment || null
        );
      } catch (err) {
        console.log("error while sending user message", err);
      }
    } else {
      socket.emit(
        "message:sent",
        {
          ...(message && { text: message }),
          ...(message && { payload: message }),
          attachment,
        },
        null,
        visitorData ? visitorData.details : null
      );
    }
  }

  async function renderMessage(
    message: string | null,
    audio: string | null,
    sender: "user" | "bot" | "agentMessage",
    type: any,
    data: { title: string; payload: string }[] = []
  ) {
    const userMessage: Message = {
      id: Date.now().toString(),
      content: message ? message : type === "audio" ? "Voice message" : "",
      sender: sender,
      timestamp: new Date(),
      type: type,
      ...(audio ? { audioUrl: audio as string } : {}),
      ...(data.length > 0 ? { buttons: data } : {}),
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
        sendVoiceMessage(audioBlob);
        // setAudioChunks([]);

        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      // setAudioChunks(chunks);
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
      setPendingMessage({ content: "Voice message", type: "audio", audioUrl });
      setShowFormDialog(true);
      return;
    }

    const socket = getSocket();
    if (!socket) return;
    socket.emit(
      "voice:message",
      audioBlob,
      visitorData.visitorId,
      `audiomessage_${Date.now()}.mp3`,
      "audio"
    );
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageClick = () => {
    if (!livechat) return;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: any) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileType = file.type;

    const socket = getSocket();
    if (!socket) return;
    socket.emit(
      "voice:message",
      file,
      visitorData.visitorId,
      file.name,
      fileType
    );
    event.target.value = "";
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
        } else if (pendingMessage.type === "audio" && pendingMessage.audioUrl) {
          renderMessage(null, pendingMessage.audioUrl, "user", "audio");
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

  const handleButtonClick = (type: string, title: string, payload: string) => {
    const socket = getSocket();
    if (!socket) return;

    // setLivechat(true);
    setShowLivechatRequest(false);
    if (!(type === "livechatEndRequest" && title === "No"))
      renderMessage(title, null, "user", "text");
    // messageSend(inputValue, null);

    try {
      const [namespace, action, ...rest] = payload.split(":");
      const dataPart = rest.join(":");
      if (type === "livechatIncomingRequest") {
        if (action === "accept") {
          const parsedData = JSON.parse(dataPart);
          socket.emit(`${namespace}:${action}`, parsedData.visitorId);
        } else if (action === "reject") {
          socket.emit(`${namespace}:${action}`, dataPart);
        }
      } else if (type === "livechatEndRequest") {
        if (title === "Yes") {
          socket.emit(
            `${namespace}:${action}`,
            { text: dataPart, payload: dataPart, attachment: null },
            undefined,
            visitorData.details
          );
        } else if (title === "No") {
          return;
        }
      }
    } catch (err) {
      console.error("Failed to process button payload:", err, payload);
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
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <Messages
        messages={messages}
        isTyping={isTyping}
        messagesEndRef={messagesEndRef}
      />

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

      <FormPopup
        isOpen={showLivechatRequest}
        onClose={() => setShowLivechatRequest(false)}
        organization={visitorData?.details?.org_id || ""}
        branch={visitorData?.details?.branch_id || ""}
        sender={visitorData?.visitorId || ""}
        data={livechatTransferRequest}
        handleButtonClick={handleButtonClick}
      />

      {/* Input */}
      <form className="chat-input-form" onSubmit={userMessage}>
        <div className="input-container">
          <Mic
            className={`cursor-pointer ${
              !visitorData.details
                ? "text-gray-400 cursor-not-allowed opacity-50"
                : isRecording
                ? "text-(--primary-color) animate-pulse"
                : "text-(--secondary-color) "
            }`}
            onClick={handleMicClick}
            size={20}
          />
          <ImagePlus
            className={`${
              !livechat
                ? "text-gray-400 cursor-not-allowed opacity-50"
                : "text-(--secondary-color) cursor-pointer"
            }`}
            onClick={handleImageClick}
            size={20}
          />

          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
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
            <SendHorizontal size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}

export default App2;
