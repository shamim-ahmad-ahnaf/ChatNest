
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
    
    try {
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
    } catch (e) {
      if (messages.length > 10) {
        messages = messages.slice(Math.floor(messages.length * 0.4));
        localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
      }
    }
    dbService.updateChatSession(message.chatId, message.text || (message.media ? `[${message.media.type}]` : ''), message.timestamp);
  },

  deleteMessage: (messageId: string): void => {
    const data = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (!data) return;
    let messages: Message[] = JSON.parse(data);
    messages = messages.filter(m => m.id !== messageId);
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
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
    } catch (e) {}
  },

  deleteChat: (chatId: string): void => {
    // Delete Chat Session
    let chats = dbService.getChats();
    chats = chats.filter(c => c.id !== chatId);
    dbService.saveChats(chats);

    // Delete associated messages
    const data = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (data) {
      let messages: Message[] = JSON.parse(data);
      messages = messages.filter(m => m.chatId !== chatId);
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
    }
  },

  updateChatSession: (chatId: string, lastMsg: string, time: number): void => {
    const chats = dbService.getChats();
    const chatExists = chats.find(c => c.id === chatId);
    if (!chatExists) return;

    const updated = chats.map(c => 
      c.id === chatId ? { ...c, lastMessage: lastMsg, lastTimestamp: time } : c
    );
    dbService.saveChats(updated);
  }
};

const defaultChats: ChatSession[] = [
  {
    id: 'ai-gemini',
    name: 'Neo AI Assistant',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=chatnest-ai',
    phone: 'NEST-AI-LINK',
    lastMessage: 'Welcome to your new nest! How can I help you today?',
    lastTimestamp: Date.now(),
    isOnline: true,
    type: 'ai',
    unreadCount: 0
  }
];
