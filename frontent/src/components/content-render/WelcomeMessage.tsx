import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";
import { useVisitor } from "../../context/org.context";

const WelcomeMessage = () => {
  const { visitorData } = useVisitor();
  return (
    <div className="welcome-message">
      <div className="welcome-avatar">
        <Avatar>
          <AvatarImage
            src={visitorData?.details?.bot_Logo || "/placeholder.svg"}
          />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
      </div>
      <div
        className="welcome-text"
        dangerouslySetInnerHTML={{
          __html: visitorData?.details?.Welcome_Message || "",
        }}
      />
    </div>
  );
};

export default WelcomeMessage;
