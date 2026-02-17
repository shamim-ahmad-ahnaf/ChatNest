
import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Peer, DataConnection, MediaConnection } from "peerjs";
import { Message, ChatSession, MessageStatus, UserProfile } from './types';
import { dbService } from './services/dbService';
import { geminiService } from './services/geminiService';
import { 
    Search, MoreVertical, Phone, Video, Send, ArrowLeft,
    CheckCheck, Bot, X, Camera, PhoneOff,
    Zap, Edit3, Settings2, Moon, Sun, ExternalLink,
    UserPlus2, Copy, Check, Headphones, Mic, Paperclip, 
    Video as VideoIcon, MicOff, CameraOff, Globe, Trash2,
    Sparkles, User, ShieldCheck, Bell, MessageSquare,
    LayoutDashboard, Database, Activity, Terminal, ShieldAlert
} from 'lucide-react';

// Memoized Message Bubble
const MessageBubble = memo(({ msg, isMe, onEdit, onDelete }: { 
  msg: Message, 
  isMe: boolean, 
  onEdit: (m: Message) => void, 
  onDelete: (id: string) => void 
}) => {
  return (
    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`group relative max-w-[85%] p-4 rounded-3xl shadow-sm border transition-all ${isMe ? 'bg-orange-500 text-white rounded-tr-none border-orange-400/20' : 'bg-slate-900 rounded-tl-none border-slate-800'}`}>
        {msg.text && <p className="text-[14px] font-medium leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
        {msg.media?.type === 'image' && <img src={msg.media.url} className="rounded-2xl max-w-full mt-2 border border-white/20" loading="lazy" />}
        {msg.media?.type === 'audio' && <audio controls src={msg.media.url} className="mt-2 h-10 w-56 filter" />}
        
        {msg.sources && msg.sources.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-800">
            <p className="text-[10px] font-black uppercase opacity-60 mb-2 flex items-center gap-1"><Globe className="w-3 h-3" /> Sources</p>
            <div className="flex flex-wrap gap-2">
              {msg.sources.map((source: any, idx: number) => (
                <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 p-2 rounded-xl text-[10px] border border-white/5">
                  <span className="truncate max-w-[120px] font-bold">{source.title || 'Referenced Link'}</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ))}
            </div>
          </div>
        )}

        {isMe && (
          <div className="absolute top-0 -left-14 opacity-0 group-hover:opacity-100 flex flex-col gap-1.5 transition-all">
            <button onClick={() => onEdit(msg)} className="p-2.5 bg-slate-800 text-slate-500 rounded-xl shadow-lg border border-slate-700 hover:text-orange-500"><Edit3 className="w-3.5 h-3.5" /></button>
            <button onClick={() => onDelete(msg.id)} className="p-2.5 bg-slate-800 text-rose-500 rounded-xl shadow-lg border border-slate-700 hover:bg-rose-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        )}

        <div className="flex justify-end items-center gap-1.5 mt-2.5 opacity-60 text-[10px] font-black tracking-tight">
          {msg.isEdited && <span className="italic uppercase mr-1">(Edited)</span>}
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {isMe && <CheckCheck className="w-3.5 h-3.5" />}
        </div>
      </div>
    </div>
  );
});

// Added ChatInput component to fix compilation error and provide input controls
const ChatInput = memo(({ 
  onSend, 
  onStartRecording, 
  onStopRecording, 
  isRecording, 
  editingMsg, 
  cancelEdit, 
  onFileSelect 
}: { 
  onSend: (text: string) => void, 
  onStartRecording: () => void, 
  onStopRecording: () => void, 
  isRecording: boolean, 
  editingMsg: Message | null, 
  cancelEdit: () => void, 
  onFileSelect: (e: any) => void 
}) => {
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingMsg) setText(editingMsg.text);
    else setText('');
  }, [editingMsg]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSend(text);
      setText('');
    }
  };

  return (
    <div className="p-6 bg-slate-950/80 backdrop-blur-md border-t border-slate-800/50">
      {editingMsg && (
        <div className="mb-4 flex items-center justify-between bg-orange-500/10 p-3 rounded-2xl border border-orange-500/20">
          <div className="flex items-center gap-3">
            <Edit3 className="w-4 h-4 text-orange-500" />
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest">Editing Message</p>
          </div>
          <button onClick={cancelEdit} className="p-1 text-orange-500 hover:bg-orange-500/20 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-end gap-4 max-w-6xl mx-auto">
        <div className="flex-1 relative flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-[2.5rem] focus-within:ring-2 ring-orange-500/20 transition-all">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3.5 text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 rounded-full transition-all">
            <Paperclip className="w-5 h-5" />
            <input type="file" ref={fileInputRef} onChange={onFileSelect} className="hidden" />
          </button>
          
          <textarea 
            value={text} 
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
            placeholder="মেসেজ লিখুন..." 
            className="flex-1 bg-transparent py-3.5 px-2 outline-none text-sm font-medium resize-none max-h-32 custom-scrollbar"
            rows={1}
          />
          
          <button 
            type="button" 
            onMouseDown={onStartRecording} 
            onMouseUp={onStopRecording}
            onMouseLeave={isRecording ? onStopRecording : undefined}
            className={`p-3.5 rounded-full transition-all ${isRecording ? 'bg-rose-500 text-white animate-pulse' : 'text-slate-400 hover:text-orange-500 hover:bg-orange-500/10'}`}
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        </div>
        
        <button 
          type="submit" 
          disabled={!text.trim()} 
          className="p-5 bg-orange-500 text-white rounded-[2rem] shadow-xl shadow-orange-500/20 hover:scale-105 disabled:opacity-50 disabled:scale-100 transition-all"
        >
          <Send className="w-6 h-6" />
        </button>
      </form>
    </div>
  );
});

