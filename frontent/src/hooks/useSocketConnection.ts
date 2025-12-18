import { useEffect } from "react";
import { connectSocket, disconnectSocket } from "../socket/socket";

export const useSocketConnection = ({
  visitorData,
  setIsConnected,
  setIsTyping,
  setshiftKey,
  setlivechatTransferRequest,
  setShowLivechatRequest,
  setShowModules,
  setLivechat,
  renderMessage,
  messageSend,
  livechatAgentName,
  socketRef,
}: any) => {
  useEffect(() => {
    const socket = connectSocket(
      () => {
        setIsConnected(true);

        socket.emit(
          "user:join",
          visitorData.visitorId,
          "all",
          "User",
          "web",
          null,
          visitorData.details,
          visitorData.userDetails,
          async (value: any) => {
            if (value?.hasOwnProperty("engagedWith")) {
              setLivechat(true);
            }
          }
        );
      },
      () => {
        console.log("socket disconnected>>");
        setIsConnected(false);
      },
      (error) => {
        console.error("Connection error:", error);
        setIsConnected(false);
      },
      (data) => {
        setIsTyping(false);
        setshiftKey(false);
        if (data.type === "livechatIncomingRequest") {
          setlivechatTransferRequest(data);
          setShowLivechatRequest(true);
        }
        if (data.type === "quick_reply") {
          renderMessage(
            data?.title || "Something went wrong",
            null,
            "bot",
            data?.type || "text",
            data?.data || []
          );
          setShowModules(true);
        } else {
          renderMessage(
            data?.custom?.text ||
              data?.text ||
              data?.result ||
              data?.message ||
              "Something went wrong",
            data?.custom?.path || data?.attachment?.payload || null,
            data?.type === "agentMessage" ? "agentMessage" : "bot",
            data.custom?.type === "audio"
              ? "audio"
              : data?.attachment?.type || data?.type || "text"
          );
        }
      },
      () => setIsTyping(true),
      () => setIsTyping(false),
      (voiceResponse) => {
        const match = voiceResponse.path.match(
          /\/uploads\/(live_chat_[^/]+)\//i
        );
        const type = match
          ? match[1] === "live_chat_audio"
            ? "audio"
            : match[1] === "live_chat_image"
            ? "image"
            : match[1] === "live_chat_file"
            ? "file"
            : match[1] === "live_chat_video"
            ? "video"
            : ""
          : null;
        renderMessage(null, voiceResponse.path, "user", type);
        messageSend(null, {
          payload: { ...voiceResponse },
          type: type as string,
        });
      },
      (data) => {
        setLivechat(true);
        livechatAgentName.current = data;
      },
      () => setLivechat(false)
    );

    socketRef.current = socket;

    return () => {
      disconnectSocket();
    };
  }, [visitorData]);
};
