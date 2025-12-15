// socket.ts
import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

interface BotMessage {
  result: string;
  sender: string;
  message: string;
  text: string;
  id: string;
  type: string;
  uiMsg: string;
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

  agentName?: string;
  ping?: boolean;
  notification?: boolean;
  buttons?: {
    title: string;
    payload: string;
  }[];

  agentId: string;
  attachment?: {
    type: string;
    payload: string;
    size: number;
  };
  isOfflineMessage: boolean;
  targetCategory: string;
  targetSource: string;

  subtitle?: string;
  title?: string;
  data?: {
    title: string;
    payload: string;
  }[];
}

interface VoiceResponse {
  mediaId: string;
  path: string;
}

export const connectSocket = (
  onConnect: () => void,
  onDisconnect: () => void,
  onConnectError: (error: any) => void,
  onBotMessage: (data: BotMessage) => void,
  onBotTyping: () => void,
  onBotStopTyping: () => void,
  onVoiceResponse: (data: VoiceResponse) => void,
  onLivechatStarted: () => void,
  onLivechatEnded: () => void
): Socket => {
  if (!socket) {
    const socketUrl = "http://localhost:3001";

    socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      timeout: 20000,
    });

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("message:received", onBotMessage);
    socket.on("bot:typing", onBotTyping);
    socket.on("botStop:typing", onBotStopTyping);
    socket.on("voice:response", onVoiceResponse);
    socket.on("livechat:started", onLivechatStarted);
    socket.on("livechat:ended", onLivechatEnded);
  }

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = () => {
  if (socket) {
    console.log("I am inside socket disconnect");
    socket.disconnect();
    socket = null;
  }
};