// Admin Panel Component
const AdminPanel = ({ chats, onClose, onDeleteChat, messagesCount }: any) => {
  const stats = [
    { label: 'Total Contacts', value: chats.length, icon: User, color: 'text-orange-500' },
    { label: 'Total Messages', value: messagesCount, icon: MessageSquare, color: 'text-purple-500' },
    { label: 'Active Link', value: 'PeerJS P2P', icon: Activity, color: 'text-emerald-500' },
    { label: 'Security', value: 'Encrypted', icon: ShieldCheck, color: 'text-blue-500' },
  ];

  return (
    <div className="fixed inset-0 z-[150] bg-slate-950 flex flex-col animate-in fade-in duration-300">
      <header className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-500 rounded-2xl shadow-lg shadow-orange-500/20 text-white">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black">Admin Command Center</h2>
            <p className="text-[10px] text-orange-500 font-bold uppercase tracking-[0.2em]">Full System Access • Root</p>
          </div>
        </div>
        <button onClick={onClose} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"><X /></button>
      </header>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-10">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {stats.map((s, idx) => (
              <div key={idx} className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl">
                <s.icon className={`w-6 h-6 ${s.color} mb-4`} />
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">{s.label}</p>
                <p className="text-3xl font-black">{s.value}</p>
              </div>
            ))}
          </div>

          {/* User Management Table */}
          <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <h3 className="font-black flex items-center gap-2"><Database className="w-5 h-5 text-orange-500" /> কন্টাক্ট ডাটাবেজ</h3>
              <span className="text-xs text-slate-500 font-bold">{chats.length} কন্টাক্ট পাওয়া গেছে</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Nest ID</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {chats.map((chat: ChatSession) => (
                    <tr key={chat.id} className="hover:bg-white/5 transition-all">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={chat.avatar} className="w-10 h-10 rounded-xl object-cover" />
                          <span className="font-bold text-sm">{chat.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4"><code className="text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded-lg">{chat.id}</code></td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${chat.isOnline ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-500 bg-slate-500/10'}`}>
                          {chat.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-400">{chat.lastMessage || 'No data'}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={(e) => onDeleteChat(e, chat.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Advanced Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-rose-500/5 p-8 rounded-[2.5rem] border border-rose-500/20">
              <h4 className="font-black text-rose-500 mb-2 flex items-center gap-2"><ShieldAlert className="w-5 h-5" /> Danger Zone</h4>
              <p className="text-sm text-slate-400 mb-6 font-medium">এই সেকশনের কাজগুলো পুনরায় ফেরত আনা সম্ভব নয়। অত্যন্ত সাবধানে ব্যবহার করুন।</p>
              <div className="flex flex-wrap gap-4">
                <button onClick={() => { if(window.confirm("সব ডেটা মুছে যাবে?")) { localStorage.clear(); window.location.reload(); } }} className="px-6 py-3 bg-rose-500 text-white rounded-2xl font-black text-xs shadow-lg shadow-rose-500/20">Wipe All Local Data</button>
                <button onClick={() => { if(window.confirm("সব মেসেজ মুছে যাবে?")) { localStorage.removeItem('chatnest_messages_v1'); window.location.reload(); } }} className="px-6 py-3 bg-slate-800 text-rose-500 rounded-2xl font-black text-xs border border-rose-500/20">Clear Global Messages</button>
              </div>
            </div>
            <div className="bg-orange-500/5 p-8 rounded-[2.5rem] border border-orange-500/20">
              <h4 className="font-black text-orange-500 mb-2 flex items-center gap-2"><Terminal className="w-5 h-5" /> Debug Tools</h4>
              <p className="text-sm text-slate-400 mb-6 font-medium">সিস্টেমের মেমোরি এবং কানেকশন স্ট্যাটাস পর্যবেক্ষণ করুন।</p>
              <div className="flex flex-wrap gap-4">
                <button onClick={() => console.log(localStorage)} className="px-6 py-3 bg-slate-800 text-orange-500 rounded-2xl font-black text-xs border border-orange-500/20">Log LocalStorage</button>
                <button onClick={() => window.location.reload()} className="px-6 py-3 bg-orange-500 text-white rounded-2xl font-black text-xs shadow-lg shadow-orange-500/20">Restart Engine</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [isRegistered, setIsRegistered] = useState(() => !!localStorage.getItem('chatnest_profile'));
  const [myProfile, setMyProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('chatnest_profile');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [isDarkMode] = useState(true); // Forced Dark Mode as per user request
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSession[]>(dbService.getChats());
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [targetPeerId, setTargetPeerId] = useState('');
  const [copyStatus, setCopyStatus] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);

  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [incomingCall, setIncomingCall] = useState<{peerId: string, type: 'audio' | 'video', call: MediaConnection} | null>(null);
  const [activeCall, setActiveCall] = useState<{stream: MediaStream, remoteStream: MediaStream | null, type: 'audio' | 'video', call: MediaConnection} | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<{ [key: string]: DataConnection }>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const activeChat = chats.find(c => c.id === activeChatId);
  const isAIChat = activeChatId === 'ai-gemini';

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) setHasApiKey(await window.aistudio.hasSelectedApiKey());
    };
    checkApiKey();
    // Default to dark mode
    document.documentElement.classList.add('dark');
  }, []);

  // Peer Connection Logic
  useEffect(() => {
    if (isRegistered && myProfile) {
      const peer = new Peer(myProfile.id);
      peerRef.current = peer;
      peer.on('connection', (conn) => {
        if (conn.peer === 'ai-gemini') { conn.close(); return; }
        conn.on('open', () => {
          connectionsRef.current[conn.peer] = conn;
          if (myProfile) conn.send({ type: 'profile_sync', profile: myProfile });
        });
        conn.on('data', (data: any) => {
          if (data.type === 'message') {
            const correctedMsg = { ...data.message, chatId: conn.peer };
            dbService.saveMessage(correctedMsg);
            setChats(dbService.getChats());
            if (activeChatId === conn.peer) setMessages(prev => [...prev, correctedMsg]);
          } else if (data.type === 'profile_sync') {
            setChats(prev => {
              const existing = prev.find(c => c.id === data.profile.id);
              const updated = existing 
                ? prev.map(c => c.id === data.profile.id ? { ...c, name: data.profile.name, avatar: data.profile.avatar, bio: data.profile.bio } : c)
                : [{ ...data.profile, isOnline: true, type: 'contact', unreadCount: 0, lastMessage: 'Link established' }, ...prev];
              dbService.saveChats(updated);
              return updated;
            });
          }
        });
        conn.on('close', () => delete connectionsRef.current[conn.peer]);
      });

      peer.on('call', (call) => {
        if (call.peer === 'ai-gemini') { call.close(); return; }
        setIncomingCall({ peerId: call.peer, type: call.metadata?.type || 'audio', call });
      });
      
      return () => peer.destroy();
    }
  }, [isRegistered, myProfile?.id]);

  useEffect(() => {
    if (activeChatId) setMessages(dbService.getMessages(activeChatId));
  }, [activeChatId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Handle start of voice recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          handleSendMessage('', { 
            type: 'audio', 
            url: reader.result as string, 
            mimeType: 'audio/webm',
            fileName: 'voice-note.webm'
          });
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  }, []);

  // Handle end of voice recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const handleSendMessage = async (text: string, media?: Message['media']) => {
    if (!activeChatId || !myProfile) return;

    if (editingMsg) {
      const updatedMsg = { ...editingMsg, text, isEdited: true, timestamp: Date.now() };
      dbService.saveMessage(updatedMsg);
      setMessages(prev => prev.map(m => m.id === editingMsg.id ? updatedMsg : m));
      setEditingMsg(null);
      return;
    }

    const newMessage: Message = { id: `msg-${Date.now()}`, chatId: activeChatId, senderId: myProfile.id, senderName: myProfile.name, senderAvatar: myProfile.avatar, text, timestamp: Date.now(), status: MessageStatus.SENT, media };
    setMessages(prev => [...prev, newMessage]);
    dbService.saveMessage(newMessage);
    if (isAIChat) {
      setIsGenerating(true);
      const resp = await geminiService.getChatResponse(text, messages.slice(-5).map(m => ({ role: m.senderId === 'ai-gemini' ? 'model' : 'user', text: m.text })));
      const aiMsg: Message = { id: `ai-${Date.now()}`, chatId: 'ai-gemini', senderId: 'ai-gemini', senderName: 'Neo AI', text: resp.text, timestamp: Date.now(), status: MessageStatus.DELIVERED, isAI: true, sources: resp.sources };
      dbService.saveMessage(aiMsg);
      setMessages(prev => [...prev, aiMsg]);
      setIsGenerating(false);
    } else {
      const conn = connectionsRef.current[activeChatId];
      if (conn?.open) conn.send({ type: 'message', message: newMessage });
    }
    setChats(dbService.getChats());
  };

  const deleteChat = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (!window.confirm("আপনি কি এই চ্যাট মুছে ফেলতে চান?")) return;
    dbService.deleteChat(chatId);
    setChats(dbService.getChats());
    if (activeChatId === chatId) setActiveChatId(null);
  };

  const startCall = async (type: 'audio' | 'video') => {
    if (!activeChatId || !peerRef.current || isAIChat) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
      const call = peerRef.current.call(activeChatId, stream, { metadata: { type } });
      setActiveCall({ stream, remoteStream: null, type, call });
      call.on('stream', (remoteStream) => setActiveCall(prev => prev ? { ...prev, remoteStream } : null));
      call.on('close', () => setActiveCall(null));
    } catch (err) { alert("Access denied."); }
  };

  if (!isRegistered) return (
    <div className="h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
      <div className="w-full max-w-md bg-slate-900 rounded-[3rem] p-10 shadow-2xl border border-orange-500/10">
        <Zap className="w-16 h-16 text-orange-500 mx-auto mb-8" />
        <h1 className="text-3xl font-black text-center mb-10">ChatNest Registration</h1>
        <form onSubmit={handleRegister} className="space-y-6">
          <input name="name" type="text" placeholder="আপনার নাম" className="w-full bg-slate-800 p-5 rounded-2xl outline-none border-2 border-transparent focus:border-orange-500 font-bold transition-all" required />
          <input name="phone" type="tel" placeholder="ফোন নম্বর" className="w-full bg-slate-800 p-5 rounded-2xl outline-none border-2 border-transparent focus:border-orange-500 font-bold transition-all" required />
          <button type="submit" className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black text-lg shadow-xl">শুরু করুন</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-jakarta selection:bg-orange-500/30">
      {/* Sidebar */}
      <aside className={`${activeChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col border-r border-slate-800/50 bg-slate-900/50 backdrop-blur-sm`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-black text-orange-500 flex items-center gap-2"><Zap className="w-5 h-5" /> ChatNest</h1>
            <div className="flex gap-2">
              <button onClick={() => setShowConnectModal(true)} className="p-2.5 bg-orange-500/10 text-orange-500 rounded-xl hover:scale-105 transition-all"><UserPlus2 className="w-5 h-5" /></button>
              <button onClick={() => setShowSettings(true)} className="w-10 h-10 rounded-xl overflow-hidden shadow-sm border border-slate-700 transition-all"><img src={myProfile?.avatar} className="w-full h-full object-cover" /></button>
            </div>
          </div>
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="সার্চ করুন..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-sm outline-none border border-slate-700/50 focus:ring-2 ring-orange-500/20" />
          </div>
          <div className="space-y-2 overflow-y-auto flex-1 pr-2 custom-scrollbar">
            {chats.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map(chat => (
              <div key={chat.id} onClick={() => setActiveChatId(chat.id)} className={`group flex items-center gap-4 p-4 cursor-pointer rounded-[2rem] transition-all relative ${activeChatId === chat.id ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/30' : 'hover:bg-slate-800 shadow-sm'}`}>
                <div className="relative">
                  <img src={chat.avatar} className="w-14 h-14 rounded-2xl object-cover border-2 border-transparent" />
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 ${activeChatId === chat.id ? 'border-orange-500' : 'border-slate-900'} rounded-full ${chat.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                </div>
                <div className="flex-1 truncate">
                  <h3 className="font-bold text-sm truncate">{chat.name}</h3>
                  <p className={`text-xs truncate ${activeChatId === chat.id ? 'text-white/70' : 'opacity-50'}`}>{chat.lastMessage}</p>
                </div>
                {chat.type !== 'ai' && (
                  <button onClick={(e) => deleteChat(e, chat.id)} className={`p-2 opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 rounded-lg transition-all ${activeChatId === chat.id ? 'text-white' : 'text-rose-500'}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`${activeChatId ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col h-full bg-slate-950`}>
        {activeChat ? (
          <>
            <header className="px-6 py-4 border-b border-slate-800/50 flex items-center justify-between bg-slate-950/80 backdrop-blur-md z-40 sticky top-0">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveChatId(null)} className="md:hidden p-2 text-slate-400"><ArrowLeft /></button>
                <img src={activeChat.avatar} className="w-11 h-11 rounded-xl object-cover ring-2 ring-orange-500/10" />
                <div>
                  <h2 className="font-black text-white flex items-center gap-2">{activeChat.name}</h2>
                  <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest">{isAIChat ? 'Neural Brain Core' : 'Neural Link Secure'}</p>
                </div>
              </div>
              {!isAIChat && (
                <div className="flex items-center gap-2">
                  <button onClick={() => startCall('audio')} className="p-3 text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 rounded-xl transition-all"><Phone className="w-5 h-5" /></button>
                  <button onClick={() => startCall('video')} className="p-3 text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 rounded-xl transition-all"><VideoIcon className="w-5 h-5" /></button>
                </div>
              )}
            </header>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} isMe={msg.senderId === myProfile?.id} onEdit={setEditingMsg} onDelete={(id) => { if(window.confirm("মুছে ফেলতে চান?")) { setMessages(prev => prev.filter(m => m.id !== id)); dbService.deleteMessage(id); setChats(dbService.getChats()); } }} />
              ))}
              {isGenerating && <div className="flex gap-2 items-center text-[11px] font-black text-orange-500 animate-pulse ml-4">Neo is thinking...</div>}
              <div ref={scrollRef} />
            </div>
            <ChatInput 
              onSend={handleSendMessage} 
              onStartRecording={startRecording} 
              onStopRecording={stopRecording} 
              isRecording={isRecording} 
              editingMsg={editingMsg} 
              cancelEdit={() => setEditingMsg(null)} 
              onFileSelect={(e:any) => { 
                const file = e.target.files?.[0]; 
                if(file) { 
                  const reader = new FileReader(); 
                  reader.onloadend = () => handleSendMessage('', { 
                    type: file.type.startsWith('image/') ? 'image' : 'file', 
                    url: reader.result as string, 
                    mimeType: file.type, 
                    fileName: file.name 
                  }); 
                  reader.readAsDataURL(file); 
                } 
              }} 
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-slate-950 relative overflow-hidden">
            <Zap className="w-14 h-14 text-orange-500 mb-8" />
            <h2 className="text-5xl font-black mb-4">ChatNest Pro</h2>
            <button onClick={() => setShowConnectModal(true)} className="flex items-center gap-3 bg-orange-500 text-white px-10 py-5 rounded-[2rem] font-black shadow-2xl hover:scale-105 transition-all"><UserPlus2 className="w-6 h-6" /> ফ্রেন্ড অ্যাড করুন</button>
          </div>
        )}
      </main>

      {/* Profile & Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-xl bg-slate-900 rounded-[3rem] shadow-2xl relative border border-slate-800 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="h-32 bg-gradient-to-r from-orange-500/20 to-purple-500/20 w-full" />
            <div className="px-10 pb-10 -mt-16">
              <div className="flex justify-between items-end mb-8">
                <div className="relative group">
                  <img src={myProfile?.avatar} className="w-32 h-32 rounded-[2.5rem] object-cover border-4 border-slate-900 shadow-2xl" />
                  <label className="absolute inset-0 bg-black/50 rounded-[2.5rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"><Camera className="text-white w-8 h-8" /><input type="file" className="hidden" accept="image/*" onChange={(e:any) => { const file = e.target.files?.[0]; if(file) { const reader = new FileReader(); reader.onloadend = () => updateProfile({ avatar: reader.result as string }); reader.readAsDataURL(file); } }} /></label>
                </div>
                <button onClick={() => setShowSettings(false)} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-full mb-4"><X className="w-6 h-6" /></button>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-black text-orange-500 uppercase tracking-widest mb-2">Display Name</h3>
                  <div className="flex items-center gap-3 bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                    <User className="w-5 h-5 text-slate-400" />
                    <input type="text" value={myProfile?.name} onChange={(e) => updateProfile({ name: e.target.value })} className="bg-transparent outline-none w-full font-bold text-white" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-black text-orange-500 uppercase tracking-widest mb-2">Your Bio</h3>
                  <div className="flex items-start gap-3 bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                    <MessageSquare className="w-5 h-5 text-slate-400 mt-1" />
                    <textarea value={myProfile?.bio} onChange={(e) => updateProfile({ bio: e.target.value })} className="bg-transparent outline-none w-full font-medium h-20 resize-none text-white" placeholder="নিজের সম্পর্কে কিছু লিখুন..." />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase mb-1">Nest ID</h4>
                    <div className="flex items-center justify-between">
                      <code className="text-xs font-bold text-orange-400">{myProfile?.id}</code>
                      <button onClick={() => { navigator.clipboard.writeText(myProfile!.id); setCopyStatus(true); setTimeout(()=>setCopyStatus(false),2000); }} className="text-orange-500">{copyStatus ? <Check className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}</button>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase mb-1">Account Status</h4>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-bold">Verified Link</span>
                    </div>
                  </div>
                </div>

                <button onClick={() => { setShowAdmin(true); setShowSettings(false); }} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-orange-500/20 flex items-center justify-center gap-3"><LayoutDashboard className="w-5 h-5" /> Open Admin Console</button>
                <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full py-4 bg-rose-500/10 text-rose-500 rounded-2xl font-black text-sm hover:bg-rose-500 hover:text-white transition-all">লগ আউট / রিসেট করুন</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Panel Modal */}
      {showAdmin && (
        <AdminPanel 
          chats={chats} 
          onClose={() => setShowAdmin(false)} 
          onDeleteChat={deleteChat}
          messagesCount={JSON.parse(localStorage.getItem('chatnest_messages_v1') || '[]').length}
        />
      )}

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={() => setShowConnectModal(false)}>
          <div className="w-full max-w-md bg-slate-900 rounded-[3rem] p-10 shadow-2xl relative border border-slate-800" onClick={e => e.stopPropagation()}>
            <h2 className="text-3xl font-black mb-8 text-white">লিঙ্ক করুন</h2>
            <input autoFocus value={targetPeerId} onChange={e => setTargetPeerId(e.target.value)} type="text" placeholder="Nest ID এখানে দিন..." className="w-full bg-slate-800 p-5 rounded-2xl font-bold mb-6 outline-none border-2 border-transparent focus:border-orange-500 transition-all text-white" />
            <button onClick={() => connectToPeer(targetPeerId)} className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-orange-500/30">কানেক্ট করুন</button>
          </div>
        </div>
      )}

      {/* Call Screens */}
      {incomingCall && (
        <div className="fixed inset-0 z-[200] bg-slate-950/95 flex flex-col items-center justify-center text-white backdrop-blur-2xl p-10 animate-in zoom-in-95">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${incomingCall.peerId}`} className="w-36 h-36 rounded-[3rem] mb-10 border-4 border-orange-500/20" />
          <h2 className="text-4xl font-black mb-3">{incomingCall.peerId}</h2>
          <p className="text-emerald-500 animate-pulse font-bold uppercase tracking-widest">Incoming Call...</p>
          <div className="flex gap-12 mt-20">
            <button onClick={() => setIncomingCall(null)} className="w-24 h-24 bg-rose-500 rounded-full flex items-center justify-center shadow-xl"><PhoneOff className="w-10 h-10" /></button>
            <button onClick={async () => {
              try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: incomingCall.type === 'video' });
                incomingCall.call.answer(stream);
                setActiveCall({ stream, remoteStream: null, type: incomingCall.type, call: incomingCall.call });
                setIncomingCall(null);
              } catch(e) { alert("Mic error"); }
            }} className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-xl"><Phone className="w-10 h-10" /></button>
          </div>
        </div>
      )}
    </div>
  );

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const profile: UserProfile = { id: `nest-${Math.random().toString(36).substr(2, 6)}`, name: fd.get('name') as string, phone: fd.get('phone') as string, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${fd.get('name')}`, bio: 'চ্যাটনেস্টে স্বাগতম!', status: 'online' };
    setMyProfile(profile);
    localStorage.setItem('chatnest_profile', JSON.stringify(profile));
    setIsRegistered(true);
  }

  function updateProfile(updates: Partial<UserProfile>) {
    if (!myProfile) return;
    const updated = { ...myProfile, ...updates };
    setMyProfile(updated);
    localStorage.setItem('chatnest_profile', JSON.stringify(updated));
  }

  function connectToPeer(id: string) {
    const targetId = id.trim();
    if (targetId === 'ai-gemini') { setActiveChatId('ai-gemini'); setShowConnectModal(false); setTargetPeerId(''); return; }
    if (!peerRef.current || !targetId || targetId === myProfile?.id) return;
    const conn = peerRef.current.connect(targetId);
    setActiveChatId(targetId);
    setShowConnectModal(false);
    setTargetPeerId('');
  }
}
