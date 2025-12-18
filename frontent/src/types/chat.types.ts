export interface Message {
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
}

export interface UserDetails {
  name: string;
  phone: string;
  email: string;
  subject: string;
}

export type Attachment = {
  payload: {
    mediaId: string;
    path: string;
  } | null;
  type: string;
} | null;

export interface TransferRequest {
  text: string;
  id: string;
  type: string;
  ping?: boolean;
  notification?: boolean;
  buttons?: {
    title: string;
    payload: string;
  }[];
}
