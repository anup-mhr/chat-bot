import { ImagePlus, Mic, SendHorizontal, X, Check } from "lucide-react";
import { useRef } from "react";

interface ChatInputProps {
  isRecording: boolean;
  visualizeData: any[];
  inputValue: string;
  selectedFile: File | null;
  isConnected: boolean;
  shiftKey: boolean;
  livechat: boolean;
  visitorDetails: any;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onFileSelect: (file: File | null) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  isRecording,
  visualizeData,
  inputValue,
  selectedFile,
  isConnected,
  shiftKey,
  livechat,
  visitorDetails,
  onInputChange,
  onSubmit,
  onFileSelect,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageClick = () => {
    if (!livechat) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    onFileSelect(file);
    event.target.value = "";
  };

  return (
    <form className="chat-input-form" onSubmit={onSubmit}>
      {isRecording ? (
        <div className="recording-bar-container">
          <button
            type="button"
            className="recording-cancel-btn"
            onClick={onCancelRecording}
            aria-label="Cancel recording"
          >
            <X size={18} />
          </button>
          <div className="visualized-data h-8 bg-dim rounded-full flex items-center overflow-clip gap-1 p-1">
            {Array.from(visualizeData).map((data: any, index) => (
              <div
                className="w-1 bg-dim-dark rounded-full flex shrink-0 bg-(--secondary-color)"
                style={{
                  height: `${Math.max(5, Math.abs((128 - data) * 5))}%`,
                }}
                key={index}
              />
            ))}
          </div>
          <button
            type="button"
            className="recording-send-btn"
            onClick={onStopRecording}
            aria-label="Send recording"
          >
            <Check size={18} />
          </button>
        </div>
      ) : (
        <div className="input-container">
          <Mic
            className={`cursor-pointer ${
              !visitorDetails
                ? "text-gray-400 cursor-not-allowed opacity-50"
                : "text-(--secondary-color)"
            }`}
            onClick={onStartRecording}
            size={20}
          />
          {selectedFile ? (
            <X
              className="text-(--secondary-color) cursor-pointer"
              onClick={() => onFileSelect(null)}
              size={20}
            />
          ) : (
            <ImagePlus
              className={`${
                !livechat
                  ? "text-gray-400 cursor-not-allowed opacity-50"
                  : "text-(--secondary-color) cursor-pointer"
              }`}
              onClick={handleImageClick}
              size={20}
            />
          )}

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
            accept="image/*,video/*,.pdf,.doc,.docx"
          />

          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={
              selectedFile ? selectedFile.name : "Type your message..."
            }
            className="chat-input"
            disabled={!isConnected || !!selectedFile}
          />

          <button
            type="submit"
            className="send-button"
            disabled={
              (!inputValue.trim() && !selectedFile) || !isConnected || shiftKey
            }
            aria-label="Send message"
          >
            <SendHorizontal size={16} />
          </button>
        </div>
      )}
    </form>
  );
};

export default ChatInput;
