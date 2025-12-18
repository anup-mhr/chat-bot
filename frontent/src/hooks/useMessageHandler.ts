import { useCallback } from "react";
import { getSocket } from "../socket/socket";
import type { Message } from "../types/chat.types";

export const useMessageHandler = (
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  setshiftKey: React.Dispatch<React.SetStateAction<boolean>>,
  showModules: boolean,
  setShowModules: React.Dispatch<React.SetStateAction<boolean>>,
  livechatRef: React.MutableRefObject<boolean>,
  livechatAgentName: React.MutableRefObject<string>,
  visitorData: any,
  userDetails: any
) => {
  const renderMessage = useCallback(
    (
      message: string | null,
      audio: string | null,
      sender: "user" | "bot" | "agentMessage",
      type: any,
      data: { title: string; payload: string }[] = []
    ) => {
      const userMessage: Message = {
        id: Date.now().toString(),
        botName: livechatRef.current
          ? livechatAgentName.current || "Agent"
          : visitorData.details?.name || null,
        content: message ? message : type === "audio" ? "Voice message" : "",
        sender: sender,
        timestamp: new Date(),
        type: type,
        ...(audio ? { audioUrl: audio as string } : {}),
        ...(data.length > 0 ? { buttons: data } : {}),
      };
      setMessages((prev) => [...prev, userMessage]);
      type !== "quick_reply" && showModules && setShowModules(false);
    },
    [
      livechatRef,
      livechatAgentName,
      visitorData,
      showModules,
      setMessages,
      setShowModules,
    ]
  );

  const messageSend = useCallback(
    async (message: string | null, attachment: any) => {
      const socket = getSocket();
      if (!socket) return;

      if (!livechatRef.current) {
        setshiftKey(true);
        if (message?.startsWith("livechat:request:")) {
          socket.emit(
            "livechat:request",
            message.split("livechat:request:")[1]
          );
          return;
        }
        socket.emit(
          "user:message",
          message,
          userDetails,
          visitorData?.details || null,
          visitorData?.visitorId || null,
          "web",
          attachment
        );
      } else {
        socket.emit(
          "message:sent",
          {
            ...(message && { text: message }),
            ...(message && { payload: message }),
            attachment,
          },
          null,
          visitorData?.details || null
        );
      }
    },
    [livechatRef, setshiftKey, userDetails, visitorData]
  );

  return { renderMessage, messageSend };
};
