
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

// Fix: Using AIStudio interface and optional modifier to match environment declaration and resolve TS errors
declare global {
  interface AIStudio {
    hasSelectedApiKey(): Promise<boolean>;
    openSelectKey(): Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}

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

  // Editing state
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);

  const [incomingCall, setIncomingCall] = useState<{peerId: string, type: 'audio' | 'video', call: MediaConnection} | null>(null);
  const [activeCall, setActiveCall] = useState<{stream: MediaStream, remoteStream: MediaStream, type: 'audio' | 'video', call: MediaConnection} | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<{ [key: string]: DataConnection }>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find(c => c.id === activeChatId);

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
    dbService.saveMessage(msg);
    setChats(dbService.getChats());
    if (activeChatId === peerId || msg.chatId === activeChatId) {
      setMessages(prev => [...prev, msg]);
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
      // Logic for editing existing message
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

  // Profile management & registration remain similar, adding ID visibility
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      handleSendMessage('', { type: file.type.startsWith('image/') ? 'image' : 'file', url: reader.result as string, mimeType: file.type, fileName: file.name });
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

  const endCall = () => {
    if (activeCall) { activeCall.stream.getTracks().forEach(t => t.stop()); activeCall.call.close(); setActiveCall(null); }
    setIncomingCall(null);
  };

  if (!isRegistered) {
    return (
        <div className="h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95">
                <div className="w-20 h-20 bg-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-8"><Zap className="w-10 h-10 text-white" /></div>
                <h1 className="text-3xl font-black text-center mb-6">ChatNest</h1>
                <form onSubmit={handleRegister} className="space-y-6">
                    <input name="name" type="text" placeholder="আপনার নাম" className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-orange-500 font-bold" required />
                    <input name="phone" type="tel" placeholder="ফোন নম্বর" className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-orange-500 font-bold" required />
                    <button type="submit" className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black text-lg shadow-xl">শুরু করুন</button>
                </form>
            </div>
        </div>
    );
  }

  return (
    <div className={`flex h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-jakarta`}>
      {/* Sidebar */}
      <aside className={`${activeChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col border-r border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50 relative`}>
        <div className="p-6 flex flex-col h-full">
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
            <input type="text" placeholder="সার্চ করুন..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white dark:bg-slate-800 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none shadow-sm focus:ring-2 ring-orange-500/10" />
          </div>
          
          <div className="space-y-1 overflow-y-auto flex-1">
            {chats.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map(chat => (
                <div key={chat.id} onClick={() => setActiveChatId(chat.id)} className={`flex items-center gap-4 p-4 cursor-pointer rounded-3xl transition-all group ${activeChatId === chat.id ? 'bg-white dark:bg-slate-800 shadow-md' : 'hover:bg-white/50'}`}>
                    <div className="relative">
                        <img src={chat.avatar} className="w-12 h-12 rounded-xl object-cover" alt={chat.name} />
                        <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-white dark:border-slate-900 rounded-full ${chat.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    </div>
                    <div className="flex-1 truncate">
                        <h3 className="font-bold text-sm truncate">{chat.name}</h3>
                        <p className="text-xs opacity-50 truncate">{chat.lastMessage}</p>
                    </div>
                    <button onClick={(e) => removeChat(chat.id, e)} className="p-2 text-rose-500 opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 rounded-lg transition-all">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Chat */}
      <main className={`${activeChatId ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col h-full bg-slate-50/20 dark:bg-transparent`}>
        {activeChat ? (
          <>
            <header className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-40">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveChatId(null)} className="md:hidden p-2 text-slate-400"><ArrowLeft /></button>
                <img src={activeChat.avatar} className="w-10 h-10 rounded-xl object-cover" />
                <div>
                    <h2 className="font-bold flex items-center gap-2">
                        {activeChat.name} {activeChat.type === 'ai' && <Bot className="w-4 h-4 text-orange-500" />}
                    </h2>
                    <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Active Link</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-3 text-slate-400 hover:text-orange-500"><Phone className="w-5 h-5" /></button>
                <button className="p-3 text-slate-400 hover:text-orange-500"><VideoIcon className="w-5 h-5" /></button>
                <button className="p-3 text-slate-400"><MoreVertical /></button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.senderId === myProfile?.id ? 'items-end' : 'items-start'}`}>
                    <div className={`group relative max-w-[85%] p-4 rounded-2xl shadow-sm ${msg.senderId === myProfile?.id ? 'bg-orange-500 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-800 rounded-tl-none'}`}>
                      {msg.text && <p className="text-sm font-medium whitespace-pre-wrap">{msg.text}</p>}
                      {msg.media?.type === 'image' && <img src={msg.media.url} className="rounded-xl max-w-full mt-2" />}
                      {msg.media?.type === 'audio' && <audio controls src={msg.media.url} className="mt-2 h-10 w-48" />}
                      
                      {/* Render grounding sources if available (Compliance with Search Grounding requirements) */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                          <p className="text-[10px] font-black uppercase opacity-50 mb-2 flex items-center gap-1">
                            <Globe className="w-3 h-3" /> Sources
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((source: any, idx: number) => (
                              <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 dark:bg-slate-900/40 p-2 rounded-lg text-[10px] transition-colors border border-white/10">
                                <span className="truncate max-w-[120px]">{source.title || 'Visit Site'}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Edit/Delete Overlay for My Messages */}
                      {msg.senderId === myProfile?.id && (
                        <div className="absolute top-0 -left-12 opacity-0 group-hover:opacity-100 flex flex-col gap-1 transition-opacity">
                            <button onClick={() => startEdit(msg)} className="p-2 bg-white dark:bg-slate-800 text-slate-500 rounded-lg shadow-sm hover:text-orange-500"><Edit3 className="w-3 h-3" /></button>
                            <button onClick={() => deleteMessage(msg.id)} className="p-2 bg-white dark:bg-slate-800 text-rose-500 rounded-lg shadow-sm hover:bg-rose-50"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      )}

                      <div className="flex justify-end items-center gap-1 mt-2 opacity-50 text-[9px] font-bold">
                        {msg.isEdited && <span className="italic mr-1">(Edited)</span>}
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {msg.senderId === myProfile?.id && <CheckCheck className="w-3 h-3" />}
                      </div>
                    </div>
                </div>
              ))}
              {isGenerating && <div className="text-xs italic opacity-50 ml-4 animate-pulse">Neo is thinking...</div>}
              <div ref={scrollRef} />
            </div>

            <footer className="p-6">
              {editingMsgId && (
                <div className="max-w-4xl mx-auto mb-2 flex items-center justify-between bg-orange-500/10 p-3 rounded-xl border border-orange-500/20">
                    <p className="text-xs font-bold text-orange-500">ম্যাসেজ এডিট করছেন...</p>
                    <button onClick={() => { setEditingMsgId(null); setInputText(''); }} className="text-orange-500"><X className="w-4 h-4" /></button>
                </div>
              )}
              <div className="max-w-4xl mx-auto flex items-end gap-3 p-2 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 shadow-sm relative">
                <label className="p-3 text-slate-400 hover:text-orange-500 cursor-pointer">
                    <Paperclip className="w-6 h-6" />
                    <input type="file" className="hidden" onChange={handleFileSelect} />
                </label>
                <textarea rows={1} value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage(inputText))} placeholder="এখানে লিখুন..." className="flex-1 bg-transparent py-3 outline-none text-sm font-medium resize-none min-h-[48px]" />
                <button onMouseDown={startRecording} onMouseUp={stopRecording} className={`p-3 rounded-full transition-all ${isRecording ? 'bg-orange-500 text-white scale-125' : 'text-slate-400'}`}>
                    <Mic className="w-6 h-6" />
                </button>
                <button onClick={() => handleSendMessage(inputText)} className="p-3 bg-orange-500 text-white rounded-full shadow-lg"><Send className="w-6 h-6" /></button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 animate-in fade-in">
            <div className="w-24 h-24 bg-orange-500/10 rounded-[2.5rem] flex items-center justify-center mb-8"><Zap className="w-12 h-12 text-orange-500" /></div>
            <h2 className="text-4xl font-black mb-4">ChatNest</h2>
            <button onClick={() => setShowConnectModal(true)} className="mt-8 flex items-center gap-2 bg-orange-500 text-white px-8 py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition-all">
                <UserPlus className="w-5 h-5" /> ফ্রেন্ড অ্যাড করুন
            </button>
          </div>
        )}
      </main>

      {/* Settings / Connect Modals */}
      {showConnectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md" onClick={() => setShowConnectModal(false)}>
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-8 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowConnectModal(false)} className="absolute top-6 right-6 text-slate-400"><X /></button>
                <h2 className="text-2xl font-black mb-6">লিঙ্ক করুন</h2>
                <input autoFocus value={targetPeerId} onChange={e => setTargetPeerId(e.target.value)} type="text" placeholder="Nest ID লিখুন..." className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-orange-500 font-bold mb-4" />
                <button onClick={() => connectToPeer(targetPeerId)} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black shadow-xl">কানেক্ট করুন</button>
            </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md" onClick={() => setShowSettings(false)}>
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowSettings(false)} className="absolute top-8 right-8 text-slate-400"><X /></button>
                <h2 className="text-3xl font-black mb-8">সেটিংস</h2>
                <div className="flex flex-col items-center gap-8">
                    <img src={myProfile?.avatar} className="w-32 h-32 rounded-[2.5rem] border-4 border-orange-500/20" />
                    <div className="w-full space-y-4">
                        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl flex justify-between items-center">
                            <div><p className="text-[10px] font-black opacity-40 uppercase">My Nest ID</p><code className="font-bold text-orange-500">{myProfile?.id}</code></div>
                            <button onClick={() => { navigator.clipboard.writeText(myProfile!.id); setCopyStatus(true); setTimeout(()=>setCopyStatus(false),2000); }} className="p-2 hover:bg-white rounded-xl">{copyStatus ? <Check className="text-emerald-500"/> : <Copy/>}</button>
                        </div>
                        <input value={myProfile?.name} onChange={e => updateProfile({name: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none font-bold" placeholder="নাম পরিবর্তন করুন" />
                        <textarea value={myProfile?.bio} onChange={e => updateProfile({bio: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none font-bold resize-none" placeholder="বায়ো" />
                    </div>
                    <div className="grid grid-cols-2 gap-4 w-full">
                        <button onClick={() => setIsDarkMode(!isDarkMode)} className="py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black flex items-center justify-center gap-2">
                            {isDarkMode ? <Sun /> : <Moon />} {isDarkMode ? 'লাইট' : 'ডার্ক'}
                        </button>
                        <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="py-4 bg-rose-50 text-rose-500 rounded-2xl font-black">রিসেট করুন</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Call Overlays remain same as previous version */}
    </div>
  );
}
