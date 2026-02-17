
import React, { useState, useEffect, useRef, memo } from 'react';
import { Peer, DataConnection } from "peerjs";
import { Message, ChatSession, MessageStatus, UserProfile } from './types';
import { dbService } from './services/dbService';
import { geminiService } from './services/geminiService';
import { 
    Search, Phone, Video as VideoIcon, Send, ArrowLeft,
    CheckCheck, X, Camera, PhoneOff,
    Zap, Edit3, ExternalLink,
    UserPlus2, Copy, Check, Mic, Paperclip, 
    Trash2, Plus, MessageSquare
} from 'lucide-react';

// --- Components ---

const MessageBubble = memo(({ msg, isMe, onEdit, onDelete }: { 
  msg: Message, 
  isMe: boolean, 
  onEdit: (m: Message) => void, 
  onDelete: (id: string) => void 
}) => {
  return (
    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300 mb-4`}>
      <div className={`group relative max-w-[85%] p-4 rounded-3xl shadow-sm border transition-all ${isMe ? 'bg-orange-500 text-white rounded-tr-none border-orange-400/20' : 'bg-slate-900 rounded-tl-none border-slate-800'}`}>
        {msg.text && <p className="text-[14px] font-medium leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
        {msg.media?.type === 'image' && <img src={msg.media.url} className="rounded-2xl max-w-full mt-2 border border-white/20" loading="lazy" />}
        {msg.media?.type === 'audio' && <audio controls src={msg.media.url} className="mt-2 h-10 w-56 filter" />}
        
        {msg.sources && msg.sources.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-800">
            <p className="text-[10px] font-black uppercase opacity-60 mb-2 flex items-center gap-1">Sources</p>
            <div className="flex flex-wrap gap-2">
              {msg.sources.map((source: any, idx: number) => (
                <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 p-2 rounded-xl text-[10px] border border-white/5">
                  <span className="truncate max-w-[120px] font-bold">{source.title || 'Link'}</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ))}
            </div>
          </div>
        )}

        {isMe && (
          <div className="absolute top-0 -left-14 opacity-0 group-hover:opacity-100 flex flex-col gap-1.5 transition-all">
            <button onClick={() => onDelete(msg.id)} className="p-2.5 bg-slate-800 text-rose-500 rounded-xl shadow-lg border border-slate-700 hover:bg-rose-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        )}

        <div className="flex justify-end items-center gap-1.5 mt-2.5 opacity-60 text-[10px] font-black tracking-tight">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {isMe && <CheckCheck className="w-3.5 h-3.5" />}
        </div>
      </div>
    </div>
  );
});

const ChatInput = memo(({ onSend, isRecording, onStartRecording, onStopRecording, onFileSelect }: any) => {
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSend(text);
      setText('');
    }
  };

  return (
    <div className="p-6 bg-slate-950/80 backdrop-blur-md border-t border-slate-800/50">
      <form onSubmit={handleSubmit} className="flex items-end gap-4 max-w-6xl mx-auto">
        <div className="flex-1 relative flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-[2.5rem] focus-within:ring-2 ring-orange-500/20">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3.5 text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 rounded-full"><Paperclip className="w-5 h-5" /></button>
          <input type="file" ref={fileInputRef} onChange={onFileSelect} className="hidden" />
          <textarea 
            value={text} 
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
            placeholder="এখানে মেসেজ লিখুন..." 
            className="flex-1 bg-transparent py-3.5 px-2 outline-none text-sm font-medium resize-none max-h-32 custom-scrollbar"
            rows={1}
          />
          <button 
            type="button" 
            onMouseDown={onStartRecording} 
            onMouseUp={onStopRecording} 
            className={`p-3.5 rounded-full transition-all ${isRecording ? 'bg-rose-500 text-white animate-pulse' : 'text-slate-400 hover:text-orange-500 hover:bg-orange-500/10'}`}
          >
            <Mic className="w-5 h-5" />
          </button>
        </div>
        <button type="submit" className="p-5 bg-orange-500 text-white rounded-[2rem] shadow-xl hover:scale-105 transition-all active:scale-95"><Send className="w-6 h-6" /></button>
      </form>
    </div>
  );
});

// --- Main App ---

export default function App() {
  const [isRegistered, setIsRegistered] = useState(() => !!localStorage.getItem('chatnest_profile'));
  const [myProfile, setMyProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('chatnest_profile');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSession[]>(dbService.getChats());
  const [messages, setMessages] = useState<Message[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [targetPeerId, setTargetPeerId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [copyStatus, setCopyStatus] = useState(false);

  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<{ [key: string]: DataConnection }>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // --- Initialize Peer ---
  useEffect(() => {
    document.documentElement.classList.add('dark');
    if (isRegistered && myProfile) {
      const peer = new Peer(myProfile.id);
      peerRef.current = peer;
      
      peer.on('connection', (conn) => {
        setupConnection(conn);
      });

      peer.on('call', (call) => {
        setIncomingCall({ peerId: call.peer, type: call.metadata?.type || 'audio', call });
      });

      return () => {
        peer.destroy();
      };
    }
  }, [isRegistered, myProfile?.id]);

  useEffect(() => {
    if (activeChatId) {
      setMessages(dbService.getMessages(activeChatId));
    }
  }, [activeChatId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Handle media streams for active calls
  useEffect(() => {
    if (activeCall?.remoteStream && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = activeCall.remoteStream;
    }
    if (activeCall?.localStream && localVideoRef.current) {
        localVideoRef.current.srcObject = activeCall.localStream;
    }
  }, [activeCall]);

  const setupConnection = (conn: DataConnection) => {
    conn.on('open', () => {
      connectionsRef.current[conn.peer] = conn;
      if (myProfile) conn.send({ type: 'profile_sync', profile: myProfile });
    });

    conn.on('data', (data: any) => {
      if (data.type === 'message') {
        const incomingMsg = { ...data.message, chatId: conn.peer };
        dbService.saveMessage(incomingMsg);
        setChats(dbService.getChats());
        if (activeChatId === conn.peer) {
          setMessages(prev => [...prev, incomingMsg]);
        }
      } else if (data.type === 'profile_sync') {
        syncChatProfile(data.profile);
      }
    });

    conn.on('close', () => {
      delete connectionsRef.current[conn.peer];
    });
  };

  const syncChatProfile = (profile: any) => {
    setChats(prev => {
      const existing = prev.find(c => c.id === profile.id);
      let updated;
      if (existing) {
        updated = prev.map(c => c.id === profile.id ? { ...c, name: profile.name, avatar: profile.avatar, bio: profile.bio, isOnline: true } : c);
      } else {
        updated = [{ 
          id: profile.id, 
          name: profile.name, 
          avatar: profile.avatar, 
          phone: profile.phone || '', 
          bio: profile.bio || '',
          type: 'contact', 
          isOnline: true, 
          unreadCount: 0,
          lastMessage: 'Link established' 
        }, ...prev];
      }
      dbService.saveChats(updated);
      return updated;
    });
  };

  const connectToPeer = (id: string) => {
    const tid = id.trim();
    if (!tid || tid === myProfile?.id || !peerRef.current) return;
    
    if (tid === 'ai-gemini') {
      setActiveChatId('ai-gemini');
      setShowConnectModal(false);
      return;
    }

    const conn = peerRef.current.connect(tid);
    setupConnection(conn);
    
    // Initial dummy profile until synced
    syncChatProfile({ id: tid, name: `Chat ${tid}`, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${tid}` });
    
    setActiveChatId(tid);
    setShowConnectModal(false);
    setTargetPeerId('');
  };

  const handleSendMessage = async (text: string, media?: any) => {
    if (!activeChatId || !myProfile) return;

    const newMessage: Message = { 
      id: `msg-${Date.now()}`, 
      chatId: activeChatId, 
      senderId: myProfile.id, 
      senderName: myProfile.name, 
      senderAvatar: myProfile.avatar, 
      text, 
      timestamp: Date.now(), 
      status: MessageStatus.SENT, 
      media 
    };
    
    setMessages(prev => [...prev, newMessage]);
    dbService.saveMessage(newMessage);
    
    if (activeChatId === 'ai-gemini') {
      setIsGenerating(true);
      const resp = await geminiService.getChatResponse(text, messages.slice(-5).map(m => ({ role: m.senderId === 'ai-gemini' ? 'model' : 'user', text: m.text })));
      const aiMsg: Message = { 
        id: `ai-${Date.now()}`, 
        chatId: 'ai-gemini', 
        senderId: 'ai-gemini', 
        senderName: 'Neo AI', 
        text: resp.text, 
        timestamp: Date.now(), 
        status: MessageStatus.SENT, 
        isAI: true, 
        sources: resp.sources 
      };
      dbService.saveMessage(aiMsg);
      setMessages(prev => [...prev, aiMsg]);
      setIsGenerating(false);
    } else {
      const conn = connectionsRef.current[activeChatId];
      if (conn?.open) {
        conn.send({ type: 'message', message: newMessage });
      }
    }
    setChats(dbService.getChats());
  };

  const startCall = async (type: 'audio' | 'video') => {
    if (!activeChatId || !peerRef.current || activeChatId === 'ai-gemini') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
      const call = peerRef.current.call(activeChatId, stream, { metadata: { type } });
      setActiveCall({ localStream: stream, remoteStream: null, call, type });
      
      call.on('stream', (rs) => {
        setActiveCall(prev => prev ? { ...prev, remoteStream: rs } : null);
      });
      call.on('close', () => setActiveCall(null));
      call.on('error', () => setActiveCall(null));
    } catch(e) { alert("Camera/Mic access is required for calling."); }
  };

  const handleDeleteChat = (id: string) => {
    if (id === 'ai-gemini') return;
    if (window.confirm("আপনি কি নিশ্চিতভাবে এই চ্যাটটি মুছে ফেলতে চান? সব মেসেজ মুছে যাবে।")) {
      dbService.deleteChat(id);
      setChats(dbService.getChats());
      if (activeChatId === id) setActiveChatId(null);
    }
  };

  if (!isRegistered) return (
    <div className="h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900 rounded-[3rem] p-10 shadow-2xl border border-orange-500/10">
        <Zap className="w-16 h-16 text-orange-500 mx-auto mb-8" />
        <h1 className="text-3xl font-black text-center mb-10 text-white">ChatNest Registration</h1>
        <form onSubmit={(e: any) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const p: UserProfile = { 
            id: `nest-${Math.random().toString(36).substr(2, 6)}`, 
            name: fd.get('name') as string, 
            phone: fd.get('phone') as string, 
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${fd.get('name')}`, 
            bio: 'Welcome to ChatNest!', 
            status: 'online' 
          };
          localStorage.setItem('chatnest_profile', JSON.stringify(p));
          setMyProfile(p); 
          setIsRegistered(true);
        }} className="space-y-6">
          <input name="name" placeholder="আপনার নাম" className="w-full bg-slate-800 p-5 rounded-2xl outline-none border-2 border-transparent focus:border-orange-500 text-white font-bold" required />
          <input name="phone" placeholder="ফোন নম্বর" className="w-full bg-slate-800 p-5 rounded-2xl outline-none border-2 border-transparent focus:border-orange-500 text-white font-bold" required />
          <button className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-orange-500/20 active:scale-95 transition-all">শুরু করুন</button>
        </form>
      </div>
    </div>
  );

  const currentChat = chats.find(c => c.id === activeChatId);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-jakarta">
      {/* Sidebar */}
      <aside className={`${activeChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col border-r border-slate-800/50 bg-slate-900/50`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-black text-orange-500 flex items-center gap-2"><Zap className="w-5 h-5" /> ChatNest</h1>
            <div className="flex gap-2">
              <button onClick={() => setShowConnectModal(true)} title="নতুন কন্টাক্ট অ্যাড করুন" className="p-2.5 bg-orange-500 text-white rounded-xl hover:scale-110 transition-all shadow-lg shadow-orange-500/20"><Plus className="w-6 h-6" /></button>
              <button onClick={() => setShowSettings(true)} className="w-10 h-10 rounded-xl overflow-hidden border border-slate-700 hover:scale-105 transition-all"><img src={myProfile?.avatar} className="w-full h-full object-cover" /></button>
            </div>
          </div>
          
          <div className="space-y-2 overflow-y-auto flex-1 custom-scrollbar">
            {chats.map(chat => (
              <div 
                key={chat.id} 
                onClick={() => setActiveChatId(chat.id)} 
                className={`group flex items-center gap-4 p-4 cursor-pointer rounded-[2rem] relative transition-all ${activeChatId === chat.id ? 'bg-orange-500 shadow-xl shadow-orange-500/20' : 'hover:bg-slate-800'}`}
              >
                <img src={chat.avatar} className="w-12 h-12 rounded-2xl object-cover" />
                <div className="flex-1 truncate">
                  <h3 className={`font-bold text-sm truncate ${activeChatId === chat.id ? 'text-white' : ''}`}>{chat.name}</h3>
                  <p className={`text-xs truncate ${activeChatId === chat.id ? 'text-white/70' : 'opacity-50'}`}>{chat.lastMessage || 'Link established'}</p>
                </div>
                {chat.id !== 'ai-gemini' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }} 
                    className={`opacity-0 group-hover:opacity-100 p-2 rounded-xl transition-all ${activeChatId === chat.id ? 'text-white hover:bg-white/20' : 'text-rose-500 hover:bg-rose-500/10'}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {chats.length === 0 && (
                <div className="text-center py-10 opacity-30">
                    <MessageSquare className="w-10 h-10 mx-auto mb-2" />
                    <p className="text-xs font-bold uppercase tracking-widest">No Chats Yet</p>
                </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`${activeChatId ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col bg-slate-950 relative`}>
        {activeChatId ? (
          <>
            <header className="px-6 py-4 border-b border-slate-800/50 flex items-center justify-between bg-slate-950/80 backdrop-blur-md z-40">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveChatId(null)} className="md:hidden p-2 text-slate-400"><ArrowLeft /></button>
                <div className="relative">
                    <img src={currentChat?.avatar} className="w-11 h-11 rounded-xl object-cover shadow-lg border border-slate-800" />
                    {currentChat?.isOnline && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full" />}
                </div>
                <div>
                  <h2 className="font-black text-white">{currentChat?.name}</h2>
                  <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest">{currentChat?.isOnline ? 'Online' : 'Connected'}</p>
                </div>
              </div>
              
              {activeChatId !== 'ai-gemini' && (
                <div className="flex gap-4">
                  <button onClick={() => startCall('audio')} title="অডিও কল" className="p-3 bg-slate-800 text-slate-200 hover:text-orange-500 hover:bg-slate-700 rounded-2xl transition-all shadow-md active:scale-90 border border-slate-700"><Phone className="w-5 h-5" /></button>
                  <button onClick={() => startCall('video')} title="ভিডিও কল" className="p-3 bg-slate-800 text-slate-200 hover:text-orange-500 hover:bg-slate-700 rounded-2xl transition-all shadow-md active:scale-90 border border-slate-700"><VideoIcon className="w-5 h-5" /></button>
                  <button onClick={() => handleDeleteChat(activeChatId)} title="চ্যাট ডিলিট করুন" className="p-3 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-2xl transition-all shadow-md active:scale-90 border border-rose-500/20"><Trash2 className="w-5 h-5" /></button>
                </div>
              )}
            </header>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {messages.map(m => (
                <MessageBubble 
                  key={m.id} 
                  msg={m} 
                  isMe={m.senderId === myProfile?.id} 
                  onEdit={() => {}} 
                  onDelete={(id) => { if(window.confirm("Delete message?")) { dbService.deleteMessage(id); setMessages(prev => prev.filter(x => x.id !== id)); }}} 
                />
              ))}
              {isGenerating && <div className="text-[11px] font-black text-orange-500 animate-pulse ml-4 mb-4">Neo is thinking...</div>}
              <div ref={scrollRef} />
            </div>

            <ChatInput 
              onSend={handleSendMessage} 
              isRecording={isRecording}
              onStartRecording={() => {}} // Placeholder for now
              onStopRecording={() => {}} // Placeholder for now
              onFileSelect={(e:any) => {
                const file = e.target.files?.[0];
                if(file) {
                  const reader = new FileReader();
                  reader.onloadend = () => handleSendMessage('', { type: file.type.startsWith('image/') ? 'image' : 'file', url: reader.result as string, mimeType: file.type, fileName: file.name });
                  reader.readAsDataURL(file);
                }
              }}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
            <Zap className="w-24 h-24 text-orange-500 mb-8 animate-pulse" />
            <h2 className="text-6xl font-black mb-4 tracking-tighter">ChatNest</h2>
            <p className="text-slate-500 mb-10 max-w-sm font-medium">নিরাপদ এবং ব্যক্তিগত চ্যাটিং এর জন্য আপনার বন্ধুদের Nest ID ব্যবহার করে লিঙ্ক করুন।</p>
            <button onClick={() => setShowConnectModal(true)} className="px-12 py-5 bg-orange-500 text-white rounded-[2rem] font-black shadow-2xl hover:scale-105 transition-all flex items-center gap-3 active:scale-95"><UserPlus2 /> নতুন চ্যাট শুরু করুন</button>
          </div>
        )}
      </main>

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={() => setShowConnectModal(false)}>
          <div className="w-full max-w-md bg-slate-900 rounded-[3rem] p-10 border border-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black">ফ্রেন্ড লিঙ্ক করুন</h2>
                <button onClick={() => setShowConnectModal(false)} className="p-2 bg-slate-800 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-500 mb-4 font-bold uppercase tracking-widest">Enter Friend's Nest ID</p>
            <input 
              autoFocus 
              value={targetPeerId} 
              onChange={e => setTargetPeerId(e.target.value)} 
              placeholder="nest-xxxxxx" 
              className="w-full bg-slate-800 p-5 rounded-2xl font-bold mb-8 text-white outline-none border-2 border-transparent focus:border-orange-500 transition-all text-center tracking-widest" 
            />
            <button onClick={() => connectToPeer(targetPeerId)} className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-95">কানেক্ট করুন</button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-xl bg-slate-900 rounded-[3rem] overflow-hidden border border-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="h-28 bg-gradient-to-r from-orange-500/20 to-orange-400/10" />
            <div className="px-10 pb-10 -mt-14">
              <div className="flex justify-between items-end mb-8">
                <div className="relative group">
                  <img src={myProfile?.avatar} className="w-28 h-28 rounded-[2.5rem] border-4 border-slate-900 shadow-xl object-cover" />
                  <label className="absolute inset-0 bg-black/40 rounded-[2.5rem] flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-all"><Camera className="text-white" /><input type="file" className="hidden" accept="image/*" onChange={(e:any) => { const file = e.target.files?.[0]; if(file) { const reader = new FileReader(); reader.onloadend = () => { const n = { ...myProfile!, avatar: reader.result as string }; setMyProfile(n); localStorage.setItem('chatnest_profile', JSON.stringify(n)); }; reader.readAsDataURL(file); } }} /></label>
                </div>
                <button onClick={() => setShowSettings(false)} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-full transition-all shadow-lg"><X /></button>
              </div>
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1.5 ml-1">Your Unique Nest ID (Share this)</p>
                  <div className="flex items-center justify-between bg-slate-800 p-4 rounded-2xl border border-slate-700">
                    <code className="text-orange-400 font-bold tracking-widest">{myProfile?.id}</code>
                    <button onClick={() => { navigator.clipboard.writeText(myProfile?.id || ''); setCopyStatus(true); setTimeout(() => setCopyStatus(false), 2000); }} className="text-slate-400 hover:text-orange-500 transition-all">{copyStatus ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1.5 ml-1">Profile Name</p>
                  <input 
                    value={myProfile?.name} 
                    onChange={(e) => { const n = { ...myProfile!, name: e.target.value }; setMyProfile(n); localStorage.setItem('chatnest_profile', JSON.stringify(n)); }} 
                    className="w-full bg-slate-800 p-4 rounded-2xl font-bold text-white outline-none border border-slate-700 focus:border-orange-500 transition-all" 
                  />
                </div>
                <button onClick={() => { if(window.confirm("Are you sure? All data will be wiped.")) { localStorage.clear(); window.location.reload(); } }} className="w-full py-4 bg-rose-500/10 text-rose-500 rounded-2xl font-black text-sm hover:bg-rose-500 hover:text-white transition-all">লগ আউট / রিসেট</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Incoming Call UI */}
      {incomingCall && (
        <div className="fixed inset-0 z-[200] bg-slate-950/95 flex flex-col items-center justify-center backdrop-blur-xl p-10 animate-in zoom-in-95">
          <div className="relative mb-10">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${incomingCall.peerId}`} className="w-32 h-32 rounded-[2.5rem] shadow-2xl border-4 border-orange-500/20" />
            <div className="absolute inset-0 rounded-[2.5rem] border-4 border-emerald-500 animate-ping opacity-20" />
          </div>
          <h2 className="text-4xl font-black mb-3 text-white uppercase tracking-tighter">{incomingCall.peerId}</h2>
          <p className="text-emerald-500 font-bold uppercase tracking-widest text-sm mb-20 animate-pulse flex items-center gap-2">
            {incomingCall.type === 'video' ? <VideoIcon className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            Incoming {incomingCall.type} Call...
          </p>
          <div className="flex gap-16">
            <button onClick={() => { incomingCall.call.close(); setIncomingCall(null); }} className="w-24 h-24 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-rose-500/20 active:scale-90 transition-all"><PhoneOff className="w-10 h-10" /></button>
            <button onClick={async () => {
              try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: incomingCall.type === 'video' });
                incomingCall.call.answer(stream);
                setActiveCall({ localStream: stream, remoteStream: null, call: incomingCall.call, type: incomingCall.type });
                
                incomingCall.call.on('stream', (rs: any) => {
                    setActiveCall(prev => prev ? { ...prev, remoteStream: rs } : null);
                });
                setIncomingCall(null);
              } catch(e) { alert("Microphone access denied."); }
            }} className="w-24 h-24 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/20 active:scale-90 transition-all"><Phone className="w-10 h-10" /></button>
          </div>
        </div>
      )}

      {/* Active Call UI */}
      {activeCall && (
        <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col animate-in fade-in">
          <div className="flex-1 relative flex items-center justify-center overflow-hidden">
            {activeCall.type === 'video' ? (
                <div className="w-full h-full relative">
                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute top-10 left-10 p-4 bg-black/40 backdrop-blur-md rounded-2xl">
                        <p className="text-xs font-black uppercase tracking-widest text-orange-500">Encrypted Video Link</p>
                    </div>
                    <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-10 right-10 w-48 h-64 object-cover rounded-3xl border-4 border-slate-900 shadow-2xl" />
                </div>
            ) : (
                <div className="text-center">
                    <div className="relative inline-block mb-10">
                        <img src={currentChat?.avatar} className="w-48 h-48 rounded-[4rem] shadow-2xl border-4 border-orange-500/10" />
                        <div className="absolute inset-0 rounded-[4rem] border-4 border-orange-500 animate-pulse opacity-10" />
                    </div>
                    <h2 className="text-4xl font-black mb-2 text-white">{currentChat?.name || 'Active Call'}</h2>
                    <p className="text-orange-500 font-bold uppercase tracking-widest text-sm animate-pulse tracking-[0.3em]">Talking...</p>
                    <audio ref={remoteVideoRef} autoPlay className="hidden" />
                </div>
            )}
          </div>
          <div className="p-12 flex justify-center bg-slate-900/50 backdrop-blur-md border-t border-slate-800">
            <button onClick={() => { 
                activeCall.localStream?.getTracks().forEach((t:any) => t.stop()); 
                activeCall.call.close(); 
                setActiveCall(null); 
            }} className="w-24 h-24 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-90 transition-all shadow-rose-500/20">
                <PhoneOff className="w-10 h-10" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
