
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

// Message Bubble Component
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
                  <span className="truncate max-w-[120px] font-bold">{source.title || 'Link'}</span>
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

// Chat Input Component
const ChatInput = memo(({ onSend, onStartRecording, onStopRecording, isRecording, editingMsg, cancelEdit, onFileSelect }: any) => {
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
          <p className="text-xs font-bold text-orange-500 uppercase tracking-widest flex items-center gap-2"><Edit3 className="w-4 h-4" /> Editing Mode</p>
          <button onClick={cancelEdit} className="text-orange-500"><X className="w-4 h-4" /></button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-end gap-4 max-w-6xl mx-auto">
        <div className="flex-1 relative flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-[2.5rem] focus-within:ring-2 ring-orange-500/20">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3.5 text-slate-400 hover:text-orange-500"><Paperclip className="w-5 h-5" /></button>
          <input type="file" ref={fileInputRef} onChange={onFileSelect} className="hidden" />
          <textarea 
            value={text} 
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmit(e))}
            placeholder="মেসেজ লিখুন..." 
            className="flex-1 bg-transparent py-3.5 px-2 outline-none text-sm font-medium resize-none max-h-32"
            rows={1}
          />
          <button type="button" onMouseDown={onStartRecording} onMouseUp={onStopRecording} className={`p-3.5 rounded-full transition-all ${isRecording ? 'bg-rose-500 text-white animate-pulse' : 'text-slate-400 hover:text-orange-500'}`}><Mic className="w-5 h-5" /></button>
        </div>
        <button type="submit" className="p-5 bg-orange-500 text-white rounded-[2rem] shadow-xl hover:scale-105 transition-all"><Send className="w-6 h-6" /></button>
      </form>
    </div>
  );
});

