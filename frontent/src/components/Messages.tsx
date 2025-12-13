import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";
import { useVisitor } from "../context/org.context";
import WelcomeMessage from "./content-render/WelcomeMessage";
import Typing from "./Typing";
import { Paperclip } from "lucide-react";

interface Message {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
  type?: "text" | "audio" | "image" | "file" | "video";
  audioUrl?: string;
}

interface MessagesProps {
  isTyping: boolean;
  messages: Message[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

const Messages = ({ messages, isTyping, messagesEndRef }: MessagesProps) => {
  const { visitorData } = useVisitor();
  return (
    <div className="messages-container">
      {messages.length === 0 && <WelcomeMessage />}

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
            {message.type === "audio" && message.audioUrl ? (
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
            ) : message.type === "image" && message.audioUrl ? (
              <div>
                <img
                  src={message.audioUrl}
                  alt="/image"
                  className="w-full min-w-[200px] max-w-[250px] p-4 rounded-md"
                />
              </div>
            ) : message.type === "file" && message.audioUrl ? (
              <div className="flex gap-1 items-center space-x-1">
                <Paperclip className="w-4 h-4 text-yellow-200" />
                <a
                  href={message.audioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline break-words text-yellow-200"
                >
                  {(() => {
                    const match = message.audioUrl.match(
                      /live_chat_file\/(.+?\.(csv|txt|pdf|docx?))/i
                    );
                    return match ? match[1] : message.audioUrl;
                  })()}
                </a>
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

      {isTyping && <Typing />}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default Messages;
