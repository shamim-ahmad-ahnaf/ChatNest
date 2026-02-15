
export enum MessageStatus {
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  text: string;
  timestamp: number;
  status: MessageStatus;
  isAI?: boolean;
  media?: {
    type: 'image' | 'audio' | 'video' | 'file';
    url: string;
    mimeType: string;
    fileName?: string;
  };
  reactions?: { [emoji: string]: string[] }; // Map of emoji to list of user IDs
  sources?: any[]; // Grounding sources from Gemini API
}

export interface ChatSession {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  bio?: string;
  lastMessage?: string;
  lastTimestamp?: number;
  isOnline: boolean;
  type: 'contact' | 'ai' | 'group' | 'global';
  unreadCount: number;
  members?: string[]; // Array of contact IDs/phones
  admins?: string[]; // Array of contact IDs/phones who are admins
}

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  bio: string;
  status: 'online' | 'offline';
  lastSeen?: number;
}
