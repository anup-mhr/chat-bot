interface QuickReplyProps {
  data: {
    id: string;
    botName: string | null;
    content: string;
    sender: "user" | "bot" | "agentMessage";
    timestamp: Date;
    type?: "text" | "audio" | "image" | "file" | "video" | "quick_reply";
    audioUrl?: string;
    buttons?: {
      title: string;
      payload: string;
    }[];
  };
  showModules: boolean;
  handleButtonClick: (type: string, title: string, payload: string) => void;
}

const QuickReply = ({
  data,
  showModules,
  handleButtonClick,
}: QuickReplyProps) => {
  if (!data) return null;

  return (
    <div className="">
      <div className="message-content mb-3">
        {(data.sender === "bot" || data.sender === "agentMessage") && (
          <p className="text-(--primary-color) font-bold">{data.botName}</p>
        )}
        <p className="text-base sm:text-lg wrap-break-words">{data.content}</p>
        <span className="message-time">
          {data.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {data.buttons && data.buttons.length > 0 && showModules && (
        <div className="flex flex-wrap gap-2 justify-center items-center">
          {data.buttons.map((item, key) => (
            <button
              key={key}
              className="bg-(--primary-color) cursor-pointer text-white rounded-xl px-4 py-2 text-sm sm:text-base hover:bg-(--secondary-color) transition-all duration-200"
              onClick={() =>
                handleButtonClick("quick_reply", item.title, item.payload)
              }
            >
              {item.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuickReply;
