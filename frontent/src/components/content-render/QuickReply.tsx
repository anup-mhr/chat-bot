interface QuickReplyProps {
  data: {
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
  };
}

const QuickReply = ({ data }: QuickReplyProps) => {
  if (!data) return null;

  const ButtonCkicked = async (title: string, payload: string) => {
    console.log(title, payload, "consoling button clkicked quick reply");
  };
  return (
    <div className="">
      <div className="message-content mb-3">
        <p className="text-base sm:text-lg break-words">{data.content}</p>
        <span className="message-time">
          {data.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {data.buttons && data.buttons.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center items-center">
          {data.buttons.map((item, key) => (
            <button
              key={key}
              className="bg-(--primary-color) cursor-pointer text-white rounded-xl px-4 py-2 text-sm sm:text-base hover:bg-(--secondary-color) transition-all duration-200"
              onClick={() => ButtonCkicked(item.title, item.payload)}
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
