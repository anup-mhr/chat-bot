import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";
import { useVisitor } from "../context/org.context";
import WelcomeMessage from "./content-render/WelcomeMessage";
import Typing from "./Typing";
import QuickReply from "./content-render/QuickReply";
import GeneralReply from "./content-render/GeneralReply";

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

interface MessagesProps {
  isTyping: boolean;
  messages: Message[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  showModules: boolean;
  handleButtonClick: (type: string, title: string, payload: string) => void;
}

const Messages = ({
  messages,
  isTyping,
  messagesEndRef,
  showModules,
  handleButtonClick,
}: MessagesProps) => {
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
          {(message.sender === "bot" || message.sender === "agentMessage") && (
            <div className="message-avatar">
              <Avatar>
                <AvatarImage
                  src={visitorData?.details?.bot_Logo || "/placeholder.svg"}
                />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
            </div>
          )}
          {message.type === "quick_reply" ? (
            <QuickReply
              data={message}
              showModules={showModules}
              handleButtonClick={handleButtonClick}
            />
          ) : (
            <GeneralReply data={message} />
          )}
        </div>
      ))}

      {isTyping && <Typing />}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default Messages;
