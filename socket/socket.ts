// socket.ts
import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

interface BotMessage {
  result: string;
  sender: string;
  response_time: number;
  "Tool Used?": boolean;
  "Language Required": string;
  intentTime: number;
  GatedTime: number;
  AgentInvokeTime: number;
  custom: {
    path: string;
    text: string;
    type: string;
  };
  question: string;
}

export const connectSocket = (
  onConnect: () => void,
  onDisconnect: () => void,
  onConnectError: (error: any) => void,
  onBotMessage: (data: BotMessage) => void,
  onBotTyping: () => void,
  onBotStopTyping: () => void,
  onVoiceResponse: (data: any) => void
): Socket => {
  if (!socket) {
    const socketUrl = "ws://localhost:3001";

    socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      timeout: 20000,
    });

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("bot-message", onBotMessage);
    socket.on("bot-typing", onBotTyping);
    socket.on("bot-stop-typing", onBotStopTyping);
    socket.on("voice-response", onVoiceResponse);
  }

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
