import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { CallOverlay } from "./CallOverlay";
import { FormDialog } from "./FormDialog";
import { useVisitor } from "../context/org.context";
import { getSocket } from "../socket/socket";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import Messages from "./Messages";
import FormPopup from "./FormPopup";
import ChatInput from "./ChatInput";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useMessageHandler } from "../hooks/useMessageHandler";
import { useSocketConnection } from "../hooks/useSocketConnection";
import type {
  Message,
  UserDetails,
  TransferRequest,
} from "../types/chat.types";

function App2() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [userDetails, setUserDetails] = useState<UserDetails>({
    name: "",
    phone: "",
    email: "",
    subject: "",
  });
  const [livechatTransferRequest, setlivechatTransferRequest] =
    useState<TransferRequest | null>(null);
  const [pendingMessage, setPendingMessage] = useState<{
    content: string;
    type: "text" | "audio" | "image" | "file" | "video" | any;
    audioUrl?: string;
  } | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showCallOverlay, setShowCallOverlay] = useState(false);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [firstMessage, setFirstMessage] = useState(true);
  const [isFormForCall, setIsFormForCall] = useState(false);
  const [formSubmit, setFormSubmit] = useState(false);
  const [livechat, setLivechat] = useState(false);
  const [showLivechatRequest, setShowLivechatRequest] = useState(false);
  const [showModules, setShowModules] = useState(false);
  const [shiftKey, setshiftKey] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const livechatRef = useRef(livechat);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const livechatAgentName = useRef("");

  const { visitorData } = useVisitor();
  const env = import.meta.env;

  const sendAttachment = (audioBlob: Blob | null, imagefile: File | null) => {
    if (firstMessage) {
      const audioUrl = URL.createObjectURL(audioBlob ? audioBlob : imagefile!);
      setPendingMessage({
        content: imagefile ? imagefile.name : "Voice message",
        type: imagefile?.type ? imagefile.type : "audio",
        audioUrl,
      });
      setShowFormDialog(true);
      return;
    }

    const socket = getSocket();
    if (!socket) return;
    socket.emit(
      "voice:message",
      audioBlob ? audioBlob : imagefile,
      visitorData.visitorId,
      imagefile?.name ? imagefile.name : `audiomessage_${Date.now()}.mp3`,
      imagefile?.type ? imagefile.type : "audio"
    );
  };

  // Custom hooks for better separation of concerns
  const {
    isRecording,
    visualizeData,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder(sendAttachment);

  const { renderMessage, messageSend } = useMessageHandler(
    setMessages,
    setshiftKey,
    showModules,
    setShowModules,
    livechatRef,
    livechatAgentName,
    visitorData,
    userDetails
  );

  useSocketConnection({
    visitorData,
    setIsConnected,
    setIsTyping,
    setshiftKey,
    setlivechatTransferRequest,
    setShowLivechatRequest,
    setShowModules,
    setLivechat,
    renderMessage,
    messageSend,
    livechatAgentName,
    socketRef,
  });

  // Scroll to bottom effect
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Sync livechat ref
  useEffect(() => {
    livechatRef.current = livechat;
  }, [livechat]);

  // Sync visitor data to user details
  useEffect(() => {
    if (visitorData?.userDetails?.name && visitorData?.userDetails?.email) {
      setUserDetails((prev) => ({
        ...prev,
        name: `${visitorData?.userDetails?.name || ""}`,
        email: visitorData?.userDetails?.email || "",
        phone: visitorData?.userDetails?.phone || "",
      }));
    }
  }, [visitorData]);

  // Update firstMessage flag
  useEffect(() => {
    if (userDetails.name && userDetails.email) {
      setFirstMessage(false);
    }
  }, [userDetails]);

  // Handle call overlay trigger
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
              { title: "Yes", payload: `livechat:end:menu` },
              { title: "No", payload: `livechat:transferReject:No` },
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
  }, [firstMessage, livechat, visitorData.details]);

  const userMessage = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedFile) {
      sendAttachment(null, selectedFile);
      setSelectedFile(null);
      return;
    }

    if (!inputValue.trim()) return;

    if (firstMessage) {
      setPendingMessage({ content: inputValue, type: "text" });
      setShowFormDialog(true);
      setInputValue("");
      return;
    }

    renderMessage(inputValue, null, "user", "text");
    messageSend(inputValue, null);
    setInputValue("");
    !livechatRef.current && setIsTyping(true);
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

      if (isFormForCall) {
        setIsFormForCall(false);
        setShowCallOverlay(true);
      } else if (pendingMessage) {
        if (pendingMessage.type === "text") {
          renderMessage(pendingMessage.content, null, "user", "text");
          messageSend(pendingMessage.content, null);
        } else if (pendingMessage.type === "audio" && pendingMessage.audioUrl) {
          renderMessage(null, pendingMessage.audioUrl, "user", "audio");
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

    setShowLivechatRequest(false);
    if (!(type === "livechatEndRequest" && title === "No"))
      renderMessage(title, null, "user", "text");

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
      } else if (type === "quick_reply") {
        socket.emit(
          `message:sent`,
          {
            text: dataPart,
            payload: { title, payload },
            type: "customer_rating",
          },
          visitorData.userDetails,
          visitorData.details,
          visitorData.visitorId
        );
        setShowModules(false);
      }
    } catch (err) {
      console.error("Failed to process button payload:", err, payload);
    }
  };

  return (
    <div className={`chat-window ${true ? "open" : ""}`}>
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

      <Messages
        messages={messages}
        isTyping={isTyping}
        messagesEndRef={messagesEndRef}
        showModules={showModules}
        handleButtonClick={handleButtonClick}
      />

      <FormDialog
        isOpen={showFormDialog}
        onSubmit={handleFormSubmit}
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
        data={livechatTransferRequest}
        handleButtonClick={handleButtonClick}
      />

      <ChatInput
        isRecording={isRecording}
        visualizeData={visualizeData}
        inputValue={inputValue}
        selectedFile={selectedFile}
        isConnected={isConnected}
        shiftKey={shiftKey}
        livechat={livechat}
        visitorDetails={visitorData.details}
        onInputChange={setInputValue}
        onSubmit={userMessage}
        onFileSelect={setSelectedFile}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onCancelRecording={cancelRecording}
      />
    </div>
  );
}

export default App2;
