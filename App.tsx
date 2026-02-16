
import React, { useState, useEffect, useRef } from 'react';
import { Peer, DataConnection, MediaConnection } from "peerjs";
import { Message, ChatSession, MessageStatus, UserProfile } from './types';
import { dbService } from './services/dbService';
import { geminiService } from './services/geminiService';
import { 
    Search, MoreVertical, Phone, Video, Send, ArrowLeft,
    CheckCheck, MessageSquare, Bot, Users, X, Camera, PhoneOff,
    Zap, Plus, Edit3, Settings2, Moon, Sun, ExternalLink,
    PlusCircle, UserPlus, UserPlus2, Wifi, WifiOff, Copy, Check,
    Users2, Headphones, Share2, Mic, Paperclip, Play, Pause,
    Video as VideoIcon, MicOff, CameraOff, Volume2, Image as ImageIcon,
    FileText, User, Trash2, Sparkles, Globe
} from 'lucide-react';

const THEME_COLORS = [{ name: 'orange', class: 'orange-500', hex: '#f97316' }];

// Declare global for aistudio API key selection helpers
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  // --- States ---
  const [isRegistered, setIsRegistered] = useState(() => !!localStorage.getItem('chatnest_profile'));
  const [myProfile, setMyProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('chatnest_profile');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('chatnest_dark') === 'true');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSession[]>(dbService.getChats());
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [targetPeerId, setTargetPeerId] = useState('');
  const [copyStatus, setCopyStatus] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // --- Call States ---
  const [incomingCall, setIncomingCall] = useState<{peerId: string, type: 'audio' | 'video', call: MediaConnection} | null>(null);
  const [activeCall, setActiveCall] = useState<{stream: MediaStream, remoteStream: MediaStream, type: 'audio' | 'video', call: MediaConnection} | null>(null);

  // --- Voice Message States ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // --- Peer Refs ---
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<{ [key: string]: DataConnection }>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const activeChat = chats.find(c => c.id === activeChatId);
  const currentTheme = THEME_COLORS[0];

  // --- Lifecycle & Initialization ---
  useEffect(() => {
    if (isRegistered && myProfile) {
      const peer = new Peer(myProfile.id);
      peerRef.current = peer;

      // Handle incoming data connections
      peer.on('connection', (conn) => {
        conn.on('open', () => {
          connectionsRef.current[conn.peer] = conn;
          // Send my profile info back so they know who I am
          conn.send({ type: 'profile_sync', profile: myProfile });
        });
        conn.on('data', (data: any) => handlePeerData(data, conn.peer));
      });

      // Handle incoming media calls
      peer.on('call', (call) => {
        const type = call.metadata?.type || 'audio';
        setIncomingCall({ peerId: call.peer, type, call });
      });

      return () => { peer.destroy(); };
    }
  }, [isRegistered, myProfile?.id]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('chatnest_dark', isDarkMode.toString());
  }, [isDarkMode]);

  useEffect(() => {
    if (activeChatId) setMessages(dbService.getMessages(activeChatId));
  }, [activeChatId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- Data Handling ---
  const handlePeerData = (data: any, peerId: string) => {
    if (data.type === 'message') {
      handleReceivedMessage(data.message, peerId);
    } else if (data.type === 'profile_sync') {
      updateChatWithProfile(data.profile);
    }
  };

  const updateChatWithProfile = (profile: UserProfile) => {
    setChats(prev => {
      const existing = prev.find(c => c.id === profile.id);
      let updated;
      if (existing) {
        updated = prev.map(c => c.id === profile.id ? { ...c, name: profile.name, avatar: profile.avatar } : c);
      } else {
        const newChat: ChatSession = {
          id: profile.id, name: profile.name, avatar: profile.avatar,
          phone: profile.phone, isOnline: true, type: 'contact', unreadCount: 0,
          lastMessage: 'Nest linked'
        };
        updated = [newChat, ...prev];
      }
      dbService.saveChats(updated);
      return updated;
    });
  };

  const handleReceivedMessage = (msg: Message, peerId: string) => {
    dbService.saveMessage(msg);
    setChats(dbService.getChats());
    if (activeChatId === peerId || msg.chatId === activeChatId) {
      setMessages(prev => [...prev, msg]);
    }
  };

  // --- Actions ---
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const name = formData.get('name') as string;
    const phone = formData.get('phone') as string;
    const cleanId = phone.replace(/[^0-9]/g, '');
    const newProfile: UserProfile = {
        id: `nest-${cleanId || Math.random().toString(36).substr(2, 6)}`,
        name, phone,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
        bio: 'Just landed in the Nest!', status: 'online'
    };
    setMyProfile(newProfile);
    localStorage.setItem('chatnest_profile', JSON.stringify(newProfile));
    setIsRegistered(true);
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    if (!myProfile) return;
    const updated = { ...myProfile, ...updates };
    setMyProfile(updated);
    localStorage.setItem('chatnest_profile', JSON.stringify(updated));
    // Broadcast my profile update to active connections
    // FIX: Cast Object.values to DataConnection array to resolve property 'open' error
    (Object.values(connectionsRef.current) as DataConnection[]).forEach(conn => {
      if (conn.open) conn.send({ type: 'profile_sync', profile: updated });
    });
  };

  const connectToPeer = (id: string) => {
    if (!peerRef.current || !myProfile || id === myProfile.id) return;
    const conn = peerRef.current.connect(id);
    conn.on('open', () => {
      connectionsRef.current[id] = conn;
      conn.send({ type: 'profile_sync', profile: myProfile });
      setActiveChatId(id);
      setShowConnectModal(false);
      setTargetPeerId('');
    });
    conn.on('data', (data) => handlePeerData(data, id));
  };

  const handleSendMessage = async (text: string, media?: Message['media']) => {
    if ((!text.trim() && !media) || !activeChatId || !myProfile) return;
    
    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2,4)}`, 
      chatId: activeChatId, senderId: myProfile.id,
      senderName: myProfile.name, senderAvatar: myProfile.avatar, text,
      timestamp: Date.now(), status: MessageStatus.SENT, media
    };

    setMessages(prev => [...prev, newMessage]);
    dbService.saveMessage(newMessage);
    setInputText('');

    // Handle AI Assistant interaction
    if (activeChatId === 'ai-gemini') {
      handleAIResponse(text);
    } else {
      const conn = connectionsRef.current[activeChatId];
      if (conn && conn.open) {
        conn.send({ type: 'message', message: newMessage });
      }
    }
    setChats(dbService.getChats());
  };

  // --- AI Assistant Logic ---
  const handleAIResponse = async (text: string) => {
    setIsGenerating(true);
    
    // Slash commands for media generation
    if (text.startsWith('/image ')) {
      const prompt = text.replace('/image ', '');
      const imageUrl = await geminiService.generateImage(prompt);
      if (imageUrl) {
        const aiMsg: Message = {
          id: `msg-ai-${Date.now()}`,
          chatId: 'ai-gemini',
          senderId: 'ai-gemini',
          senderName: 'Neo AI',
          senderAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=chatnest-ai',
          text: `Here is your generated image for: "${prompt}"`,
          timestamp: Date.now(),
          status: MessageStatus.DELIVERED,
          media: { type: 'image', url: imageUrl, mimeType: 'image/png' },
          isAI: true
        };
        saveAndPushAIMessage(aiMsg);
      }
      setIsGenerating(false);
      return;
    }

    if (text.startsWith('/video ')) {
      // Mandatory: Check for paid API key selection before using Veo models
      if (!(await window.aistudio.hasSelectedApiKey())) {
        alert("Veo video generation requires a paid API key. Please configure this in Settings.");
        setIsGenerating(false);
        return;
      }

      const prompt = text.replace('/video ', '');
      const videoUrl = await geminiService.generateVideo(prompt);
      if (videoUrl) {
        const aiMsg: Message = {
          id: `msg-ai-${Date.now()}`,
          chatId: 'ai-gemini',
          senderId: 'ai-gemini',
          senderName: 'Neo AI',
          senderAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=chatnest-ai',
          text: `Your video for: "${prompt}" is ready!`,
          timestamp: Date.now(),
          status: MessageStatus.DELIVERED,
          media: { type: 'video', url: videoUrl, mimeType: 'video/mp4' },
          isAI: true
        };
        saveAndPushAIMessage(aiMsg);
      }
      setIsGenerating(false);
      return;
    }

    // Standard Chat with History
    const history = messages.slice(-10).map(m => ({
      role: m.senderId === 'ai-gemini' ? 'model' : 'user',
      text: m.text || (m.media ? `[${m.media.type}]` : '')
    }));

    const response = await geminiService.getChatResponse(text, history);
    const aiMsg: Message = {
      id: `msg-ai-${Date.now()}`,
      chatId: 'ai-gemini',
      senderId: 'ai-gemini',
      senderName: 'Neo AI',
      senderAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=chatnest-ai',
      text: response.text,
      timestamp: Date.now(),
      status: MessageStatus.DELIVERED,
      isAI: true,
      sources: response.sources
    };
    saveAndPushAIMessage(aiMsg);
    setIsGenerating(false);
  };

  const saveAndPushAIMessage = (msg: Message) => {
    dbService.saveMessage(msg);
    setMessages(prev => [...prev, msg]);
    setChats(dbService.getChats());
  };

  // --- Recording Logic ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          handleSendMessage('', {
            type: 'audio',
            url: reader.result as string,
            mimeType: 'audio/webm',
            fileName: 'Voice Message'
          });
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      const interval = setInterval(() => setRecordingDuration(d => d + 1), 1000);
      (mediaRecorder as any)._interval = interval;
    } catch (err) { alert("Microphone needed for voice messages."); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      clearInterval((mediaRecorderRef.current as any)._interval);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // --- Call Handling ---
  const startCall = async (type: 'audio' | 'video') => {
    if (!activeChatId || !peerRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: type === 'video' 
      });
      const call = peerRef.current.call(activeChatId, stream, { metadata: { type } });
      setActiveCall({ stream, remoteStream: new MediaStream(), type, call });

      call.on('stream', (remoteStream) => {
        setActiveCall(prev => prev ? { ...prev, remoteStream } : null);
      });
      call.on('close', endCall);
    } catch (err) { alert("Camera/Mic access failed."); }
  };

  const answerCall = async () => {
    if (!incomingCall) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: incomingCall.type === 'video' 
      });
      incomingCall.call.answer(stream);
      setActiveCall({ stream, remoteStream: new MediaStream(), type: incomingCall.type, call: incomingCall.call });
      
      incomingCall.call.on('stream', (remoteStream) => {
        setActiveCall(prev => prev ? { ...prev, remoteStream } : null);
      });
      incomingCall.call.on('close', endCall);
      setIncomingCall(null);
    } catch (err) { alert("Failed to answer call."); }
  };

  const endCall = () => {
    if (activeCall) {
      activeCall.stream.getTracks().forEach(t => t.stop());
      activeCall.call.close();
      setActiveCall(null);
    }
    setIncomingCall(null);
  };

  // --- UI Utils ---
  const copyId = () => {
    if (myProfile) {
      navigator.clipboard.writeText(myProfile.id);
      setCopyStatus(true);
      setTimeout(() => setCopyStatus(false), 2000);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const type = file.type.startsWith('image/') ? 'image' : 'file';
      handleSendMessage('', {
        type: type as any,
        url: reader.result as string,
        mimeType: file.type,
        fileName: file.name
      });
    };
    reader.readAsDataURL(file);
  };

  if (!isRegistered) {
    return (
        <div className="h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
            <div className="w-full max-md bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95">
                <div className="w-20 h-20 bg-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-8"><Zap className="w-10 h-10 text-white" /></div>
                <h1 className="text-3xl font-black text-center mb-2">Welcome to Nest</h1>
                <p className="text-slate-400 text-center mb-8 font-medium">Create your profile and start direct P2P nesting.</p>
                <form onSubmit={handleRegister} className="space-y-6">
                    <input name="name" type="text" placeholder="Your Name" className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border border-transparent focus:border-orange-500 font-bold" required />
                    <input name="phone" type="tel" placeholder="Your Phone Number" className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border border-transparent focus:border-orange-500 font-bold" required />
                    <button type="submit" className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black text-lg shadow-xl hover:scale-105 transition-all">Start Direct Chat</button>
                </form>
            </div>
        </div>
    );
  }

  return (
    <div className={`flex h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-jakarta selection:bg-orange-500/20`}>
      {/* Sidebar */}
      <aside className={`${activeChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col border-r border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50 relative overflow-hidden`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-black text-orange-500">ChatNest</h1>
            <div className="flex gap-2">
                <button onClick={() => setShowConnectModal(true)} className="p-2.5 bg-orange-500/10 text-orange-500 rounded-xl hover:scale-105 transition-all"><UserPlus2 className="w-5 h-5" /></button>
                <button onClick={() => setShowSettings(true)} className="w-10 h-10 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700">
                    <img src={myProfile?.avatar} className="w-full h-full object-cover" alt="Me" />
                </button>
            </div>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search chats..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white dark:bg-slate-800 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none shadow-sm focus:ring-2 ring-orange-500/10" />
          </div>
          
          <div className="space-y-1 overflow-y-auto flex-1">
            {chats.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map(chat => (
                <div key={chat.id} onClick={() => setActiveChatId(chat.id)} className={`flex items-center gap-4 p-4 cursor-pointer rounded-3xl transition-all ${activeChatId === chat.id ? 'bg-white dark:bg-slate-800 shadow-md' : 'hover:bg-white/50'}`}>
                    <div className="relative">
                        <img src={chat.avatar} className="w-12 h-12 rounded-xl object-cover" alt={chat.name} />
                        <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-white dark:border-slate-900 rounded-full ${chat.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    </div>
                    <div className="flex-1 truncate">
                        <div className="flex justify-between items-center">
                          <h3 className="font-bold text-sm truncate flex items-center gap-1">
                            {chat.name} {chat.type === 'ai' && <Sparkles className="w-3 h-3 text-orange-500" />}
                          </h3>
                        </div>
                        <p className="text-xs opacity-50 truncate">{chat.lastMessage}</p>
                    </div>
                </div>
            ))}
          </div>
        </div>

        {/* Global Connection Badge */}
        <div className="absolute bottom-4 left-6 right-6">
            <div className="bg-slate-900 text-white p-3 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black tracking-widest uppercase">Nest Engine Active</span>
                </div>
                <code className="text-[9px] opacity-40 font-bold">{myProfile?.id}</code>
            </div>
        </div>
      </aside>

      {/* Main Chat View */}
      <main className={`${activeChatId ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col h-full relative`}>
        {activeChat ? (
          <>
            <header className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-40 sticky top-0">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveChatId(null)} className="md:hidden p-2 text-slate-400"><ArrowLeft /></button>
                <img src={activeChat.avatar} className="w-10 h-10 rounded-xl object-cover" />
                <div>
                    <h2 className="font-bold flex items-center gap-2">
                      {activeChat.name}
                      {activeChat.type === 'ai' && <Bot className="w-4 h-4 text-orange-500" />}
                    </h2>
                    <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest flex items-center gap-1">
                        {activeChat.type === 'ai' ? 'Neural Link Active' : 'Direct Link Active'}
                    </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {activeChat.type !== 'ai' && (
                  <>
                    <button onClick={() => startCall('audio')} className="p-3 text-slate-400 hover:text-orange-500 transition-colors"><Phone className="w-5 h-5" /></button>
                    <button onClick={() => startCall('video')} className="p-3 text-slate-400 hover:text-orange-500 transition-colors"><VideoIcon className="w-5 h-5" /></button>
                  </>
                )}
                <button className="p-3 text-slate-400"><MoreVertical /></button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.senderId === myProfile?.id ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${msg.senderId === myProfile?.id ? 'bg-orange-500 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-800 rounded-tl-none'}`}>
                      {msg.text && <p className="text-sm font-medium whitespace-pre-wrap">{msg.text}</p>}
                      
                      {/* Media Rendering */}
                      {msg.media?.type === 'image' && <img src={msg.media.url} className="rounded-xl max-w-full mb-1 mt-3 border border-white/10" />}
                      {msg.media?.type === 'video' && <video src={msg.media.url} controls className="rounded-xl max-w-full mb-1 mt-3 border border-white/10" />}
                      {msg.media?.type === 'audio' && (
                        <audio controls src={msg.media.url} className="mt-2 h-10 w-48" />
                      )}
                      {msg.media?.type === 'file' && (
                        <a href={msg.media.url} download={msg.media.fileName} className="flex items-center gap-2 p-3 bg-white/10 rounded-xl text-xs font-bold mt-2">
                            <FileText className="w-4 h-4" /> {msg.media.fileName}
                        </a>
                      )}

                      {/* Grounding Sources */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-tighter opacity-70 flex items-center gap-1"><Globe className="w-3 h-3" /> Grounding Sources</p>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((source, idx) => (
                              <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] font-bold transition-all truncate max-w-[150px]">
                                <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" /> {source.title || 'Source'}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-1 mt-2 opacity-50 text-[9px] font-bold">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {msg.senderId === myProfile?.id && <CheckCheck className="w-3 h-3" />}
                      </div>
                    </div>
                </div>
              ))}
              {isGenerating && (
                <div className="flex flex-col items-start">
                  <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none animate-pulse">
                    <div className="flex gap-1.5">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>

            <footer className="p-6 bg-white dark:bg-slate-950">
              {activeChat.type === 'ai' && inputText.length === 0 && !isRecording && (
                <div className="max-w-4xl mx-auto flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                  <button onClick={() => setInputText('/image A Cyberpunk city in the clouds')} className="whitespace-nowrap px-4 py-2 bg-slate-100 dark:bg-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all">/image</button>
                  <button onClick={() => setInputText('/video A robot walking on Mars')} className="whitespace-nowrap px-4 py-2 bg-slate-100 dark:bg-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all">/video</button>
                </div>
              )}
              <div className="max-w-4xl mx-auto flex items-center gap-3">
                <div className="flex-1 flex items-end gap-3 p-2 bg-slate-50 dark:bg-slate-900 rounded-[2rem] border border-slate-200/50 dark:border-slate-800 shadow-sm relative">
                    <label className="p-3 text-slate-400 hover:text-orange-500 transition-colors cursor-pointer">
                        <Plus className="w-6 h-6" />
                        <input type="file" className="hidden" onChange={handleFileSelect} />
                    </label>
                    <textarea 
                        rows={1} 
                        value={inputText} 
                        onChange={(e) => setInputText(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage(inputText))} 
                        placeholder={isRecording ? `Recording... ${recordingDuration}s` : (activeChat.type === 'ai' ? "Ask Neo anything or use commands..." : "Type a message...")} 
                        className={`flex-1 bg-transparent py-3 outline-none text-sm font-medium resize-none min-h-[48px] ${isRecording ? 'text-orange-500 font-black' : ''}`}
                        disabled={isRecording || isGenerating}
                    />
                    
                    <button 
                        onMouseDown={startRecording}
                        onMouseUp={stopRecording}
                        onTouchStart={startRecording}
                        onTouchEnd={stopRecording}
                        className={`p-3 rounded-full transition-all ${isRecording ? 'bg-orange-500 text-white scale-125' : 'text-slate-400 hover:text-orange-500'}`}
                    >
                        <Mic className="w-6 h-6" />
                    </button>
                    
                    <button onClick={() => handleSendMessage(inputText)} disabled={isGenerating} className="p-3 bg-orange-500 text-white rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                        <Send className="w-6 h-6" />
                    </button>
                </div>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
            <div className="w-24 h-24 bg-orange-500/10 rounded-[2.5rem] flex items-center justify-center mb-8"><Zap className="w-12 h-12 text-orange-500" /></div>
            <h2 className="text-4xl font-black mb-4">Start Nesting</h2>
            <p className="opacity-50 text-sm max-w-sm font-medium">Connect with IDs to start secure, serverless direct conversations with media and calls.</p>
            <button onClick={() => setShowConnectModal(true)} className="mt-8 flex items-center gap-2 bg-orange-500 text-white px-8 py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition-all">
                <UserPlus className="w-5 h-5" /> Connect to a Friend
            </button>
          </div>
        )}
      </main>

      {/* --- Overlay Modals --- */}

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md" onClick={() => setShowConnectModal(false)}>
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-8 shadow-2xl relative animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowConnectModal(false)} className="absolute top-6 right-6 text-slate-400 p-2"><X /></button>
                <h2 className="text-2xl font-black mb-6 flex items-center gap-3"><div className="p-3 bg-orange-500/10 rounded-2xl"><UserPlus2 className="w-6 h-6 text-orange-500" /></div>Link to Friend</h2>
                <div className="space-y-4">
                    <p className="text-xs font-medium opacity-60">Enter the unique Nest ID to start a secure direct connection.</p>
                    <input autoFocus value={targetPeerId} onChange={e => setTargetPeerId(e.target.value)} type="text" placeholder="nest-xxxxxxxxxx" className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-orange-500 font-bold" />
                    <button onClick={() => connectToPeer(targetPeerId)} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black text-lg shadow-xl hover:scale-[1.02] active:scale-95 transition-all">Establish Link</button>
                </div>
            </div>
        </div>
      )}

      {/* Settings / Profile Edit Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md" onClick={() => setShowSettings(false)}>
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-2xl relative animate-in slide-in-from-bottom-4 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowSettings(false)} className="absolute top-8 right-8 text-slate-400 p-2"><X /></button>
                <h2 className="text-3xl font-black mb-8 flex items-center gap-3"><Settings2 className="w-8 h-8 text-orange-500" /> Profile Settings</h2>
                
                <div className="flex flex-col items-center gap-8">
                    <div className="relative group">
                        <img src={myProfile?.avatar} className="w-32 h-32 rounded-[2.5rem] object-cover border-4 border-orange-500/20" />
                        <label className="absolute inset-0 bg-black/40 rounded-[2.5rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <Camera className="text-white" />
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => updateProfile({ avatar: reader.result as string });
                                    reader.readAsDataURL(file);
                                }
                            }} />
                        </label>
                    </div>

                    <div className="w-full space-y-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">My Nest ID</label>
                            <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl">
                                <code className="font-bold text-orange-500">{myProfile?.id}</code>
                                <button onClick={copyId} className="p-2 hover:bg-white rounded-xl transition-all">
                                    {copyStatus ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Display Name</label>
                            <input 
                                value={myProfile?.name} 
                                onChange={(e) => updateProfile({ name: e.target.value })} 
                                className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none font-bold"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Bio</label>
                            <textarea 
                                value={myProfile?.bio} 
                                onChange={(e) => updateProfile({ bio: e.target.value })} 
                                className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none font-bold resize-none"
                            />
                        </div>

                        {/* API Key Selection for Advanced AI Features */}
                        <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-widest text-orange-500 flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5" /> High-Quality Generation
                          </label>
                          <p className="text-[11px] font-medium opacity-60">
                            Video generation requires selecting a paid API key from your project.
                            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-orange-500 hover:underline inline-flex items-center gap-0.5 ml-1">Billing info <ExternalLink className="w-2.5 h-2.5" /></a>
                          </p>
                          <button 
                            onClick={async () => { await window.aistudio.openSelectKey(); }} 
                            className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                          >
                            Select Paid API Key
                          </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full">
                        <button onClick={() => setIsDarkMode(!isDarkMode)} className="py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black flex items-center justify-center gap-2">
                            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />} {isDarkMode ? 'Light' : 'Dark'}
                        </button>
                        <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="py-4 bg-rose-50 text-rose-500 rounded-2xl font-black flex items-center justify-center gap-2">
                            <Trash2 className="w-5 h-5" /> Reset Profile
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Incoming Call Overlay */}
      {incomingCall && (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 flex flex-col items-center justify-center text-white backdrop-blur-xl p-10 text-center animate-in zoom-in-95">
            <div className="w-32 h-32 bg-orange-500 rounded-[2.5rem] flex items-center justify-center mb-8 relative">
                <div className="absolute inset-0 bg-orange-500 rounded-[2.5rem] animate-ping opacity-20" />
                <Users className="w-16 h-16" />
            </div>
            <h2 className="text-4xl font-black mb-2">{incomingCall.peerId}</h2>
            <p className="text-xl font-bold opacity-70 mb-20 animate-pulse">Incoming {incomingCall.type} call...</p>
            <div className="flex gap-10">
                <button onClick={endCall} className="w-20 h-20 bg-rose-500 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all"><PhoneOff className="w-8 h-8" /></button>
                <button onClick={answerCall} className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all"><Phone className="w-8 h-8" /></button>
            </div>
        </div>
      )}

      {/* Active Call UI */}
      {activeCall && (
        <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col items-center justify-center">
            {activeCall.type === 'video' ? (
                <div className="w-full h-full relative">
                    {/* Remote Stream (Main View) */}
                    <video 
                        ref={el => { if (el && activeCall.remoteStream) el.srcObject = activeCall.remoteStream; }} 
                        autoPlay 
                        className="w-full h-full object-cover"
                    />
                    {/* Local Stream (PIP) */}
                    <video 
                        ref={el => { if (el && activeCall.stream) el.srcObject = activeCall.stream; }} 
                        autoPlay 
                        muted
                        className="absolute bottom-10 right-10 w-48 h-64 bg-slate-900 rounded-2xl border-4 border-white/20 object-cover shadow-2xl"
                    />
                </div>
            ) : (
                <div className="flex flex-col items-center">
                    <div className="w-48 h-48 bg-orange-500/20 rounded-full flex items-center justify-center mb-10">
                        <Headphones className="w-24 h-24 text-orange-500 animate-bounce" />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-2">Voice Call Active</h2>
                    <div className="flex gap-4 items-center h-8">
                        {[1,2,3,4,5].map(i => <div key={i} className="w-1.5 bg-orange-500 rounded-full animate-recording-bar" style={{ animationDelay: `${i*0.1}s`, height: '100%' }} />)}
                    </div>
                </div>
            )}
            
            <div className="absolute bottom-20 flex gap-6">
                <button onClick={endCall} className="w-20 h-20 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all">
                    <PhoneOff className="w-8 h-8" />
                </button>
            </div>
        </div>
      )}
    </div>
  );
}
