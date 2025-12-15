import { X } from "lucide-react";
import { Button } from "./ui/button";

interface TransferButton {
  title: string;
  payload: string;
}

interface TransferRequest {
  text: string;
  id: string;
  type: string;
  ping?: boolean;
  notification?: boolean;
  buttons?: TransferButton[];
}

interface FormPopupProps {
  isOpen: boolean;
  onClose: () => void;
  data: TransferRequest | null;
  handleButtonClick: (type: string, title: string, payload: string) => void;
}

const FormPopup = ({
  isOpen,
  onClose,
  data,
  handleButtonClick,
}: FormPopupProps) => {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-[90%] h-56 p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center gap-6 py-6 justify-center h-full">
          <h3 className="text-lg font-semibold text-gray-900">
            {data.type === "livechatIncomingRequest"
              ? "Live Chat Transfer Request"
              : data.type === "livechatEndRequest"
              ? "Live Chat End"
              : ""}
          </h3>

          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
            {data.text}
          </p>

          <div className="flex justify-center gap-10 mt-6 w-full">
            {data.buttons?.map((btn) => (
              <Button
                key={btn.title}
                onClick={() =>
                  handleButtonClick(data.type, btn.title, btn.payload)
                }
                className={`w-28 py-2.5 text-white font-medium rounded-lg shadow-md transition-colors ${
                  btn.title === "Accept"
                    ? "bg-green-600 hover:bg-green-700"
                    : btn.title === "Yes"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {btn.title}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormPopup;
