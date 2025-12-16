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
}

const GeneralReply = ({ data }: QuickReplyProps) => {
  return (
    <div className="message-content">
      {(data.sender === "bot" || data.sender === "agentMessage") && (
        <p className="text-(--primary-color) font-bold">{data.botName}</p>
      )}
      {data.type === "audio" && data.audioUrl ? (
        <div>
          {data.sender === "agentMessage" ? (
            <p>Voice data</p>
          ) : (
            <p>{data.content}</p>
          )}
          <audio
            controls
            src={data.audioUrl}
            preload="metadata"
            style={{
              width: "220px",
              margin: "unset",
              borderRadius: "22px",
              height: "40px",
            }}
          />
        </div>
      ) : data.type === "image" && data.audioUrl ? (
        <div>
          <img
            src={data.audioUrl}
            alt="/image"
            className="w-full min-w-[200px] max-w-[250px] p-4 rounded-md"
          />
        </div>
      ) : data.type === "file" && data.audioUrl ? (
        <div className="flex gap-1 items-center space-x-1">
          <iframe
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(
              data.audioUrl
            )}&embedded=true`}
            className="w-full max-w-[400px] h-[400px] border rounded-md"
            title="PDF Viewer"
          />
        </div>
      ) : data.type === "video" && data.audioUrl ? (
        <div>
          <video
            controls
            src={data.audioUrl}
            className="w-full min-w-[256px] max-w-[312px] bg-white p-2 rounded-md"
          ></video>
        </div>
      ) : (
        <p>{data.content}</p>
      )}

      <span className="message-time">
        {data.timestamp.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
};

export default GeneralReply;
