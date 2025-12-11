import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";
import { useVisitor } from "../context/org.context";
import WelcomeMessage from "./content-render/WelcomeMessage";
import Typing from "./Typing";

interface Message {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
  type?: "text" | "voice";
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

      {isTyping && <Typing />}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default Messages;
