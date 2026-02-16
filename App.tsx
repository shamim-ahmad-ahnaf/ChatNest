
import React, { useState, useEffect, useRef } from 'react';
import { Peer, DataConnection } from "peerjs";
import { Message, ChatSession, MessageStatus, UserProfile } from './types';
import { dbService } from './services/dbService';
import { geminiService } from './services/geminiService';
import { 
    Search, MoreVertical, Phone, Video, Send, ArrowLeft,
    CheckCheck, MessageSquare, Bot, Users, X, Camera, PhoneOff,
    Zap, Plus, Edit3, Settings2, Moon, Sun, ExternalLink,
    PlusCircle, UserPlus, UserPlus2, Wifi, WifiOff, Copy, Check,
    Users2, Headphones, Share2, QrCode
} from 'lucide-react';

const THEME_COLORS = [
    { name: 'orange', class: 'orange-500', hex: '#f97316' },
];

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
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [targetPeerId, setTargetPeerId] = useState('');
  const [copyStatus, setCopyStatus] = useState(false);
  
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<{ [key: string]: DataConnection }>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find(c => c.id === activeChatId);
  const currentTheme = THEME_COLORS[0];

  // Initialize P2P Peer
  useEffect(() => {
    if (isRegistered && myProfile) {
      const peer = new Peer(myProfile.id);
      peerRef.current = peer;

      peer.on('connection', (conn) => {
        conn.on('data', (data: any) => {
          if (data.type === 'message') {
            const receivedMsg = data.message as Message;
            handleReceivedMessage(receivedMsg, conn.peer);
          }
        });
        connectionsRef.current[conn.peer] = conn;
      });

      return () => {
        peer.destroy();
      };
    }
  }, [isRegistered, myProfile]);

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
  }, [messages, isTyping]);

  const handleReceivedMessage = (msg: Message, peerId: string) => {
    dbService.saveMessage(msg);
    // Refresh chats to show last message
    setChats(dbService.getChats());
    // If active chat is this peer, update messages
    setActiveChatId(current => {
        if (current === peerId || msg.chatId === current) {
            setMessages(prev => [...prev, msg]);
        }
        return current;
    });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const name = (e.currentTarget.elements.namedItem('name') as HTMLInputElement).value;
    const phone = (e.currentTarget.elements.namedItem('phone') as HTMLInputElement).value;
    // For P2P, ID must be clean strings. Phone numbers work well.
    const cleanId = phone.replace(/\s+/g, '').replace(/[^0-9]/g, '');
    const newProfile: UserProfile = {
        id: `nest-${cleanId}`,
        name, phone,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
        bio: 'Just landed in the Nest!', status: 'online'
    };
    setMyProfile(newProfile);
    localStorage.setItem('chatnest_profile', JSON.stringify(newProfile));
    setIsRegistered(true);
  };

  const connectToPeer = (id: string) => {
    if (!peerRef.current || id === myProfile?.id) return;
    const conn = peerRef.current.connect(id);
    conn.on('open', () => {
        connectionsRef.current[id] = conn;
        // Create chat session if not exists
        const existing = chats.find(c => c.id === id);
        if (!existing) {
            const newChat: ChatSession = {
                id, name: `Friend (${id.replace('nest-','')})`,
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
                phone: id, isOnline: true, type: 'contact', unreadCount: 0,
                lastMessage: 'Nest link established'
            };
            const updated = [newChat, ...chats];
            setChats(updated);
            dbService.saveChats(updated);
        }
        setActiveChatId(id);
        setShowConnectModal(false);
        setTargetPeerId('');
    });
    conn.on('data', (data: any) => {
        if (data.type === 'message') handleReceivedMessage(data.message, id);
    });
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !activeChatId || !myProfile) return;
    
    const newMessage: Message = {
      id: `msg-${Date.now()}`, chatId: activeChatId, senderId: myProfile.id,
      senderName: myProfile.name, senderAvatar: myProfile.avatar, text,
      timestamp: Date.now(), status: MessageStatus.SENT
    };

    // Save locally
    setMessages(prev => [...prev, newMessage]);
    dbService.saveMessage(newMessage);
    setInputText('');

    // Send via P2P if connection exists
    const conn = connectionsRef.current[activeChatId];
    if (conn && conn.open) {
        conn.send({ type: 'message', message: newMessage });
    } else if (activeChatId !== 'ai-gemini') {
        // Try to re-establish
        const newConn = peerRef.current?.connect(activeChatId);
        newConn?.on('open', () => {
            connectionsRef.current[activeChatId] = newConn;
            newConn.send({ type: 'message', message: newMessage });
        });
    }

    // AI logic fallback
    if (activeChatId === 'ai-gemini') {
      setIsTyping(true);
      const history = messages.slice(-5).map(m => ({ role: m.senderId === 'ai-gemini' ? 'model' : 'user', text: m.text }));
      const { text: aiText, sources } = await geminiService.getChatResponse(text, history);
      const aiMessage: Message = {
        id: `ai-${Date.now()}`, chatId: activeChatId, senderId: 'ai-gemini',
        text: aiText, timestamp: Date.now(), status: MessageStatus.DELIVERED, isAI: true, sources
      };
      setMessages(prev => [...prev, aiMessage]);
      dbService.saveMessage(aiMessage);
      setIsTyping(false);
    }
    
    setChats(dbService.getChats());
  };

  const copyId = () => {
    if (myProfile) {
        navigator.clipboard.writeText(myProfile.id);
        setCopyStatus(true);
        setTimeout(() => setCopyStatus(false), 2000);
    }
  };

  if (!isRegistered) {
    return (
        <div className="h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95">
                <div className="w-20 h-20 bg-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-8"><Zap className="w-10 h-10 text-white" /></div>
                <h1 className="text-3xl font-black text-center mb-2">Welcome to Nest</h1>
                <p className="text-slate-400 text-center mb-8 font-medium">Create your profile and start chatting with friends directly.</p>
                <form onSubmit={handleRegister} className="space-y-6">
                    <input name="name" type="text" placeholder="Full Name" className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border border-transparent focus:border-orange-500 font-bold" required />
                    <input name="phone" type="tel" placeholder="Phone Number (used as ID)" className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border border-transparent focus:border-orange-500 font-bold" required />
                    <button type="submit" className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black text-lg shadow-xl hover:scale-105 transition-all">Create My Nest</button>
                </form>
            </div>
        </div>
    );
  }

  return (
    <div className="flex h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-jakarta">
      {/* Sidebar */}
      <aside className={`${activeChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col border-r border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-black text-orange-500">ChatNest</h1>
            <div className="flex gap-2">
                <button onClick={() => setShowConnectModal(true)} className="p-2.5 bg-orange-500/10 text-orange-500 rounded-xl hover:scale-105 transition-all"><UserPlus2 className="w-5 h-5" /></button>
                <button onClick={() => setShowSettings(true)} className="w-10 h-10 rounded-xl overflow-hidden shadow-sm"><img src={myProfile?.avatar} className="w-full h-full object-cover" /></button>
            </div>
          </div>

          <div className="bg-orange-500/5 dark:bg-orange-500/10 p-4 rounded-2xl border border-orange-500/20 mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">My Nest ID (Share this)</p>
              <div className="flex items-center justify-between">
                <code className="text-xs font-bold text-orange-500 truncate mr-2">{myProfile?.id}</code>
                <button onClick={copyId} className="p-1.5 hover:bg-orange-500/10 rounded-lg transition-colors">
                    {copyStatus ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-orange-500" />}
                </button>
              </div>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search chats..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white dark:bg-slate-800 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none shadow-sm" />
          </div>
          
          <div className="space-y-1 overflow-y-auto">
            {chats.map(chat => (
                <div key={chat.id} onClick={() => setActiveChatId(chat.id)} className={`flex items-center gap-4 p-4 cursor-pointer rounded-3xl transition-all ${activeChatId === chat.id ? 'bg-white dark:bg-slate-800 shadow-md scale-[1.02]' : 'hover:bg-white/50'}`}>
                    <div className="relative">
                        <img src={chat.avatar} className="w-12 h-12 rounded-xl object-cover" />
                        {chat.type === 'ai' && <div className="absolute -bottom-1 -right-1 bg-violet-500 p-0.5 rounded-lg border-2 border-white dark:border-slate-900"><Bot className="w-2.5 h-2.5 text-white" /></div>}
                    </div>
                    <div className="flex-1 truncate">
                        <div className="flex justify-between items-center"><h3 className="font-bold text-sm truncate">{chat.name}</h3></div>
                        <p className="text-xs opacity-50 truncate">{chat.lastMessage}</p>
                    </div>
                </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main View */}
      <main className={`${activeChatId ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col h-full relative`}>
        {activeChat ? (
          <>
            <header className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-40">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveChatId(null)} className="md:hidden p-2 text-slate-400"><ArrowLeft /></button>
                <img src={activeChat.avatar} className="w-10 h-10 rounded-xl object-cover" />
                <div>
                    <h2 className="font-bold">{activeChat.name}</h2>
                    <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        {activeChat.type === 'ai' ? 'Neural Link' : 'Secure P2P Linked'}
                    </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-3 text-slate-400 hover:text-orange-500 transition-colors"><Phone className="w-5 h-5" /></button>
                <button className="p-3 text-slate-400 hover:text-orange-500 transition-colors"><Video className="w-5 h-5" /></button>
                <button className="p-3 text-slate-400"><MoreVertical /></button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.senderId === myProfile?.id ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${msg.senderId === myProfile?.id ? 'bg-orange-500 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-800 rounded-tl-none'}`}>
                      <p className="text-sm font-medium whitespace-pre-wrap">{msg.text}</p>
                      <div className="flex justify-end gap-1 mt-1 opacity-50 text-[9px] font-bold">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {msg.senderId === myProfile?.id && <CheckCheck className="w-3 h-3" />}
                      </div>
                    </div>
                </div>
              ))}
              {isTyping && <div className="flex justify-start"><div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl animate-pulse text-xs font-bold italic">Thinking...</div></div>}
              <div ref={scrollRef} />
            </div>

            <footer className="p-6">
              <div className="max-w-4xl mx-auto flex items-end gap-3 p-2 bg-slate-50 dark:bg-slate-900 rounded-[2rem] border border-slate-200/50 dark:border-slate-800 shadow-sm">
                <button className="p-3 text-slate-400 hover:text-orange-500 transition-colors"><Plus className="w-6 h-6" /></button>
                <textarea rows={1} value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage(inputText))} placeholder="Type a message..." className="flex-1 bg-transparent py-3 outline-none text-sm font-medium resize-none min-h-[48px]" />
                <button onClick={() => handleSendMessage(inputText)} className="p-3 bg-orange-500 text-white rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all"><Send className="w-6 h-6" /></button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 animate-in fade-in slide-in-from-bottom-4">
            <div className="w-24 h-24 bg-orange-500/10 rounded-[2.5rem] flex items-center justify-center mb-8"><Zap className="w-12 h-12 text-orange-500" /></div>
            <h2 className="text-4xl font-black mb-4">Start a Conversation</h2>
            <p className="opacity-50 text-sm max-w-sm font-medium leading-relaxed">
                Connect with friends directly via their Nest ID. No server, no data storage, just pure peer-to-peer chatting.
            </p>
            <button onClick={() => setShowConnectModal(true)} className="mt-8 flex items-center gap-2 bg-orange-500 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-orange-500/20 hover:scale-105 active:scale-95 transition-all">
                <UserPlus className="w-5 h-5" /> Connect to a Friend
            </button>
          </div>
        )}
      </main>

      {/* Modal: Connect to Peer */}
      {showConnectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md" onClick={() => setShowConnectModal(false)}>
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-8 shadow-2xl relative animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowConnectModal(false)} className="absolute top-6 right-6 text-slate-400 p-2 hover:bg-slate-100 rounded-full"><X /></button>
                <h2 className="text-2xl font-black mb-6 flex items-center gap-3"><div className="p-3 bg-orange-500/10 rounded-2xl"><UserPlus2 className="w-6 h-6 text-orange-500" /></div>Link to Nest</h2>
                <div className="space-y-4">
                    <p className="text-xs font-medium opacity-60">Enter your friend's unique Nest ID to start a secure direct connection.</p>
                    <input autoFocus value={targetPeerId} onChange={e => setTargetPeerId(e.target.value)} type="text" placeholder="nest-xxxxxxxxxx" className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border border-transparent focus:border-orange-500 font-bold" />
                    <button onClick={() => connectToPeer(targetPeerId)} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black text-lg shadow-xl hover:scale-[1.02] active:scale-95 transition-all">Connect Now</button>
                </div>
            </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md" onClick={() => setShowSettings(false)}>
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowSettings(false)} className="absolute top-8 right-8 text-slate-400 p-2 hover:bg-slate-100 rounded-full"><X /></button>
                <h2 className="text-3xl font-black mb-8">Settings</h2>
                <div className="flex flex-col items-center gap-6">
                    <img src={myProfile?.avatar} className="w-24 h-24 rounded-[2rem] border-4 border-orange-500/10" />
                    <div className="text-center">
                        <h3 className="text-xl font-bold">{myProfile?.name}</h3>
                        <p className="text-sm opacity-50">{myProfile?.phone}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 w-full">
                        <button onClick={() => setIsDarkMode(!isDarkMode)} className="py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold flex items-center justify-center gap-2">
                            {isDarkMode ? <Sun /> : <Moon />} {isDarkMode ? 'Light' : 'Dark'}
                        </button>
                        <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="py-4 bg-rose-50 text-rose-500 rounded-2xl font-bold">Sign Out</button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
