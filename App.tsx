
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
    Sparkles, User, ShieldCheck, Bell, MessageSquare
} from 'lucide-react';

// Memoized Message Bubble for performance
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

const ChatInput = ({ onSend, onStartRecording, onStopRecording, isRecording, onFileSelect, editingMsg, cancelEdit }: any) => {
  const [text, setText] = useState('');
  
  useEffect(() => {
    if (editingMsg) setText(editingMsg.text);
    else setText('');
  }, [editingMsg]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  return (
    <footer className="p-6 bg-slate-950/50 border-t border-slate-800/50 backdrop-blur-lg">
      {editingMsg && (
        <div className="max-w-4xl mx-auto mb-3 flex items-center justify-between bg-orange-500/10 p-4 rounded-2xl border border-orange-500/20 animate-in slide-in-from-bottom-4">
          <p className="text-xs font-black text-orange-500 flex items-center gap-2"><Edit3 className="w-4 h-4" /> এডিট মুড সক্রিয়</p>
          <button onClick={cancelEdit} className="text-orange-500 hover:bg-orange-500/10 p-1 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
      )}
      <div className="max-w-4xl mx-auto flex items-end gap-3 p-2 bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-inner relative focus-within:ring-2 ring-orange-500/20 transition-all">
        <label className="p-3.5 text-slate-400 hover:text-orange-500 cursor-pointer transition-colors">
          <Paperclip className="w-6 h-6" />
          <input type="file" className="hidden" onChange={onFileSelect} />
        </label>
        <textarea 
          rows={1} 
          value={text} 
          onChange={(e) => setText(e.target.value)} 
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} 
          placeholder="এখানে লিখুন..." 
          className="flex-1 bg-transparent py-4 outline-none text-[15px] font-medium resize-none min-h-[56px] text-slate-200" 
        />
        <button onMouseDown={onStartRecording} onMouseUp={onStopRecording} className={`p-3.5 rounded-full transition-all ${isRecording ? 'bg-orange-500 text-white scale-125 shadow-lg shadow-orange-500/30' : 'text-slate-400 hover:text-orange-500'}`}>
          <Mic className="w-6 h-6" />
        </button>
        <button onClick={handleSend} className="p-4 bg-orange-500 text-white rounded-full shadow-xl shadow-orange-500/30 hover:scale-110 active:scale-95 transition-all"><Send className="w-6 h-6" /></button>
      </div>
    </footer>
  );
};

