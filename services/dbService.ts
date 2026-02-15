
import { Message, ChatSession } from '../types';

const STORAGE_KEY_MESSAGES = 'chatnest_messages_v1';
const STORAGE_KEY_CHATS = 'chatnest_sessions_v1';

export const dbService = {
  getMessages: (chatId: string): Message[] => {
    const data = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (!data) return [];
    try {
      const messages: Message[] = JSON.parse(data);
      return messages.filter(m => m.chatId === chatId).sort((a, b) => a.timestamp - b.timestamp);
    } catch (e) {
      return [];
    }
  },

  saveMessage: (message: Message): void => {
    const data = localStorage.getItem(STORAGE_KEY_MESSAGES);
    let messages: Message[] = data ? JSON.parse(data) : [];
    const existingIndex = messages.findIndex(m => m.id === message.id);
    
    if (existingIndex > -1) {
      messages[existingIndex] = message;
    } else {
      messages.push(message);
    }
    
    // Attempt to save with quota handling
    try {
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
    } catch (e) {
      console.warn("Storage quota exceeded, pruning old messages...");
      // If quota exceeded, remove oldest 40% of messages
      if (messages.length > 10) {
        messages = messages.slice(Math.floor(messages.length * 0.4));
        try {
          localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
        } catch (retryError) {
          // If still failing, clear everything except the last 5 messages as a last resort
          localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages.slice(-5)));
        }
      }
    }
    dbService.updateChatSession(message.chatId, message.text || (message.media ? `[${message.media.type}]` : ''), message.timestamp);
  },

  addReaction: (messageId: string, userId: string, emoji: string): void => {
    const data = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (!data) return;
    let messages: Message[] = JSON.parse(data);
    const msg = messages.find(m => m.id === messageId);
    if (msg) {
      if (!msg.reactions) msg.reactions = {};
      if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
      
      const userIndex = msg.reactions[emoji].indexOf(userId);
      if (userIndex > -1) {
        msg.reactions[emoji].splice(userIndex, 1);
        if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
      } else {
        msg.reactions[emoji].push(userId);
      }
      try {
        localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
      } catch (e) {
        // Quota error handling for reactions too
        messages = messages.slice(Math.floor(messages.length * 0.2));
        localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
      }
    }
  },

  getChats: (): ChatSession[] => {
    const data = localStorage.getItem(STORAGE_KEY_CHATS);
    if (!data) return defaultChats;
    try {
      return JSON.parse(data);
    } catch (e) {
      return defaultChats;
    }
  },

  saveChats: (chats: ChatSession[]): void => {
    try {
      localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(chats));
    } catch (e) {
      // Chats are usually small, but if this fails, we just don't save
    }
  },

  updateChatSession: (chatId: string, lastMsg: string, time: number): void => {
    const chats = dbService.getChats();
    const updated = chats.map(c => 
      c.id === chatId ? { ...c, lastMessage: lastMsg, lastTimestamp: time } : c
    );
    dbService.saveChats(updated);
  }
};

const defaultChats: ChatSession[] = [
  {
    id: 'ai-gemini',
    name: 'ChatNest AI Assistant',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=chatnest-ai',
    phone: 'NEST-AI-LINK',
    lastMessage: 'Welcome to your new nest! How can I help you today?',
    lastTimestamp: Date.now(),
    isOnline: true,
    type: 'ai',
    unreadCount: 0
  }
];
