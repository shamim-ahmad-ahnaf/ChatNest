
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

export default function App() {
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
  const [hasApiKey, setHasApiKey] = useState(true);

  // Editing state
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);

  // Calling states
  const [incomingCall, setIncomingCall] = useState<{peerId: string, type: 'audio' | 'video', call: MediaConnection} | null>(null);
  const [activeCall, setActiveCall] = useState<{stream: MediaStream, remoteStream: MediaStream | null, type: 'audio' | 'video', call: MediaConnection} | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<{ [key: string]: DataConnection }>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const activeChat = chats.find(c => c.id === activeChatId);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    checkApiKey();
  }, []);

  useEffect(() => {
    if (isRegistered && myProfile) {
      const peer = new Peer(myProfile.id);
      peerRef.current = peer;

      peer.on('connection', (conn) => {
        conn.on('open', () => {
          connectionsRef.current[conn.peer] = conn;
          conn.send({ type: 'profile_sync', profile: myProfile });
        });
        conn.on('data', (data: any) => handlePeerData(data, conn.peer));
      });

      peer.on('call', (call) => {
        setIncomingCall({ peerId: call.peer, type: call.metadata?.type || 'audio', call });
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
  }, [messages, isGenerating]);

  // Hook up video elements when active call remote stream is available
  useEffect(() => {
    if (activeCall?.remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = activeCall.remoteStream;
    }
    if (activeCall?.stream && localVideoRef.current) {
      localVideoRef.current.srcObject = activeCall.stream;
    }
  }, [activeCall]);

  const handlePeerData = (data: any, peerId: string) => {
    if (data.type === 'message') {
      handleReceivedMessage(data.message, peerId);
    } else if (data.type === 'profile_sync') {
      updateChatWithProfile(data.profile);
    } else if (data.type === 'message_edit') {
      handleSyncEdit(data.msgId, data.text);
    } else if (data.type === 'message_delete') {
      handleSyncDelete(data.msgId);
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
          lastMessage: 'Link established'
        };
        updated = [newChat, ...prev];
      }
      dbService.saveChats(updated);
      return updated;
    });
  };

  const handleReceivedMessage = (msg: Message, peerId: string) => {
    const correctedMsg = { ...msg, chatId: peerId };
    dbService.saveMessage(correctedMsg);
    setChats(dbService.getChats());
    if (activeChatId === peerId) {
      setMessages(prev => [...prev, correctedMsg]);
    }
  };

  const handleSyncEdit = (msgId: string, text: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text, isEdited: true } : m));
    const allMsgs = JSON.parse(localStorage.getItem('chatnest_messages_v1') || '[]');
    const updated = allMsgs.map((m: any) => m.id === msgId ? { ...m, text, isEdited: true } : m);
    localStorage.setItem('chatnest_messages_v1', JSON.stringify(updated));
    setChats(dbService.getChats());
  };

  const handleSyncDelete = (msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    dbService.deleteMessage(msgId);
    setChats(dbService.getChats());
  };

  const handleSendMessage = async (text: string, media?: Message['media']) => {
    if ((!text.trim() && !media) || !activeChatId || !myProfile) return;

    if (editingMsgId) {
      const updatedMessages = messages.map(m => m.id === editingMsgId ? { ...m, text, isEdited: true } : m);
      setMessages(updatedMessages);
      const msgToUpdate = updatedMessages.find(m => m.id === editingMsgId)!;
      dbService.saveMessage(msgToUpdate);
      
      const conn = connectionsRef.current[activeChatId];
      if (conn?.open) {
        conn.send({ type: 'message_edit', msgId: editingMsgId, text });
      }
      
      setEditingMsgId(null);
      setInputText('');
      setChats(dbService.getChats());
      return;
    }
    
    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2,4)}`, 
      chatId: activeChatId, senderId: myProfile.id,
      senderName: myProfile.name, senderAvatar: myProfile.avatar, text,
      timestamp: Date.now(), status: MessageStatus.SENT, media
    };

    setMessages(prev => [...prev, newMessage]);
    dbService.saveMessage(newMessage);
    setInputText('');

    if (activeChatId === 'ai-gemini') {
      handleAIResponse(text);
    } else {
      const conn = connectionsRef.current[activeChatId];
      if (conn?.open) {
        conn.send({ type: 'message', message: newMessage });
      }
    }
    setChats(dbService.getChats());
  };

  const deleteMessage = (msgId: string) => {
    if (!window.confirm("ম্যাসেজটি ডিলিট করতে চান?")) return;
    setMessages(prev => prev.filter(m => m.id !== msgId));
    dbService.deleteMessage(msgId);
    
    if (activeChatId && activeChatId !== 'ai-gemini') {
      const conn = connectionsRef.current[activeChatId];
      if (conn?.open) {
        conn.send({ type: 'message_delete', msgId });
      }
    }
    setChats(dbService.getChats());
  };

  const startEdit = (msg: Message) => {
    setEditingMsgId(msg.id);
    setInputText(msg.text);
  };

  const removeChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("এই ফ্রেন্ড বা চ্যাটটি ডিলিট করতে চান?")) return;
    dbService.deleteChat(chatId);
    setChats(dbService.getChats());
    if (activeChatId === chatId) setActiveChatId(null);
  };

  const handleAIResponse = async (text: string) => {
    setIsGenerating(true);
    if (text.startsWith('/image ')) {
      const prompt = text.replace('/image ', '');
      const imageUrl = await geminiService.generateImage(prompt);
      if (imageUrl) {
        const aiMsg: Message = {
          id: `ai-${Date.now()}`, chatId: 'ai-gemini', senderId: 'ai-gemini',
          senderName: 'Neo AI', text: `Result for: ${prompt}`,
          timestamp: Date.now(), status: MessageStatus.DELIVERED,
          media: { type: 'image', url: imageUrl, mimeType: 'image/png' }, isAI: true
        };
        saveAI(aiMsg);
      }
      setIsGenerating(false); return;
    }

    const history = messages.slice(-5).map(m => ({ role: m.senderId === 'ai-gemini' ? 'model' : 'user', text: m.text }));
    const resp = await geminiService.getChatResponse(text, history);
    const aiMsg: Message = {
      id: `ai-${Date.now()}`, chatId: 'ai-gemini', senderId: 'ai-gemini',
      senderName: 'Neo AI', text: resp.text, timestamp: Date.now(),
      status: MessageStatus.DELIVERED, isAI: true, sources: resp.sources
    };
    saveAI(aiMsg);
    setIsGenerating(false);
  };

  const saveAI = (msg: Message) => {
    dbService.saveMessage(msg);
    setMessages(prev => [...prev, msg]);
    setChats(dbService.getChats());
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const name = formData.get('name') as string;
    const phone = formData.get('phone') as string;
    const cleanId = phone.replace(/[^0-9]/g, '');
    const newProfile: UserProfile = {
        id: `nest-${cleanId || Math.random().toString(36).substr(2, 6)}`,
        name, phone, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
        bio: 'Hello!', status: 'online'
    };
    setMyProfile(newProfile);
    localStorage.setItem('chatnest_profile', JSON.stringify(newProfile));
    setIsRegistered(true);
  };

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    if (!myProfile) return;
    const updated = { ...myProfile, ...updates };
    setMyProfile(updated);
    localStorage.setItem('chatnest_profile', JSON.stringify(updated));
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
  };

  // Call functionality
  const startCall = async (type: 'audio' | 'video') => {
    if (!activeChatId || !peerRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: type === 'video' 
      });
      const call = peerRef.current.call(activeChatId, stream, { metadata: { type } });
      setActiveCall({ stream, remoteStream: null, type, call });
      
      call.on('stream', (remoteStream) => {
        setActiveCall(prev => prev ? { ...prev, remoteStream } : null);
      });
      call.on('close', endCall);
    } catch (err) {
      alert("Camera or Microphone access denied.");
    }
  };

  const answerCall = async () => {
    if (!incomingCall) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: incomingCall.type === 'video' 
      });
      incomingCall.call.answer(stream);
      setActiveCall({ 
        stream, 
        remoteStream: null, 
        type: incomingCall.type, 
        call: incomingCall.call 
      });

      incomingCall.call.on('stream', (remoteStream) => {
        setActiveCall(prev => prev ? { ...prev, remoteStream } : null);
      });
      incomingCall.call.on('close', endCall);
      setIncomingCall(null);
    } catch (err) {
      alert("Could not access media devices.");
    }
  };

  const endCall = () => {
    if (activeCall) {
      activeCall.stream.getTracks().forEach(t => t.stop());
      activeCall.call.close();
      setActiveCall(null);
    }
    setIncomingCall(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      handleSendMessage('', { type: file.type.startsWith('image/') ? 'image' : 'file', url: reader.result as string, mimeType: file.type, fileName: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      updateProfile({ avatar: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder; audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => handleSendMessage('', { type: 'audio', url: reader.result as string, mimeType: 'audio/webm', fileName: 'Voice' });
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start(); setIsRecording(true); setRecordingDuration(0);
      const iv = setInterval(() => setRecordingDuration(d => d + 1), 1000);
      (mediaRecorder as any)._iv = iv;
    } catch (e) { alert("Mic required"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      clearInterval((mediaRecorderRef.current as any)._iv);
      mediaRecorderRef.current.stop(); setIsRecording(false);
    }
  };

  if (!isRegistered) {
    return (
        <div className="h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 border border-orange-500/10">
                <div className="w-20 h-20 bg-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-orange-500/20"><Zap className="w-10 h-10 text-white" /></div>
                <h1 className="text-3xl font-black text-center mb-6 text-slate-800 dark:text-white">ChatNest</h1>
                <form onSubmit={handleRegister} className="space-y-6">
                    <input name="name" type="text" placeholder="আপনার নাম" className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-orange-500 font-bold transition-all" required />
                    <input name="phone" type="tel" placeholder="ফোন নম্বর" className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-orange-500 font-bold transition-all" required />
                    <button type="submit" className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-orange-500/30 hover:scale-[1.02] active:scale-95 transition-all">শুরু করুন</button>
                </form>
            </div>
        </div>
    );
  }

  if (!hasApiKey) {
    return (
      <div className="h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 border border-orange-500/10">
          <div className="w-20 h-20 bg-orange-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <Sparkles className="w-10 h-10 text-orange-500" />
          </div>
          <h2 className="text-3xl font-black mb-4 text-slate-800 dark:text-white">API Key Required</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">
            Neo AI features and video generation require a valid Gemini API key.
          </p>
          <button 
            onClick={handleOpenKeySelector} 
            className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-orange-500/30 hover:scale-[1.02] transition-transform active:scale-95"
          >
            Select API Key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-jakarta selection:bg-orange-500/30`}>
      {/* Sidebar */}
      <aside className={`${activeChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col border-r border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50 relative backdrop-blur-sm`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-black text-orange-500 flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20"><Zap className="w-4 h-4 text-white" /></div>
                ChatNest
            </h1>
            <div className="flex gap-2">
                <button onClick={() => setShowConnectModal(true)} className="p-2.5 bg-orange-500/10 text-orange-500 rounded-xl hover:scale-105 active:scale-95 transition-all"><UserPlus2 className="w-5 h-5" /></button>
                <button onClick={() => setShowSettings(true)} className="w-10 h-10 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700 hover:ring-2 ring-orange-500/30 transition-all">
                    <img src={myProfile?.avatar} className="w-full h-full object-cover" alt="Me" />
                </button>
            </div>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="সার্চ করুন..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white dark:bg-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-sm outline-none shadow-sm border border-slate-100 dark:border-slate-700/50 focus:ring-2 ring-orange-500/20 transition-all" />
          </div>
          
          <div className="space-y-2 overflow-y-auto flex-1 pr-2 custom-scrollbar">
            {chats.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map(chat => (
                <div key={chat.id} onClick={() => setActiveChatId(chat.id)} className={`group flex items-center gap-4 p-4 cursor-pointer rounded-[2rem] transition-all relative ${activeChatId === chat.id ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/30' : 'hover:bg-white dark:hover:bg-slate-800 shadow-sm'}`}>
                    <div className="relative">
                        <img src={chat.avatar} className={`w-14 h-14 rounded-2xl object-cover border-2 ${activeChatId === chat.id ? 'border-white/40' : 'border-orange-500/10'}`} alt={chat.name} />
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 ${activeChatId === chat.id ? 'border-orange-500' : 'border-white dark:border-slate-900'} rounded-full ${chat.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    </div>
                    <div className="flex-1 truncate">
                        <h3 className={`font-bold text-sm truncate ${activeChatId === chat.id ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>{chat.name}</h3>
                        <p className={`text-xs truncate ${activeChatId === chat.id ? 'text-white/70' : 'opacity-50'}`}>{chat.lastMessage}</p>
                    </div>
                    {activeChatId !== chat.id && (
                        <button onClick={(e) => removeChat(chat.id, e)} className="p-2 text-rose-500 opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 rounded-xl transition-all">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className={`${activeChatId ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col h-full bg-slate-50/20 dark:bg-transparent`}>
        {activeChat ? (
          <>
            <header className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between bg-white/80 dark:bg-slate-950/80 backdrop-blur-md z-40 sticky top-0">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveChatId(null)} className="md:hidden p-2 text-slate-400"><ArrowLeft /></button>
                <div className="relative">
                    <img src={activeChat.avatar} className="w-11 h-11 rounded-xl object-cover ring-2 ring-orange-500/10" />
                    {activeChat.isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full" />}
                </div>
                <div>
                    <h2 className="font-black text-slate-800 dark:text-white flex items-center gap-2">
                        {activeChat.name} {activeChat.type === 'ai' && <Bot className="w-4 h-4 text-orange-500" />}
                    </h2>
                    <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest">Neural Link Secure</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startCall('audio')} className="p-3 text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 rounded-xl transition-all"><Phone className="w-5 h-5" /></button>
                <button onClick={() => startCall('video')} className="p-3 text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 rounded-xl transition-all"><VideoIcon className="w-5 h-5" /></button>
                <button className="p-3 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"><MoreVertical className="w-5 h-5" /></button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.senderId === myProfile?.id ? 'items-end' : 'items-start'}`}>
                    <div className={`group relative max-w-[85%] p-4 rounded-3xl shadow-sm border transition-all ${msg.senderId === myProfile?.id ? 'bg-orange-500 text-white rounded-tr-none border-orange-400/20' : 'bg-white dark:bg-slate-900 rounded-tl-none border-slate-100 dark:border-slate-800'}`}>
                      {msg.text && <p className="text-[14px] font-medium leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
                      {msg.media?.type === 'image' && <img src={msg.media.url} className="rounded-2xl max-w-full mt-2 border border-white/20" />}
                      {msg.media?.type === 'audio' && <audio controls src={msg.media.url} className="mt-2 h-10 w-56 filter invert dark:invert-0" />}
                      
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-white/10 dark:border-slate-800">
                          <p className="text-[10px] font-black uppercase opacity-60 mb-2 flex items-center gap-1">
                            <Globe className="w-3 h-3" /> Sources
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((source: any, idx: number) => (
                              <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 p-2 rounded-xl text-[10px] transition-all border border-black/5">
                                <span className="truncate max-w-[120px] font-bold">{source.title || 'Referenced Link'}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {msg.senderId === myProfile?.id && (
                        <div className="absolute top-0 -left-14 opacity-0 group-hover:opacity-100 flex flex-col gap-1.5 transition-all">
                            <button onClick={() => startEdit(msg)} className="p-2.5 bg-white dark:bg-slate-800 text-slate-500 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 hover:text-orange-500"><Edit3 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => deleteMessage(msg.id)} className="p-2.5 bg-white dark:bg-slate-800 text-rose-500 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      )}

                      <div className="flex justify-end items-center gap-1.5 mt-2.5 opacity-60 text-[10px] font-black tracking-tight">
                        {msg.isEdited && <span className="italic uppercase mr-1">(Edited)</span>}
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {msg.senderId === myProfile?.id && <CheckCheck className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                </div>
              ))}
              {isGenerating && (
                <div className="flex gap-2 items-center text-[11px] font-black uppercase tracking-widest text-orange-500 animate-pulse ml-4">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" />
                    Neo is thinking...
                </div>
              )}
              <div ref={scrollRef} />
            </div>

            <footer className="p-6 bg-white dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800/50 backdrop-blur-lg">
              {editingMsgId && (
                <div className="max-w-4xl mx-auto mb-3 flex items-center justify-between bg-orange-500/10 p-4 rounded-2xl border border-orange-500/20">
                    <p className="text-xs font-black text-orange-500 flex items-center gap-2"><Edit3 className="w-4 h-4" /> এডিট মুড সক্রিয়</p>
                    <button onClick={() => { setEditingMsgId(null); setInputText(''); }} className="text-orange-500 hover:bg-orange-500/10 p-1 rounded-lg"><X className="w-4 h-4" /></button>
                </div>
              )}
              <div className="max-w-4xl mx-auto flex items-end gap-3 p-2 bg-slate-50 dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-inner relative transition-all focus-within:ring-2 ring-orange-500/20">
                <label className="p-3.5 text-slate-400 hover:text-orange-500 cursor-pointer transition-colors">
                    <Paperclip className="w-6 h-6" />
                    <input type="file" className="hidden" onChange={handleFileSelect} />
                </label>
                <textarea rows={1} value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage(inputText))} placeholder="এখানে লিখুন..." className="flex-1 bg-transparent py-4 outline-none text-[15px] font-medium resize-none min-h-[56px] dark:text-slate-200" />
                <button onMouseDown={startRecording} onMouseUp={stopRecording} className={`p-3.5 rounded-full transition-all ${isRecording ? 'bg-orange-500 text-white scale-125 shadow-lg shadow-orange-500/30' : 'text-slate-400 hover:text-orange-500'}`}>
                    <Mic className="w-6 h-6" />
                </button>
                <button onClick={() => handleSendMessage(inputText)} className="p-4 bg-orange-500 text-white rounded-full shadow-xl shadow-orange-500/30 hover:scale-110 active:scale-95 transition-all"><Send className="w-6 h-6" /></button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
            <div className="absolute inset-0 opacity-5 pointer-events-none">
                <div className="absolute top-0 left-0 w-96 h-96 bg-orange-500 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-500 rounded-full blur-[120px]" />
            </div>
            <div className="w-28 h-28 bg-orange-500/10 rounded-[3rem] flex items-center justify-center mb-8 shadow-inner ring-4 ring-orange-500/5"><Zap className="w-14 h-14 text-orange-500" /></div>
            <h2 className="text-5xl font-black mb-4 bg-gradient-to-br from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">ChatNest Pro</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-10 font-medium">আপনার বন্ধুদের সাথে সুরক্ষিত এবং প্রফেশনাল ভাবে যোগাযোগ করুন।</p>
            <button onClick={() => setShowConnectModal(true)} className="flex items-center gap-3 bg-orange-500 text-white px-10 py-5 rounded-[2rem] font-black shadow-2xl shadow-orange-500/30 hover:scale-105 active:scale-95 transition-all">
                <UserPlus2 className="w-6 h-6" /> ফ্রেন্ড অ্যাড করুন
            </button>
          </div>
        )}
      </main>

      {/* --- Overlay Modals --- */}

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md animate-in fade-in" onClick={() => setShowConnectModal(false)}>
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-2xl relative border border-orange-500/10 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowConnectModal(false)} className="absolute top-8 right-8 text-slate-400 hover:text-rose-500 transition-colors"><X className="w-6 h-6" /></button>
                <h2 className="text-3xl font-black mb-8 flex items-center gap-3 text-slate-800 dark:text-white"><div className="p-3 bg-orange-500/10 rounded-2xl"><UserPlus2 className="w-7 h-7 text-orange-500" /></div>লিঙ্ক করুন</h2>
                <div className="space-y-6">
                    <input autoFocus value={targetPeerId} onChange={e => setTargetPeerId(e.target.value)} type="text" placeholder="Nest ID এখানে দিন..." className="w-full bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl outline-none border-2 border-transparent focus:border-orange-500 font-bold transition-all text-slate-800 dark:text-white" />
                    <button onClick={() => connectToPeer(targetPeerId)} className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-orange-500/30 hover:scale-[1.02] active:scale-95 transition-all">কানেক্ট করুন</button>
                </div>
            </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md animate-in fade-in" onClick={() => setShowSettings(false)}>
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] p-12 shadow-2xl relative border border-orange-500/10 animate-in slide-in-from-bottom-8" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowSettings(false)} className="absolute top-10 right-10 text-slate-400 hover:text-rose-500 p-2 transition-colors"><X className="w-6 h-6" /></button>
                <h2 className="text-4xl font-black mb-10 flex items-center gap-4 text-slate-800 dark:text-white"><Settings2 className="w-10 h-10 text-orange-500" /> সেটিংস</h2>
                
                <div className="flex flex-col items-center gap-10">
                    <div className="relative group">
                        <img src={myProfile?.avatar} className="w-36 h-36 rounded-[3rem] border-4 border-orange-500/20 object-cover shadow-2xl shadow-orange-500/10" />
                        <label className="absolute inset-0 bg-black/50 rounded-[3rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-sm">
                            <Camera className="text-white w-8 h-8" />
                            <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                        </label>
                    </div>

                    <div className="w-full space-y-6">
                        <div className="space-y-2">
                            <p className="text-[11px] font-black uppercase tracking-widest text-orange-500 ml-1">My Global Nest ID</p>
                            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                                <code className="font-bold text-slate-700 dark:text-slate-300">{myProfile?.id}</code>
                                <button onClick={() => { navigator.clipboard.writeText(myProfile!.id); setCopyStatus(true); setTimeout(()=>setCopyStatus(false),2000); }} className="p-3 bg-white dark:bg-slate-700 rounded-xl shadow-sm hover:scale-105 transition-all">
                                    {copyStatus ? <Check className="w-5 h-5 text-emerald-500"/> : <Copy className="w-5 h-5"/>}
                                </button>
                            </div>
                        </div>

                        <input value={myProfile?.name} onChange={e => updateProfile({name: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 p-5 rounded-3xl outline-none font-bold text-slate-800 dark:text-white border-2 border-transparent focus:border-orange-500 transition-all" placeholder="আপনার নাম" />
                        <textarea value={myProfile?.bio} onChange={e => updateProfile({bio: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 p-5 rounded-3xl outline-none font-bold resize-none text-slate-800 dark:text-white border-2 border-transparent focus:border-orange-500 transition-all" placeholder="আপনার সম্পর্কে লিখুন..." />
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full">
                        <button onClick={() => setIsDarkMode(!isDarkMode)} className={`py-5 rounded-[2rem] font-black flex items-center justify-center gap-3 transition-all ${isDarkMode ? 'bg-white text-slate-900 shadow-xl' : 'bg-slate-900 text-white shadow-xl'}`}>
                            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />} {isDarkMode ? 'লাইট মোড' : 'ডার্ক মোড'}
                        </button>
                        <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="py-5 bg-rose-50 text-rose-500 rounded-[2rem] font-black hover:bg-rose-100 transition-all">রিসেট অ্যাকাউন্ট</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- Call Overlays --- */}

      {/* Incoming Call */}
      {incomingCall && (
        <div className="fixed inset-0 z-[200] bg-slate-950/95 flex flex-col items-center justify-center text-white backdrop-blur-2xl p-10 text-center animate-in zoom-in-95">
            <div className="w-36 h-36 bg-orange-500 rounded-[3rem] flex items-center justify-center mb-10 relative">
                <div className="absolute inset-0 bg-orange-500 rounded-[3rem] animate-ping opacity-20" />
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${incomingCall.peerId}`} className="w-full h-full rounded-[3rem] object-cover" />
            </div>
            <h2 className="text-4xl font-black mb-3">{incomingCall.peerId}</h2>
            <p className="text-xl font-bold text-orange-500 animate-pulse mb-20">ইনকামিং {incomingCall.type === 'video' ? 'ভিডিও' : 'অডিও'} কল...</p>
            <div className="flex gap-12">
                <button onClick={endCall} className="w-24 h-24 bg-rose-500 rounded-full flex items-center justify-center shadow-2xl shadow-rose-500/40 hover:scale-110 active:scale-95 transition-all"><PhoneOff className="w-10 h-10" /></button>
                <button onClick={answerCall} className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/40 hover:scale-110 active:scale-95 transition-all"><Phone className="w-10 h-10" /></button>
            </div>
        </div>
      )}

      {/* Active Call */}
      {activeCall && (
        <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col items-center justify-center overflow-hidden animate-in fade-in">
            {activeCall.type === 'video' ? (
                <div className="w-full h-full relative">
                    {/* Remote Video (Full Screen) */}
                    <video 
                        ref={remoteVideoRef} 
                        autoPlay 
                        playsInline
                        className="w-full h-full object-cover"
                    />
                    
                    {/* Local Video (Floating PIP) */}
                    <div className="absolute top-10 right-10 w-48 h-72 bg-slate-900 rounded-3xl border-4 border-white/20 overflow-hidden shadow-2xl shadow-black/50 group">
                        <video 
                            ref={localVideoRef} 
                            autoPlay 
                            muted 
                            playsInline
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <p className="text-[10px] font-black uppercase text-white tracking-widest">You</p>
                        </div>
                    </div>

                    {/* Call Status Overlay */}
                    <div className="absolute top-10 left-10 flex items-center gap-3 bg-black/40 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10">
                        <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                        <span className="text-white text-xs font-black uppercase tracking-tighter">Live Session • Video Active</span>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center">
                    <div className="w-64 h-64 bg-orange-500/10 rounded-full flex items-center justify-center mb-12 relative">
                        <div className="absolute inset-0 bg-orange-500/5 rounded-full animate-ping" />
                        <div className="w-48 h-48 bg-orange-500/20 rounded-full flex items-center justify-center">
                            <Headphones className="w-24 h-24 text-orange-500 animate-bounce" />
                        </div>
                    </div>
                    <h2 className="text-4xl font-black text-white mb-4">ভয়েস কল চলছে</h2>
                    <div className="flex gap-2 items-center h-10">
                        {[1,2,3,4,5,6,7].map(i => (
                            <div 
                                key={i} 
                                className="w-2 bg-orange-500 rounded-full animate-recording-bar" 
                                style={{ animationDelay: `${i*0.1}s`, height: `${30 + Math.random() * 40}%` }} 
                            />
                        ))}
                    </div>
                </div>
            )}
            
            <div className="absolute bottom-16 flex gap-10 bg-white/10 backdrop-blur-2xl p-8 rounded-[3rem] border border-white/10 shadow-2xl">
                <button className="p-5 text-white hover:bg-white/10 rounded-full transition-all"><MicOff className="w-8 h-8" /></button>
                <button onClick={endCall} className="w-20 h-20 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-rose-500/30 hover:scale-110 active:scale-95 transition-all">
                    <PhoneOff className="w-9 h-9" />
                </button>
                <button className="p-5 text-white hover:bg-white/10 rounded-full transition-all"><CameraOff className="w-8 h-8" /></button>
            </div>
        </div>
      )}
    </div>
  );
}
