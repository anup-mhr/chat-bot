import { useEffect, useRef, useState } from "react";
import { Loader2, Phone, X } from "lucide-react";
import Vapi from "@vapi-ai/web";
import { Button } from "./ui/button";

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
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const vapiRef = useRef<Vapi | null>(null);
  const isMountedRef = useRef(true);
  const env = import.meta.env;

  useEffect(() => {
    if (isOpen) {
      isMountedRef.current = true;
      console.log("Starting ringtone");
      const audio = new Audio(`${env.VITE_BASE_URL}/standardringtone.mp3`);
      audio.loop = true;
      audio.volume = 0.5;
      ringtoneRef.current = audio;
      const playPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("Ringtone playing successfully");
          })
          .catch((err) => {
            console.warn("Autoplay blocked:", err);
          });
      }
      makeCall();

      return () => {
        // Mark as unmounted/closed
        isMountedRef.current = false;

        // Cleanup ringtone
        if (ringtoneRef.current) {
          ringtoneRef.current.pause();
          ringtoneRef.current.currentTime = 0;
          ringtoneRef.current = null;
        }

        // Cleanup Vapi
        if (vapiRef.current) {
          try {
            if (typeof (vapiRef.current as any).stop === "function") {
              (vapiRef.current as any).stop();
            } else if (typeof (vapiRef.current as any).end === "function") {
              (vapiRef.current as any).end();
            } else if (
              typeof (vapiRef.current as any).disconnect === "function"
            ) {
              (vapiRef.current as any).disconnect();
            }
          } catch (e) {
            console.warn("Failed to close Vapi connection:", e);
          }
          vapiRef.current = null;
        }
      };
    }
  }, [isOpen]);

  function closeCall() {
    isMountedRef.current = false;

    // Stop ringtone
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
      ringtoneRef.current = null;
    }

    // Stop Vapi
    if (vapiRef.current) {
      try {
        if (typeof (vapiRef.current as any).stop === "function") {
          (vapiRef.current as any).stop();
        } else if (typeof (vapiRef.current as any).end === "function") {
          (vapiRef.current as any).end();
        } else if (typeof (vapiRef.current as any).disconnect === "function") {
          (vapiRef.current as any).disconnect();
        }
      } catch (e) {
        console.warn("Failed to close Vapi connection:", e);
      }
      vapiRef.current = null;
    }

    onClose();
  }

  const preinit = async () => {
    try {
      // Get Initial Settings
      const apiCallUrl = `${env.VITE_SOCKET_PROTOCOL}://${env.VITE_SOCKET_HOST}:${env.VITE_SOCKET_PORT}/${env.VITE_BASEPATH}/call/getInitialSettings?organization=${organization}&branch=${branch}`;

      const response = await fetch(apiCallUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch initial settings: ${response.status} ${response.statusText}`
        );
      }

      const responseData = await response.json();

      const availableDays: string[] = [];
      for (const key of Object.keys(responseData.details.bookingTimeSlot)) {
        if (responseData.details.bookingTimeSlot[key]?.open) {
          availableDays.push(key);
        }
      }
      responseData.details.availableDays = availableDays;

      // Get Final Settings
      const finalApiCallUrl = `${env.VITE_SOCKET_PROTOCOL}://${env.VITE_SOCKET_HOST}:${env.VITE_SOCKET_PORT}/${env.VITE_BASEPATH}/call/forFinalSettings`;

      const responseFinal = await fetch(finalApiCallUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId: organization,
          locationId: branch,
          timezone: responseData.details.timezone,
          bookingSlots: responseData.details.bookingTimeSlot,
          multipleBooking: responseData.details.multipleBooking,
          slotDuration: responseData.details.slotDuration,
        }),
      });

      if (!responseFinal.ok) {
        throw new Error(
          `Failed to fetch final settings: ${responseFinal.status} ${responseFinal.statusText}`
        );
      }

      const responsefinalJson = await responseFinal.json();
      responseData.details.availableSlots = responsefinalJson;
      responseData.details.sender = sender;

      // Get Prompt
      const promptgetUrl = `${env.VITE_SOCKET_PROTOCOL}://${env.VITE_SOCKET_HOST}:${env.VITE_SOCKET_PORT}/${env.VITE_BASEPATH}/call/getPrompt`;

      const promptresp = await fetch(promptgetUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatbotName: responseData.chatbotName,
          orgName: responseData.orgName,
          timezone: responseData.details.timezone,
          organization,
          prompt: responseData.prompt,
        }),
      });

      if (!promptresp.ok) {
        throw new Error(
          `Failed to fetch prompt: ${promptresp.status} ${promptresp.statusText}`
        );
      }

      const promptRespData = await promptresp.json();
      console.log(promptRespData, "final response in vapi >>>", responseData);

      return { data: { responseData, promptRespData } };
    } catch (err) {
      console.error("Error in preinit():", err);
      throw err;
    }
  };

  const makeCall = async () => {
    try {
      setStatus("connecting");
      let data = await preinit();

      // Check if component is still mounted/open after async operations
      if (!isMountedRef.current) {
        return;
      }

      let setup = data.data as any;

      // Double check before creating Vapi instance
      if (!isMountedRef.current) {
        return;
      }

      const vapi = new Vapi(setup.responseData.assistandPrivateKey);
      vapiRef.current = vapi;

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
        .then(() => {
          // Check one more time before starting the call
          if (!isMountedRef.current) {
            console.log("Component closed before starting call, aborting");
            if (vapiRef.current) {
              try {
                if (typeof (vapiRef.current as any).stop === "function") {
                  (vapiRef.current as any).stop();
                }
              } catch (e) {
                console.warn("Failed to stop Vapi:", e);
              }
            }
            return;
          }

          vapi.start(setup.responseData.assistantId, assistantOverrides);
          if (ringtoneRef.current) {
            ringtoneRef.current.pause();
            ringtoneRef.current.currentTime = 0;
          }

          setStatus("connected");
        })
        .catch(() => {
          if (ringtoneRef.current) {
            ringtoneRef.current.pause();
            ringtoneRef.current.currentTime = 0;
          }

          closeCall();
          alert(
            "🔒 Microphone Access Needed\n\nTo start the call, please follow these steps:\n\n1. Open your browser's site permissions for this page.\n2. Locate the 'Microphone' setting.\n3. Select 'Allow' from the available options.\n4. Reload the page and try the call again."
          );
        });
    } catch (err) {
      console.error("Failed to start call:", err);

      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }

      // Only show error if component is still mounted
      if (isMountedRef.current) {
        setStatus("failed");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-[90%] h-56 p-6 relative">
        <button
          onClick={closeCall}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X size={20} />
        </button>
        <div className="flex flex-col items-center text-center gap-6 py-8 sm:py-12 md:py-16 lg:py-20 justify-center h-full">
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
            <h3
              className={`text-xl font-semibold text-gray-900 mb-2 ${
                status === "connecting" ? "animate-dots" : ""
              }`}
            >
              {status === "connecting"
                ? "Calling"
                : status === "connected"
                ? "Connected!"
                : "Call Failed"}
            </h3>

            <p className="text-gray-600">
              {status === "connecting" &&
                "Please wait while we connect your call"}
              {status === "connected" && "Successfully connected"}
              {status === "failed" && "Failed to connect. Please try again."}
            </p>
            {/* Spinner */}
            <div className=" flex justify-center items-center">
              {status === "connecting" && (
                <Loader2 className="text-blue-600 animate-spin" size={32} />
              )}
              {status === "connected" && (
                <Button className="cursor-pointer" onClick={closeCall}>
                  Close Call
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
