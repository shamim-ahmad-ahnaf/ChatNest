
import React, { useState, useEffect, useRef } from 'react';
import { Message, ChatSession, MessageStatus, UserProfile } from './types';
import { dbService } from './services/dbService';
import { geminiService } from './services/geminiService';
import { apiService } from './services/apiService';
import { 
    Search, MoreVertical, Phone, Video, Paperclip, Smile, Send, ArrowLeft,
    CheckCheck, MessageSquare, Bot, Users, Sparkles,
    X, Camera, PhoneOff, MicOff, Mic, Trash2, 
    Zap, VideoOff, Plus, Edit3, CameraIcon, Image as ImageIcon,
    Info, LogOut as LeaveIcon, ShieldCheck, UserMinus, Settings2,
    Clock, SearchIcon, Moon, Sun, Layout, FileText, Loader2, ExternalLink,
    PlusCircle, Maximize2, Volume2, VolumeX, Mic2, Upload, UserPlus, UserSearch,
    UserPlus2, Wifi, WifiOff, Terminal, HelpCircle, Code2, Copy, Check, Download, Github
} from 'lucide-react';

const THEME_COLORS = [
    { name: 'orange', class: 'orange-500', hex: '#f97316' },
    { name: 'blue', class: 'blue-500', hex: '#3b82f6' },
    { name: 'violet', class: 'violet-500', hex: '#8b5cf6' },
    { name: 'emerald', class: 'emerald-500', hex: '#10b981' }
];