// Admin Panel
const AdminPanel = ({ chats, onClose, onDeleteChat, messagesCount }: any) => {
  return (
    <div className="fixed inset-0 z-[150] bg-slate-950 flex flex-col animate-in fade-in">
      <header className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
        <h2 className="text-xl font-black flex items-center gap-3"><LayoutDashboard className="text-orange-500" /> Admin Command Center</h2>
        <button onClick={onClose} className="p-2 bg-slate-800 rounded-xl"><X /></button>
      </header>
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800">
              <p className="text-xs font-bold text-slate-500 uppercase">Contacts</p>
              <p className="text-3xl font-black">{chats.length}</p>
            </div>
            <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800">
              <p className="text-xs font-bold text-slate-500 uppercase">Messages</p>
              <p className="text-3xl font-black">{messagesCount}</p>
            </div>
          </div>
          <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-950/50">
                <tr className="text-[10px] font-black uppercase text-slate-500">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {chats.map((c: any) => (
                  <tr key={c.id}>
                    <td className="px-6 py-4 flex items-center gap-3"><img src={c.avatar} className="w-8 h-8 rounded-lg" /> {c.name}</td>
                    <td className="px-6 py-4 text-right"><button onClick={(e) => onDeleteChat(e, c.id)} className="text-rose-500"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
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
  
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSession[]>(dbService.getChats());
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [targetPeerId, setTargetPeerId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [activeCall, setActiveCall] = useState<any>(null);

  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<{ [key: string]: DataConnection }>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    if (isRegistered && myProfile) {
      const peer = new Peer(myProfile.id);
      peerRef.current = peer;
      peer.on('connection', setupConnection);
      peer.on('call', (call) => setIncomingCall({ call }));
    }
    return () => peerRef.current?.destroy();
  }, [isRegistered]);

  const setupConnection = (conn: DataConnection) => {
    conn.on('open', () => {
      connectionsRef.current[conn.peer] = conn;
      if (myProfile) conn.send({ type: 'profile_sync', profile: myProfile });
    });
    conn.on('data', (data: any) => {
      if (data.type === 'message') {
        dbService.saveMessage({ ...data.message, chatId: conn.peer });
        setChats(dbService.getChats());
        if (activeChatId === conn.peer) setMessages(dbService.getMessages(conn.peer));
      } else if (data.type === 'profile_sync') {
        addOrUpdateChat(data.profile);
      }
    });
  };

  const addOrUpdateChat = (profile: any) => {
    setChats(prev => {
      const existing = prev.find(c => c.id === profile.id);
      let updated;
      if (existing) {
        updated = prev.map(c => c.id === profile.id ? { ...c, name: profile.name, avatar: profile.avatar, bio: profile.bio } : c);
      } else {
        updated = [{ ...profile, type: 'contact', isOnline: true, lastMessage: 'Link established' }, ...prev];
      }
      dbService.saveChats(updated);
      return updated;
    });
  };

  const connectToPeer = (id: string) => {
    const tid = id.trim();
    if (!tid || tid === myProfile?.id || !peerRef.current) return;
    if (tid === 'ai-gemini') { setActiveChatId('ai-gemini'); setShowConnectModal(false); return; }
    
    const conn = peerRef.current.connect(tid);
    setupConnection(conn);
    // Add temporary chat entry to list
    addOrUpdateChat({ id: tid, name: `User ${tid}`, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${tid}` });
    setActiveChatId(tid);
    setShowConnectModal(false);
    setTargetPeerId('');
  };

  const handleSendMessage = async (text: string, media?: any) => {
    if (!activeChatId || !myProfile) return;
    const newMessage: Message = { id: `msg-${Date.now()}`, chatId: activeChatId, senderId: myProfile.id, senderName: myProfile.name, senderAvatar: myProfile.avatar, text, timestamp: Date.now(), status: MessageStatus.SENT, media };
    
    setMessages(prev => [...prev, newMessage]);
    dbService.saveMessage(newMessage);
    
    if (activeChatId === 'ai-gemini') {
      setIsGenerating(true);
      const resp = await geminiService.getChatResponse(text);
      const aiMsg: Message = { id: `ai-${Date.now()}`, chatId: 'ai-gemini', senderId: 'ai-gemini', text: resp.text, timestamp: Date.now(), status: MessageStatus.SENT, isAI: true, sources: resp.sources };
      dbService.saveMessage(aiMsg);
      setMessages(dbService.getMessages('ai-gemini'));
      setIsGenerating(false);
    } else {
      const conn = connectionsRef.current[activeChatId];
      if (conn?.open) conn.send({ type: 'message', message: newMessage });
    }
    setChats(dbService.getChats());
  };

  const startCall = async (type: 'audio' | 'video') => {
    if (!activeChatId || !peerRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
      const call = peerRef.current.call(activeChatId, stream, { metadata: { type } });
      setActiveCall({ stream, call, type });
      call.on('stream', (rs) => { if(remoteVideoRef.current) remoteVideoRef.current.srcObject = rs; });
    } catch(e) { alert("Permission denied"); }
  };

  const deleteChat = (e: any, id: string) => {
    e.stopPropagation();
    if (window.confirm("মুছে ফেলতে চান?")) {
      dbService.deleteChat(id);
      setChats(dbService.getChats());
      if (activeChatId === id) setActiveChatId(null);
    }
  };

  if (!isRegistered) return (
    <div className="h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900 rounded-[3rem] p-10 border border-orange-500/10">
        <Zap className="w-16 h-16 text-orange-500 mx-auto mb-8" />
        <form onSubmit={(e: any) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const p: UserProfile = { id: `nest-${Math.random().toString(36).substr(2, 6)}`, name: fd.get('name') as string, phone: fd.get('phone') as string, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${fd.get('name')}`, bio: 'ChatNest-এ স্বাগতম!', status: 'online' };
          localStorage.setItem('chatnest_profile', JSON.stringify(p));
          setMyProfile(p); setIsRegistered(true);
        }} className="space-y-6">
          <input name="name" placeholder="নাম" className="w-full bg-slate-800 p-5 rounded-2xl outline-none border-2 border-transparent focus:border-orange-500 text-white font-bold" required />
          <input name="phone" placeholder="ফোন" className="w-full bg-slate-800 p-5 rounded-2xl outline-none border-2 border-transparent focus:border-orange-500 text-white font-bold" required />
          <button className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black shadow-xl">শুরু করুন</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-jakarta">
      {/* Sidebar */}
      <aside className={`${activeChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col border-r border-slate-800/50 bg-slate-900/50`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-black text-orange-500 flex items-center gap-2"><Zap className="w-5 h-5" /> ChatNest</h1>
            <div className="flex gap-2">
              <button onClick={() => setShowConnectModal(true)} className="p-2.5 bg-orange-500/10 text-orange-500 rounded-xl"><UserPlus2 className="w-5 h-5" /></button>
              <button onClick={() => setShowSettings(true)} className="w-10 h-10 rounded-xl overflow-hidden border border-slate-700"><img src={myProfile?.avatar} className="w-full h-full object-cover" /></button>
            </div>
          </div>
          <div className="space-y-2 overflow-y-auto flex-1 custom-scrollbar">
            {chats.map(chat => (
              <div key={chat.id} onClick={() => { setActiveChatId(chat.id); setMessages(dbService.getMessages(chat.id)); }} className={`group flex items-center gap-4 p-4 cursor-pointer rounded-[2rem] relative ${activeChatId === chat.id ? 'bg-orange-500' : 'hover:bg-slate-800'}`}>
                <img src={chat.avatar} className="w-12 h-12 rounded-2xl" />
                <div className="flex-1 truncate">
                  <h3 className="font-bold text-sm truncate">{chat.name}</h3>
                  <p className="text-xs truncate opacity-50">{chat.lastMessage}</p>
                </div>
                {chat.id !== 'ai-gemini' && (
                  <button onClick={(e) => deleteChat(e, chat.id)} className="opacity-0 group-hover:opacity-100 p-2 hover:text-rose-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`${activeChatId ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col bg-slate-950`}>
        {activeChatId ? (
          <>
            <header className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveChatId(null)} className="md:hidden"><ArrowLeft /></button>
                <img src={chats.find(c => c.id === activeChatId)?.avatar} className="w-10 h-10 rounded-xl" />
                <h2 className="font-black">{chats.find(c => c.id === activeChatId)?.name}</h2>
              </div>
              {activeChatId !== 'ai-gemini' && (
                <div className="flex gap-2">
                  <button onClick={() => startCall('audio')} className="p-2 text-slate-400 hover:text-orange-500"><Phone /></button>
                  <button onClick={() => startCall('video')} className="p-2 text-slate-400 hover:text-orange-500"><VideoIcon /></button>
                </div>
              )}
            </header>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {messages.map(m => <MessageBubble key={m.id} msg={m} isMe={m.senderId === myProfile?.id} onEdit={setEditingMsg} onDelete={(id) => { if(window.confirm("ডিলিট করবেন?")) { dbService.deleteMessage(id); setMessages(prev => prev.filter(x => x.id !== id)); }}} />)}
              {isGenerating && <div className="text-xs font-bold text-orange-500 animate-pulse">Neo is thinking...</div>}
              <div ref={scrollRef} />
            </div>
            <ChatInput onSend={handleSendMessage} editingMsg={editingMsg} cancelEdit={() => setEditingMsg(null)} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
            <Zap className="w-16 h-16 text-orange-500 mb-6" />
            <h2 className="text-4xl font-black mb-4">ChatNest Secure</h2>
            <p className="text-slate-500 mb-8 max-w-xs">Nest ID ব্যবহার করে ফ্রেন্ড অ্যাড করুন এবং এনক্রিপ্টেড চ্যাট শুরু করুন।</p>
            <button onClick={() => setShowConnectModal(true)} className="px-10 py-5 bg-orange-500 text-white rounded-[2rem] font-black shadow-2xl">নতুন চ্যাট শুরু করুন</button>
          </div>
        )}
      </main>

      {/* Modals */}
      {showConnectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowConnectModal(false)}>
          <div className="w-full max-w-md bg-slate-900 rounded-[3rem] p-10 border border-slate-800" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-black mb-6">ফ্রেন্ড অ্যাড করুন</h2>
            <input autoFocus value={targetPeerId} onChange={e => setTargetPeerId(e.target.value)} placeholder="Nest ID এখানে দিন..." className="w-full bg-slate-800 p-5 rounded-2xl font-bold mb-6 text-white outline-none border-2 border-transparent focus:border-orange-500" />
            <button onClick={() => connectToPeer(targetPeerId)} className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black">লিঙ্ক করুন</button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-xl bg-slate-900 rounded-[3rem] overflow-hidden border border-slate-800" onClick={e => e.stopPropagation()}>
            <div className="h-24 bg-orange-500/20" />
            <div className="px-10 pb-10 -mt-12">
              <div className="flex justify-between items-end mb-8">
                <img src={myProfile?.avatar} className="w-24 h-24 rounded-[2rem] border-4 border-slate-900" />
                <button onClick={() => setShowSettings(false)} className="p-2 bg-slate-800 rounded-full"><X /></button>
              </div>
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">Your ID</p>
                  <div className="flex items-center justify-between bg-slate-800 p-4 rounded-2xl">
                    <code className="text-orange-400 font-bold">{myProfile?.id}</code>
                    <button onClick={() => navigator.clipboard.writeText(myProfile?.id || '')}><Copy className="w-4 h-4 text-slate-400" /></button>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">Display Name</p>
                  <input value={myProfile?.name} onChange={(e) => { const n = { ...myProfile!, name: e.target.value }; setMyProfile(n); localStorage.setItem('chatnest_profile', JSON.stringify(n)); }} className="w-full bg-slate-800 p-4 rounded-2xl font-bold text-white outline-none" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">Bio</p>
                  <textarea value={myProfile?.bio} onChange={(e) => { const n = { ...myProfile!, bio: e.target.value }; setMyProfile(n); localStorage.setItem('chatnest_profile', JSON.stringify(n)); }} className="w-full bg-slate-800 p-4 rounded-2xl font-medium text-white outline-none h-24" />
                </div>
                <button onClick={() => { setShowAdmin(true); setShowSettings(false); }} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black">Open Admin Console</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAdmin && <AdminPanel chats={chats} onClose={() => setShowAdmin(false)} onDeleteChat={deleteChat} messagesCount={0} />}
      
      {incomingCall && (
        <div className="fixed inset-0 z-[200] bg-slate-950/95 flex flex-col items-center justify-center backdrop-blur-xl">
          <h2 className="text-2xl font-black mb-8">Incoming Call...</h2>
          <div className="flex gap-10">
            <button onClick={() => setIncomingCall(null)} className="w-20 h-20 bg-rose-500 rounded-full flex items-center justify-center"><PhoneOff /></button>
            <button onClick={async () => {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
              incomingCall.call.answer(stream);
              setActiveCall({ stream, call: incomingCall.call, type: 'video' });
              setIncomingCall(null);
            }} className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center"><Phone /></button>
          </div>
        </div>
      )}
    </div>
  );
}