export default function App() {
  const [isRegistered, setIsRegistered] = useState(() => !!localStorage.getItem('chatnest_profile'));
  const [myProfile, setMyProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('chatnest_profile');
    return saved ? JSON.parse(saved) : null;
  });
  
  // Default to Dark Mode
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('chatnest_dark');
    return saved !== null ? saved === 'true' : true;
  });
  
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSession[]>(dbService.getChats());
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
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
  }, []);

  // Peer Connection & Signaling Logic
  useEffect(() => {
    if (isRegistered && myProfile) {
      const peer = new Peer(myProfile.id);
      peerRef.current = peer;

      peer.on('open', (id) => console.log('Peer connected with ID:', id));
      peer.on('connection', (conn) => setupConnectionListeners(conn));
      peer.on('call', (call) => {
        if (call.peer === 'ai-gemini') { call.close(); return; }
        setIncomingCall({ peerId: call.peer, type: call.metadata?.type || 'audio', call });
      });
      
      peer.on('error', (err) => {
        console.error('Peer error:', err);
        if (err.type === 'peer-unavailable' && !err.message.includes('ai-gemini')) {
            alert('এই ID টি খুঁজে পাওয়া যায়নি বা অফলাইনে আছে।');
        }
      });

      return () => peer.destroy();
    }
  }, [isRegistered, myProfile?.id]);

  const setupConnectionListeners = (conn: DataConnection) => {
    if (conn.peer === 'ai-gemini') { conn.close(); return; }
    conn.on('open', () => {
      connectionsRef.current[conn.peer] = conn;
      if (myProfile) conn.send({ type: 'profile_sync', profile: myProfile });
    });
    conn.on('data', (data: any) => handlePeerData(data, conn.peer));
    conn.on('close', () => delete connectionsRef.current[conn.peer]);
  };

  const handlePeerData = (data: any, senderPeerId: string) => {
    if (data.type === 'message') handleReceivedMessage(data.message, senderPeerId);
    else if (data.type === 'profile_sync') updateChatWithProfile(data.profile);
    else if (data.type === 'message_edit') handleSyncEdit(data.msgId, data.text);
    else if (data.type === 'message_delete') handleSyncDelete(data.msgId);
  };

  const updateChatWithProfile = (profile: UserProfile) => {
    setChats(prev => {
      const existing = prev.find(c => c.id === profile.id);
      let updated;
      if (existing) {
        updated = prev.map(c => c.id === profile.id ? { ...c, name: profile.name, avatar: profile.avatar, bio: profile.bio } : c);
      } else {
        updated = [{ id: profile.id, name: profile.name, avatar: profile.avatar, phone: profile.phone, isOnline: true, type: 'contact', unreadCount: 0, lastMessage: 'Link established', bio: profile.bio }, ...prev];
      }
      dbService.saveChats(updated);
      return updated;
    });
  };

  const handleReceivedMessage = (msg: Message, senderPeerId: string) => {
    const correctedMsg = { ...msg, chatId: senderPeerId };
    dbService.saveMessage(correctedMsg);
    setChats(dbService.getChats());
    if (activeChatId === senderPeerId) setMessages(prev => [...prev, correctedMsg]);
  };

  const handleSyncEdit = (msgId: string, text: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text, isEdited: true } : m));
    setChats(dbService.getChats());
  };

  const handleSyncDelete = (msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    dbService.deleteMessage(msgId);
    setChats(dbService.getChats());
  };

  const connectToPeer = (id: string) => {
    const targetId = id.trim();
    if (targetId === 'ai-gemini') { setActiveChatId('ai-gemini'); setShowConnectModal(false); setTargetPeerId(''); return; }
    if (!peerRef.current || !targetId || targetId === myProfile?.id) return;
    const conn = peerRef.current.connect(targetId);
    setupConnectionListeners(conn);
    setActiveChatId(targetId);
    setShowConnectModal(false);
    setTargetPeerId('');
  };

  const deleteChat = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (!window.confirm("আপনি কি এই চ্যাট এবং সমস্ত মেসেজ মুছে ফেলতে চান?")) return;
    dbService.deleteChat(chatId);
    setChats(dbService.getChats());
    if (activeChatId === chatId) setActiveChatId(null);
  };

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

  useEffect(() => {
    if (activeCall?.remoteStream && remoteVideoRef.current) remoteVideoRef.current.srcObject = activeCall.remoteStream;
    if (activeCall?.stream && localVideoRef.current) localVideoRef.current.srcObject = activeCall.stream;
  }, [activeCall]);

  const handleSendMessage = async (text: string, media?: Message['media']) => {
    if (!activeChatId || !myProfile) return;
    if (editingMsg) {
      const updatedMessages = messages.map(m => m.id === editingMsg.id ? { ...m, text, isEdited: true } : m);
      setMessages(updatedMessages);
      dbService.saveMessage(updatedMessages.find(m => m.id === editingMsg.id)!);
      if (!isAIChat) {
        const conn = connectionsRef.current[activeChatId];
        if (conn?.open) conn.send({ type: 'message_edit', msgId: editingMsg.id, text });
      }
      setEditingMsg(null);
      setChats(dbService.getChats());
      return;
    }
    const newMessage: Message = { id: `msg-${Date.now()}`, chatId: activeChatId, senderId: myProfile.id, senderName: myProfile.name, senderAvatar: myProfile.avatar, text, timestamp: Date.now(), status: MessageStatus.SENT, media };
    setMessages(prev => [...prev, newMessage]);
    dbService.saveMessage(newMessage);
    if (isAIChat) handleAIResponse(text);
    else {
      const conn = connectionsRef.current[activeChatId];
      if (conn?.open) conn.send({ type: 'message', message: newMessage });
      else {
        const newConn = peerRef.current!.connect(activeChatId);
        setupConnectionListeners(newConn);
        newConn.on('open', () => newConn.send({ type: 'message', message: newMessage }));
      }
    }
    setChats(dbService.getChats());
  };

  const handleAIResponse = async (text: string) => {
    setIsGenerating(true);
    if (text.startsWith('/image ')) {
      const imageUrl = await geminiService.generateImage(text.replace('/image ', ''));
      if (imageUrl) saveAI({ id: `ai-${Date.now()}`, chatId: 'ai-gemini', senderId: 'ai-gemini', senderName: 'Neo AI', text: `Result: ${text.replace('/image ', '')}`, timestamp: Date.now(), status: MessageStatus.DELIVERED, media: { type: 'image', url: imageUrl, mimeType: 'image/png' }, isAI: true });
      setIsGenerating(false); return;
    }
    const resp = await geminiService.getChatResponse(text, messages.slice(-5).map(m => ({ role: m.senderId === 'ai-gemini' ? 'model' : 'user', text: m.text })));
    saveAI({ id: `ai-${Date.now()}`, chatId: 'ai-gemini', senderId: 'ai-gemini', senderName: 'Neo AI', text: resp.text, timestamp: Date.now(), status: MessageStatus.DELIVERED, isAI: true, sources: resp.sources });
    setIsGenerating(false);
  };

  const saveAI = (msg: Message) => {
    dbService.saveMessage(msg);
    setMessages(prev => [...prev, msg]);
    setChats(dbService.getChats());
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const profile: UserProfile = { id: `nest-${Math.random().toString(36).substr(2, 6)}`, name: fd.get('name') as string, phone: fd.get('phone') as string, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${fd.get('name')}`, bio: 'চ্যাটনেস্টে স্বাগতম!', status: 'online' };
    setMyProfile(profile);
    localStorage.setItem('chatnest_profile', JSON.stringify(profile));
    setIsRegistered(true);
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    if (!myProfile) return;
    const updated = { ...myProfile, ...updates };
    setMyProfile(updated);
    localStorage.setItem('chatnest_profile', JSON.stringify(updated));
    if (peerRef.current?.open) {
      (Object.values(connectionsRef.current) as DataConnection[]).forEach(conn => {
        if (conn.open) conn.send({ type: 'profile_sync', profile: updated });
      });
    }
  };

  const startCall = async (type: 'audio' | 'video') => {
    if (!activeChatId || !peerRef.current || isAIChat) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
      const call = peerRef.current.call(activeChatId, stream, { metadata: { type } });
      setActiveCall({ stream, remoteStream: null, type, call });
      call.on('stream', (remoteStream) => setActiveCall(prev => prev ? { ...prev, remoteStream } : null));
      call.on('close', endCall);
    } catch (err) { alert("Access denied."); }
  };

  const endCall = () => {
    if (activeCall) { activeCall.stream.getTracks().forEach(t => t.stop()); activeCall.call.close(); setActiveCall(null); }
    setIncomingCall(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr; audioChunksRef.current = [];
      mr.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mr.onstop = () => {
        const reader = new FileReader();
        reader.onloadend = () => handleSendMessage('', { type: 'audio', url: reader.result as string, mimeType: 'audio/webm', fileName: 'Voice' });
        reader.readAsDataURL(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(); setIsRecording(true);
    } catch (e) { alert("Mic required"); }
  };

  if (!isRegistered) return (
    <div className="h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900 rounded-[3rem] p-10 shadow-2xl border border-orange-500/10">
        <div className="w-20 h-20 bg-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-orange-500/20"><Zap className="w-10 h-10 text-white" /></div>
        <h1 className="text-3xl font-black text-center mb-6 text-white">ChatNest</h1>
        <form onSubmit={handleRegister} className="space-y-6">
          <input name="name" type="text" placeholder="আপনার নাম" className="w-full bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-orange-500 font-bold transition-all text-white" required />
          <input name="phone" type="tel" placeholder="ফোন নম্বর" className="w-full bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-orange-500 font-bold transition-all text-white" required />
          <button type="submit" className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-orange-500/30">শুরু করুন</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className={`flex h-screen bg-slate-950 text-slate-100 font-jakarta selection:bg-orange-500/30`}>
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
            <input type="text" placeholder="সার্চ করুন..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-sm outline-none shadow-sm border border-slate-700/50 focus:ring-2 ring-orange-500/20" />
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
                <MessageBubble key={msg.id} msg={msg} isMe={msg.senderId === myProfile?.id} onEdit={setEditingMsg} onDelete={(id) => { if(window.confirm("মুছে ফেলতে চান?")) { setMessages(prev => prev.filter(m => m.id !== id)); dbService.deleteMessage(id); } }} />
              ))}
              {isGenerating && <div className="flex gap-2 items-center text-[11px] font-black text-orange-500 animate-pulse ml-4">Neo is thinking...</div>}
              <div ref={scrollRef} />
            </div>
            <ChatInput onSend={handleSendMessage} onStartRecording={startRecording} onStopRecording={() => { if(mediaRecorderRef.current) { mediaRecorderRef.current.stop(); setIsRecording(false); } }} isRecording={isRecording} editingMsg={editingMsg} cancelEdit={() => setEditingMsg(null)} onFileSelect={(e:any) => { const file = e.target.files?.[0]; if(file) { const reader = new FileReader(); reader.onloadend = () => handleSendMessage('', { type: file.type.startsWith('image/') ? 'image' : 'file', url: reader.result as string, mimeType: file.type, fileName: file.name }); reader.readAsDataURL(file); } }} />
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
                    <input type="text" value={myProfile?.name} onChange={(e) => updateProfile({ name: e.target.value })} className="bg-transparent outline-none w-full font-bold" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-black text-orange-500 uppercase tracking-widest mb-2">Your Bio</h3>
                  <div className="flex items-start gap-3 bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                    <MessageSquare className="w-5 h-5 text-slate-400 mt-1" />
                    <textarea value={myProfile?.bio} onChange={(e) => updateProfile({ bio: e.target.value })} className="bg-transparent outline-none w-full font-medium h-20 resize-none" placeholder="নিজের সম্পর্কে কিছু লিখুন..." />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase mb-1">Nest ID</h4>
                    <div className="flex items-center justify-between">
                      <code className="text-xs font-bold">{myProfile?.id}</code>
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

                <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
                   <div className="flex items-center gap-3">
                     <Bell className="w-5 h-5 text-slate-400" />
                     <span className="font-bold text-sm">Notifications</span>
                   </div>
                   <div className="w-12 h-6 bg-orange-500 rounded-full flex items-center justify-end p-1"><div className="w-4 h-4 bg-white rounded-full shadow-sm" /></div>
                </div>

                <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full py-4 bg-rose-500/10 text-rose-500 rounded-2xl font-black text-sm hover:bg-rose-500 hover:text-white transition-all">লগ আউট / রিসেট করুন</button>
              </div>
            </div>
          </div>
        </div>
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

      {/* Call Screens (Hidden until active) */}
      {incomingCall && (
        <div className="fixed inset-0 z-[200] bg-slate-950/95 flex flex-col items-center justify-center text-white backdrop-blur-2xl p-10 animate-in zoom-in-95">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${incomingCall.peerId}`} className="w-36 h-36 rounded-[3rem] mb-10 border-4 border-orange-500/20" />
          <h2 className="text-4xl font-black mb-3">{incomingCall.peerId}</h2>
          <p className="text-emerald-500 animate-pulse font-bold uppercase tracking-widest">Incoming Call...</p>
          <div className="flex gap-12 mt-20">
            <button onClick={endCall} className="w-24 h-24 bg-rose-500 rounded-full flex items-center justify-center shadow-xl"><PhoneOff className="w-10 h-10" /></button>
            <button onClick={async () => {
              try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: incomingCall.type === 'video' });
                incomingCall.call.answer(stream);
                setActiveCall({ stream, remoteStream: null, type: incomingCall.type, call: incomingCall.call });
                incomingCall.call.on('stream', (rs) => setActiveCall(p => p ? {...p, remoteStream: rs} : null));
                setIncomingCall(null);
              } catch(e) { alert("Mic/Camera error"); }
            }} className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-xl"><Phone className="w-10 h-10" /></button>
          </div>
        </div>
      )}

      {activeCall && (
        <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col items-center justify-center">
          {activeCall.type === 'video' ? (
            <div className="w-full h-full relative">
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute top-10 right-10 w-48 h-72 bg-slate-900 rounded-3xl border-4 border-white/20 overflow-hidden shadow-2xl">
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-48 h-48 bg-orange-500/10 rounded-full flex items-center justify-center mb-12 animate-pulse">
                <Headphones className="w-24 h-24 text-orange-500" />
              </div>
              <h2 className="text-4xl font-black text-white">ভয়েস কল চলছে</h2>
            </div>
          )}
          <div className="absolute bottom-16">
            <button onClick={endCall} className="w-20 h-20 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-xl"><PhoneOff className="w-9 h-9" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