export default function App() {
  const [isRegistered, setIsRegistered] = useState(() => !!localStorage.getItem('chatnest_profile'));
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  
  const [myProfile, setMyProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('chatnest_profile');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('chatnest_dark') === 'true');
  const [themeColor, setThemeColor] = useState(() => localStorage.getItem('chatnest_theme') || 'orange');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSession[]>(dbService.getChats());
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts'>('chats');
  const [showSettings, setShowSettings] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [globalUsers, setGlobalUsers] = useState<UserProfile[]>([]);
  const [isServerConnected, setIsServerConnected] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const localFiltered = chats.filter(chat => 
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    chat.phone.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const globalFiltered = globalUsers.filter(user => 
    user.id !== myProfile?.id && 
    !chats.some(c => c.id === user.id) &&
    (user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     user.phone.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const activeChat = chats.find(c => c.id === activeChatId);
  const currentTheme = THEME_COLORS.find(t => t.name === themeColor) || THEME_COLORS[0];

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

  useEffect(() => {
    if (isRegistered && myProfile) {
      apiService.connect(
        (data) => {
          if (data.type === 'presence_update') {
            setGlobalUsers(data.users);
          } else if (data.type === 'signal') {
            // Signaling logic...
          } else if (data.type === 'new_message') {
            if (data.message.chatId === activeChatId || data.message.senderId === activeChatId) {
              setMessages(prev => [...prev, data.message]);
            }
            setChats(dbService.getChats());
          }
        },
        (status) => {
            setIsServerConnected(status);
            if (status) {
                apiService.sendMessage({ type: 'join', profile: myProfile });
            }
        }
      );
    }
  }, [isRegistered, myProfile, activeChatId]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(id);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regPhone.trim()) return;
    const newProfile: UserProfile = {
        id: 'user-' + Math.random().toString(36).substr(2, 9),
        name: regName, phone: regPhone,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${regName}-${Date.now()}`,
        bio: 'Fresh in the Nest!', status: 'online'
    };
    setMyProfile(newProfile);
    localStorage.setItem('chatnest_profile', JSON.stringify(newProfile));
    setIsRegistered(true);
  };

  const startNewChat = (user: UserProfile) => {
    const existingChat = chats.find(c => c.id === user.id);
    if (existingChat) {
        setActiveChatId(user.id);
    } else {
        const newChat: ChatSession = {
            id: user.id, name: user.name, avatar: user.avatar, phone: user.phone,
            isOnline: true, type: 'contact', unreadCount: 0, lastMessage: 'Started a new conversation'
        };
        const updatedChats = [newChat, ...chats];
        setChats(updatedChats);
        dbService.saveChats(updatedChats);
        setActiveChatId(user.id);
    }
    setSearchQuery('');
  };

  const handleAddManualContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualPhone.trim()) return;
    const manualUser: UserProfile = {
        id: 'manual-' + Math.random().toString(36).substr(2, 9),
        name: manualName, phone: manualPhone,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${manualName}`,
        bio: 'Manually added nestling', status: 'offline'
    };
    startNewChat(manualUser);
    setShowManualAdd(false);
    setManualName(''); setManualPhone('');
  };

  const handleSendMessage = async (text: string, media?: Message['media']) => {
    if ((!text.trim() && !media) || !activeChatId || !myProfile) return;
    const newMessage: Message = {
      id: `${myProfile.id}-${Date.now()}`, chatId: activeChatId, senderId: myProfile.id,
      senderName: myProfile.name, senderAvatar: myProfile.avatar, text: text,
      timestamp: Date.now(), status: MessageStatus.SENT, media
    };
    setMessages(prev => [...prev, newMessage]);
    dbService.saveMessage(newMessage);
    apiService.sendMessage({ type: 'chat_broadcast', message: newMessage });
    setInputText('');

    if (activeChat?.type === 'ai' && !media) {
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
  };

  // Fix: Implemented handleMediaFileSelect to allow users to send images, videos, or files in chat
  const handleMediaFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChatId) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const type = file.type.split('/')[0];
      const mediaType: 'image' | 'video' | 'audio' | 'file' = 
        ['image', 'video', 'audio'].includes(type) ? (type as any) : 'file';
      
      handleSendMessage('', {
        type: mediaType,
        url: base64,
        mimeType: file.type,
        fileName: file.name
      });
    };
    reader.readAsDataURL(file);
    // Clear the input value to allow selecting the same file again if needed
    e.target.value = '';
  };

  // Fix: Implemented handleAvatarChange to allow users to update their profile picture
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !myProfile) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const updatedProfile = { ...myProfile, avatar: base64 };
      setMyProfile(updatedProfile);
      localStorage.setItem('chatnest_profile', JSON.stringify(updatedProfile));
      
      // Update the profile on the server if connected
      if (isServerConnected) {
        apiService.sendMessage({ type: 'join', profile: updatedProfile });
      }
    };
    reader.readAsDataURL(file);
  };

  if (!isRegistered) {
    return (
        <div className="h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95">
                <div className="w-20 h-20 bg-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg"><Zap className="w-10 h-10 text-white" /></div>
                <h1 className="text-3xl font-black text-center mb-2">Welcome to Nest</h1>
                <p className="text-slate-400 text-center mb-8 font-medium">Register your profile to start nesting.</p>
                <form onSubmit={handleRegister} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest opacity-40 ml-1">Full Name</label>
                        <input value={regName} onChange={e => setRegName(e.target.value)} type="text" placeholder="e.g. Neo Smith" className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none focus:ring-2 ring-orange-500/20 font-bold" required />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest opacity-40 ml-1">Phone Number</label>
                        <input value={regPhone} onChange={e => setRegPhone(e.target.value)} type="tel" placeholder="+880 1XXX XXXXXX" className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none focus:ring-2 ring-orange-500/20 font-bold" required />
                    </div>
                    <button type="submit" className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all">Create My Nest</button>
                </form>
            </div>
        </div>
    );
  }

  return (
    <div className={`flex h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-jakarta selection:bg-${currentTheme.class}/20`}>
      {/* Navigation */}
      <nav className="hidden md:flex w-20 flex-col items-center py-8 gap-8 border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-50">
        <div onClick={() => setActiveChatId(null)} className={`w-12 h-12 bg-${currentTheme.class} rounded-2xl flex items-center justify-center cursor-pointer hover:rotate-12 transition-all shadow-lg`}><Zap className="w-6 h-6 text-white" /></div>
        <div className="flex flex-col gap-6 flex-1">
          <button onClick={() => setActiveTab('chats')} className={`p-3.5 rounded-xl transition-all ${activeTab === 'chats' ? `bg-${currentTheme.class}/10 text-${currentTheme.class}` : 'text-slate-400'}`}><MessageSquare /></button>
          <button onClick={() => setActiveTab('contacts')} className={`p-3.5 rounded-xl transition-all ${activeTab === 'contacts' ? `bg-${currentTheme.class}/10 text-${currentTheme.class}` : 'text-slate-400'}`}><Users /></button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3.5 rounded-xl text-slate-400 hover:text-yellow-500">{isDarkMode ? <Sun /> : <Moon />}</button>
        </div>
        <button onClick={() => setShowSettings(true)} className="p-1"><img src={myProfile?.avatar} className="w-10 h-10 rounded-xl object-cover" alt="" /></button>
      </nav>

      {/* Sidebar */}
      <aside className={`${activeChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col border-r border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50`}>
        <div className="p-6 pb-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
                <h1 className="text-2xl font-black">ChatNest</h1>
                <button onClick={() => setShowSetupGuide(true)} className="flex items-center gap-1.5 mt-1 hover:opacity-80 transition-opacity">
                    <div className={`w-1.5 h-1.5 rounded-full ${isServerConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-400'}`} />
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-50">{isServerConnected ? 'Live Server' : 'Local Mode'}</span>
                    <HelpCircle className="w-2.5 h-2.5 opacity-30" />
                </button>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => setShowManualAdd(true)} className={`w-10 h-10 rounded-xl bg-${currentTheme.class}/10 text-${currentTheme.class} flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-sm`}><UserPlus2 className="w-5 h-5" /></button>
                <button onClick={() => setShowSettings(true)} className="md:hidden w-10 h-10 rounded-xl overflow-hidden shadow-sm border border-white dark:border-slate-800"><img src={myProfile?.avatar} className="w-full h-full object-cover" alt="" /></button>
            </div>
          </div>
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search by name or number..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white dark:bg-slate-800 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none shadow-sm focus:ring-2 ring-orange-500/10" />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-4 mb-2 block">{searchQuery ? 'Matches in Chats' : 'Recent Chats'}</label>
            {localFiltered.length > 0 ? localFiltered.map(chat => (
                <div key={chat.id} onClick={() => setActiveChatId(chat.id)} className={`flex items-center gap-4 p-4 cursor-pointer rounded-3xl transition-all ${activeChatId === chat.id ? 'bg-white dark:bg-slate-800 shadow-md' : 'hover:bg-white/50 dark:hover:bg-slate-800/20'}`}>
                    <img src={chat.avatar} className="w-14 h-14 rounded-2xl object-cover" alt="" />
                    <div className="flex-1 truncate">
                        <div className="flex justify-between items-center"><h3 className="font-bold text-sm">{chat.name}</h3><span className="text-[10px] opacity-40 font-bold">{chat.lastTimestamp ? new Date(chat.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span></div>
                        <p className="text-xs opacity-50 truncate">{chat.lastMessage || chat.phone}</p>
                    </div>
                </div>
            )) : searchQuery && <p className="text-[11px] text-center py-2 opacity-30 italic">No existing chats match your search</p>}
          </div>

          {searchQuery.trim() !== "" && (
            <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between px-4 mb-3"><label className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">Discover New People</label><UserSearch className="w-3 h-3 text-orange-500 opacity-50" /></div>
                {globalFiltered.map(user => (
                    <div key={user.id} onClick={() => startNewChat(user)} className="group flex items-center gap-4 p-4 cursor-pointer rounded-3xl bg-orange-500/5 border border-orange-500/10 hover:bg-orange-500/10 transition-all">
                        <div className="relative"><img src={user.avatar} className="w-12 h-12 rounded-xl object-cover" alt="" /><div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" /></div>
                        <div className="flex-1 truncate"><h3 className="font-bold text-sm">{user.name}</h3><p className="text-[10px] opacity-50 font-bold uppercase tracking-widest">{user.phone}</p></div>
                        <div className="bg-orange-500 text-white p-2 rounded-xl shadow-lg"><UserPlus className="w-4 h-4" /></div>
                    </div>
                ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main View */}
      <main className={`${activeChatId ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col h-full bg-white dark:bg-slate-950 relative`}>
        {activeChat ? (
          <>
            <header className="px-4 py-3 md:px-6 md:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between glass-morphism z-40 sticky top-0">
              <div className="flex items-center gap-2 md:gap-4">
                <button onClick={() => setActiveChatId(null)} className="md:hidden p-2 -ml-2 text-slate-400"><ArrowLeft className="w-6 h-6" /></button>
                <div className="flex items-center gap-3"><img src={activeChat.avatar} className="w-9 h-9 md:w-10 md:h-10 rounded-xl object-cover" alt="" /><div><h2 className="font-bold text-sm md:text-base">{activeChat.name}</h2><p className="text-[9px] md:text-[10px] opacity-50 font-bold uppercase tracking-widest">{isTyping ? 'Thinking...' : 'Active Now'}</p></div></div>
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                <button className={`p-2 rounded-xl text-slate-400 hover:text-${currentTheme.class} hover:bg-${currentTheme.class}/10 transition-all`}><Phone className="w-5 h-5" /></button>
                <button className={`p-2 rounded-xl text-slate-400 hover:text-${currentTheme.class} hover:bg-${currentTheme.class}/10 transition-all`}><Video className="w-5 h-5" /></button>
                <button className="p-2 text-slate-400"><MoreVertical className="w-5 h-5" /></button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
              {!isServerConnected && activeChat.id !== 'ai-gemini' && !activeChat.id.startsWith('manual-') && (
                  <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl text-[12px] font-bold text-amber-600 dark:text-amber-500">
                      <WifiOff className="w-4 h-4 flex-shrink-0" /><div>Server disconnected. <button onClick={() => setShowSetupGuide(true)} className="underline ml-1">Check Setup Guide</button></div>
                  </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.senderId === myProfile?.id ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] md:max-w-lg p-4 rounded-2xl shadow-sm ${msg.senderId === myProfile?.id ? `bg-${currentTheme.class} text-white rounded-tr-none` : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none'}`}>
                      <p className="text-[14px] font-medium leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-current/20 opacity-80">
                          <p className="text-[9px] font-black uppercase mb-1 tracking-widest">Sources</p>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((src: any, i: number) => (
                              <a key={i} href={src.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-black/10 dark:bg-white/10 p-1.5 px-2.5 rounded-xl hover:scale-105 transition-all text-[10px] font-bold">
                                <ExternalLink className="w-3 h-3" /><span className="truncate max-w-[120px]">{src.title || 'Visit Site'}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-end gap-1 mt-1 opacity-50 text-[9px] font-bold">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{msg.senderId === myProfile?.id && <CheckCheck className="w-3 h-3" />}</div>
                    </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>

            <footer className="p-4 md:p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
              <div className="max-w-4xl mx-auto flex items-end gap-2 md:gap-3 p-1.5 bg-slate-50 dark:bg-slate-900 rounded-[2rem] border border-slate-200/50 dark:border-slate-800">
                <button onClick={() => mediaInputRef.current?.click()} className={`p-3 rounded-full text-slate-400 hover:text-${currentTheme.class}`}><Plus className="w-6 h-6" /></button>
                <input type="file" ref={mediaInputRef} onChange={handleMediaFileSelect} className="hidden" />
                <textarea rows={1} value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage(inputText))} placeholder="Hatch a message..." className="flex-1 bg-transparent py-3 px-1 outline-none text-sm font-medium resize-none min-h-[44px]" />
                <button onClick={() => handleSendMessage(inputText)} className={`p-3 bg-${currentTheme.class} text-white rounded-full shadow-xl`}><Send className="w-6 h-6" /></button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-10">
            <div className={`w-24 h-24 md:w-32 md:h-32 bg-${currentTheme.class}/10 rounded-[3rem] flex items-center justify-center mb-10 shadow-2xl`}><Zap className={`w-16 h-16 text-${currentTheme.class}`} /></div>
            <h2 className="text-3xl md:text-4xl font-black mb-4">Welcome to ChatNest</h2>
            <p className="max-w-md opacity-50 font-medium text-sm">Add contacts manually or search for online nestlings. Your messages are private and secure.</p>
          </div>
        )}

        {/* Modal: Server Setup Guide */}
        {showSetupGuide && (
            <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md" onClick={() => setShowSetupGuide(false)}>
                <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl relative animate-in slide-in-from-bottom-4 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowSetupGuide(false)} className="absolute top-6 right-6 text-slate-400 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"><X /></button>
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center"><Terminal className="w-6 h-6" /></div>
                        <div><h2 className="text-xl font-black">Local Server Setup</h2><p className="text-xs opacity-50 font-bold uppercase tracking-widest">Connect your computer to Nest</p></div>
                    </div>

                    <div className="space-y-6">
                        {/* New Step 0 */}
                        <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <p className="text-sm font-black flex items-center gap-2 text-blue-500"><Github className="w-4 h-4" /> Step 0: Get the Files</p>
                            <p className="text-xs opacity-70 leading-relaxed font-medium">
                                আপনার কম্পিউটারে যদি ফাইলগুলো না থাকে, তবে GitHub-এ গিয়ে <span className="font-bold text-emerald-500">"Code > Download ZIP"</span> বাটনে ক্লিক করে প্রজেক্টটি ডাউনলোড করে নিন এবং unzip করুন।
                            </p>
                        </div>

                        {[
                          { id: 'step1', label: '1. Install Dependencies', cmd: 'pip install -r requirements.txt', icon: <Code2 className="w-4 h-4 text-orange-500" /> },
                          { id: 'step2', label: '2. Set API Key (Terminal)', cmd: 'set API_KEY=your_key_here', icon: <Bot className="w-4 h-4 text-orange-500" />, sub: "* Use 'export' instead of 'set' on Mac/Linux" },
                          { id: 'step3', label: '3. Launch Engine', cmd: 'uvicorn main:app --reload --port 8000', icon: <Zap className="w-4 h-4 text-orange-500" /> }
                        ].map((step) => (
                          <div key={step.id} className="space-y-3">
                              <p className="text-sm font-bold flex items-center gap-2">{step.icon} {step.label}</p>
                              <div className="relative group">
                                <div className="bg-slate-900 text-slate-300 p-4 pr-12 rounded-xl font-mono text-xs overflow-x-auto whitespace-nowrap">{step.cmd}</div>
                                <button onClick={() => copyToClipboard(step.cmd, step.id)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all">
                                  {copyStatus === step.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                </button>
                              </div>
                              {step.sub && <p className="text-[10px] opacity-40 italic font-medium">{step.sub}</p>}
                          </div>
                        ))}

                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">একবার সার্ভার চালু হলে স্ট্যাটাস অটোমেটিক "Live Server" হয়ে যাবে।</p>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Other Modals (Manual Add & Settings) */}
        {showManualAdd && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md" onClick={() => setShowManualAdd(false)}>
                <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-8 shadow-2xl relative animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowManualAdd(false)} className="absolute top-6 right-6 text-slate-400 p-2"><X /></button>
                    <h2 className="text-2xl font-black mb-6 flex items-center gap-3"><div className={`p-3 bg-${currentTheme.class}/10 rounded-2xl`}><UserPlus2 className={`w-6 h-6 text-${currentTheme.class}`} /></div>Add Nestling</h2>
                    <form onSubmit={handleAddManualContact} className="space-y-4">
                        <div className="space-y-1"><label className="text-[10px] font-black uppercase opacity-40 ml-1">Full Name</label><input value={manualName} onChange={e => setManualName(e.target.value)} type="text" placeholder="e.g. John Doe" className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none font-bold" required /></div>
                        <div className="space-y-1"><label className="text-[10px] font-black uppercase opacity-40 ml-1">Phone Number</label><input value={manualPhone} onChange={e => setManualPhone(e.target.value)} type="tel" placeholder="+880 1XXX XXXXXX" className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none font-bold" required /></div>
                        <button type="submit" className={`w-full py-4 mt-4 bg-${currentTheme.class} text-white rounded-2xl font-black text-lg shadow-xl`}>Add to Nest</button>
                    </form>
                </div>
            </div>
        )}

        {showSettings && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md" onClick={() => setShowSettings(false)}>
                <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowSettings(false)} className="absolute top-8 right-8 text-slate-400 p-2"><X /></button>
                    <h2 className="text-3xl font-black mb-8">Profile Settings</h2>
                    <div className="space-y-8 flex flex-col items-center">
                        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <img src={myProfile?.avatar} className="w-32 h-32 rounded-[2rem] object-cover border-4 border-orange-500/20" alt="" />
                            <div className="absolute inset-0 bg-black/40 rounded-[2rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="text-white" /></div>
                            <input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
                        </div>
                        <div className="text-center"><h3 className="text-xl font-black">{myProfile?.name}</h3><p className="text-sm opacity-50 font-bold uppercase tracking-widest">{myProfile?.phone}</p></div>
                        <div className="grid grid-cols-2 gap-4 w-full">
                            <button onClick={() => setIsDarkMode(!isDarkMode)} className="py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold flex items-center justify-center gap-3">{isDarkMode ? <Sun /> : <Moon />} {isDarkMode ? 'Light' : 'Dark'}</button>
                            <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="py-4 bg-rose-50 text-rose-500 dark:bg-rose-500/10 rounded-2xl font-bold">Sign Out</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}
