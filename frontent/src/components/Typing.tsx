import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";
import { useVisitor } from "../context/org.context";

const Typing = () => {
  const { visitorData } = useVisitor();
  return (
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
  );
};

export default Typing;
