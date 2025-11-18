"use client";

import { useEffect, useState } from "react";
import { Loader2, Phone, X } from "lucide-react";
import Vapi from "@vapi-ai/web";
import { Button } from "@/components/ui/button";

interface CallOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  organization: string;
  branch: string;
  sender: string;
}

export function CallOverlay({
  isOpen,
  onClose,
  organization,
  branch,
  sender,
}: CallOverlayProps) {
  const [status, setStatus] = useState<"connecting" | "connected" | "failed">(
    "connecting"
  );
  const [ringtone, setRingtone] = useState<HTMLAudioElement | null>(null);
  const [vapi, setVapi] = useState<Vapi | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Create and play ringtone
      const audio = new Audio(`${process.env.BASE_URL}/standardringtone.mp3`);
      audio.loop = true;
      audio.volume = 0.5;
      audio.play().catch((err) => console.warn("Autoplay blocked:", err));
      setRingtone(audio);

      // Make the API call
      makeCall();

      return () => {
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
      };
    }
  }, [isOpen]);

  function closeCall() {
    if (vapi) {
      try {
        if (typeof (vapi as any).stop === "function") {
          (vapi as any).stop();
        } else if (typeof (vapi as any).end === "function") {
          (vapi as any).end();
        } else if (typeof (vapi as any).disconnect === "function") {
          (vapi as any).disconnect();
        }
      } catch (e) {
        console.warn("Failed to close Vapi connection:", e);
      }
    }
    onClose();
  }

  const makeCall = async () => {
    try {
      const response = await fetch("/call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organization,
          branch,
          sender,
        }),
      });

      let setup = await response.json();
      setup = setup.data;

      console.log(setup, "call response>>>>");

      const vapi = new Vapi(setup.responseData.assistandPrivateKey);
      setVapi(vapi);

      const assistantOverrides: any = {
        variableValues: setup.responseData,
        model: {
          provider: "openai",
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: setup.promptRespData.prompt,
            },
          ],
          tools: setup.promptRespData.tools,
        },
      };

      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          vapi.start(setup.responseData.assistantId, assistantOverrides);
        })
        .catch((err) => {
          closeCall();
          alert(
            "🔒 Microphone Access Needed\n\nTo start the call, please follow these steps:\n\n1. Open your browser’s site permissions for this page.\n2. Locate the ‘Microphone’ setting.\n3. Select ‘Allow’ from the available options.\n4. Reload the page and try the call again."
          );
        });

      if (!response.ok) throw new Error("Call failed");

      // Stop ringtone
      if (ringtone) {
        ringtone.pause();
        ringtone.currentTime = 0;
      }

      setStatus("connected");
    } catch (err) {
      console.error("Failed to start call:", err);
      // Stop ringtone
      if (ringtone) {
        ringtone.pause();
        ringtone.currentTime = 0;
      }
      closeCall();
      setStatus("failed");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center space-y-4">
          {/* Icon */}
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center ${
              status === "connecting"
                ? "bg-blue-100"
                : status === "connected"
                ? "bg-green-100"
                : "bg-red-100"
            }`}
          >
            {status === "connecting" ? (
              <Phone className="text-blue-600 animate-pulse" size={32} />
            ) : status === "connected" ? (
              <Phone className="text-green-600" size={32} />
            ) : (
              <X className="text-red-600" size={32} />
            )}
          </div>

          {/* Status Text */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {status === "connecting" && "Calling..."}
              {status === "connected" && "Connected!"}
              {status === "failed" && "Call Failed"}
            </h3>
            <p className="text-gray-600">
              {status === "connecting" &&
                "Please wait while we connect your call"}
              {status === "connected" && "Successfully connected"}
              {status === "failed" && "Failed to connect. Please try again."}
            </p>
            {status === "connected" && (
              <Button onClick={closeCall}>Close Call</Button>
            )}
          </div>

          {/* Spinner */}
          {status === "connecting" && (
            <Loader2 className="text-blue-600 animate-spin" size={32} />
          )}

          {/* Status Indicator */}
          {status === "connecting" && (
            <div className="flex space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-100" />
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-200" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
