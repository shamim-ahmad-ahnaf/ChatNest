
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
    PlusCircle, Maximize2, Volume2, VolumeX, Mic2, Upload, UserPlus
} from 'lucide-react';

const THEME_COLORS = [
    { name: 'orange', class: 'orange-500', hex: '#f97316' },
    { name: 'blue', class: 'blue-500', hex: '#3b82f6' },
    { name: 'violet', class: 'violet-500', hex: '#8b5cf6' },
    { name: 'emerald', class: 'emerald-500', hex: '#10b981' }
];

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '✨'];

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
  const [searchQuery, setSearchQuery] = useState('');
  const [globalUsers, setGlobalUsers] = useState<UserProfile[]>([]);
  
  const [hasApiKey, setHasApiKey] = useState(true);
  const [activeReactionPickerId, setActiveReactionPickerId] = useState<string | null>(null);

  // Calling State
  const [isCallActive, setIsCallActive] = useState(false);
  const [callType, setCallType] = useState<'audio' | 'video'>('video');
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'connected' | 'incoming'>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [incomingSignal, setIncomingSignal] = useState<{ from: string; data: any } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const activeChat = chats.find(c => c.id === activeChatId);
  const currentTheme = THEME_COLORS.find(t => t.name === themeColor) || THEME_COLORS[0];

  // Filtering local chats + discovery of global users
  const localFiltered = chats.filter(chat => 
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    chat.phone.includes(searchQuery)
  );

  const globalFiltered = globalUsers.filter(user => 
    user.id !== myProfile?.id &&
    !chats.some(c => c.id === user.id) &&
    (user.name.toLowerCase().includes(searchQuery.toLowerCase()) || user.phone.includes(searchQuery))
  );

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
            handleIncomingSignal(data);
          } else if (data.type === 'new_message') {
            if (data.message.chatId === activeChatId || data.message.senderId === activeChatId) {
              setMessages(prev => [...prev, data.message]);
            }
            setChats(dbService.getChats());
          }
        },
        (status) => {
            if (status) {
                apiService.sendMessage({ type: 'join', profile: myProfile });
            }
        }
      );
    }
  }, [isRegistered, myProfile, activeChatId]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regPhone.trim()) return;
    
    const newProfile: UserProfile = {
        id: 'user-' + Math.random().toString(36).substr(2, 9),
        name: regName,
        phone: regPhone,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${regName}-${Date.now()}`,
        bio: 'Fresh in the Nest!',
        status: 'online'
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
            id: user.id,
            name: user.name,
            avatar: user.avatar,
            phone: user.phone,
            isOnline: true,
            type: 'contact',
            unreadCount: 0,
            lastMessage: 'Started a new conversation'
        };
        const updatedChats = [newChat, ...chats];
        setChats(updatedChats);
        dbService.saveChats(updatedChats);
        setActiveChatId(user.id);
    }
    setSearchQuery('');
  };

  const initPeerConnection = () => {
    pc.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.current.onicecandidate = (event) => {
      if (event.candidate && activeChat) {
        apiService.sendMessage({
          type: 'signal',
          targetId: activeChat.id,
          data: { candidate: event.candidate }
        });
      }
    };

    pc.current.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.current?.addTrack(track, localStream);
      });
    }
  };

  const handleIncomingSignal = async (signal: { from: string; data: any }) => {
    if (signal.data.offer) {
      setIncomingSignal(signal);
      setCallType(signal.data.callType || 'video');
      setCallStatus('incoming');
      setIsCallActive(true);
    } else if (signal.data.answer) {
      await pc.current?.setRemoteDescription(new RTCSessionDescription(signal.data.answer));
      setCallStatus('connected');
    } else if (signal.data.candidate) {
      await pc.current?.addIceCandidate(new RTCIceCandidate(signal.data.candidate));
    } else if (signal.data.type === 'hangup') {
      endCall();
    }
  };

  const startCall = async (type: 'audio' | 'video') => {
    if (!activeChat) return;
    try {
      setCallType(type);
      const constraints = { video: type === 'video', audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setIsCallActive(true);
      setCallStatus('dialing');
      setIsVideoOff(type === 'audio');

      initPeerConnection();

      const offer = await pc.current?.createOffer();
      await pc.current?.setLocalDescription(offer);

      apiService.sendMessage({
        type: 'signal',
        targetId: activeChat.id,
        data: { offer, callType: type }
      });
    } catch (e) {
      console.error("Error starting call:", e);
    }
  };

  const answerCall = async () => {
    if (!incomingSignal) return;
    try {
      const constraints = { video: callType === 'video', audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setCallStatus('connected');
      setIsVideoOff(callType === 'audio');

      initPeerConnection();

      await pc.current?.setRemoteDescription(new RTCSessionDescription(incomingSignal.data.offer));
      const answer = await pc.current?.createAnswer();
      await pc.current?.setLocalDescription(answer);

      apiService.sendMessage({
        type: 'signal',
        targetId: incomingSignal.from,
        data: { answer }
      });
    } catch (e) {
      console.error("Error answering call:", e);
    }
  };

  const endCall = () => {
    if (activeChat || incomingSignal) {
        apiService.sendMessage({
            type: 'signal',
            targetId: activeChat?.id || incomingSignal?.from,
            data: { type: 'hangup' }
        });
    }
    localStream?.getTracks().forEach(track => track.stop());
    pc.current?.close();
    setLocalStream(null);
    setRemoteStream(null);
    setIsCallActive(false);
    setCallStatus('idle');
    setIncomingSignal(null);
    setIsVideoOff(false);
  };

  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      setIsMicMuted(!isMicMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream && callType === 'video') {
      localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
      setIsVideoOff(!isVideoOff);
    }
  };

  const handleToggleReaction = (messageId: string, emoji: string) => {
    if (!myProfile) return;
    dbService.addReaction(messageId, myProfile.id, emoji);
    if (activeChatId) setMessages(dbService.getMessages(activeChatId));
    setActiveReactionPickerId(null);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && myProfile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const updatedProfile = { ...myProfile, avatar: base64String };
        setMyProfile(updatedProfile);
        localStorage.setItem('chatnest_profile', JSON.stringify(updatedProfile));
        apiService.sendMessage({ type: 'join', profile: updatedProfile });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMediaFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1 * 1024 * 1024) {
      alert("File too large. Please select a file smaller than 1MB.");
      return;
    }

    if (activeChatId && myProfile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        let type: 'image' | 'video' | 'audio' | 'file' = 'file';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        else if (file.type.startsWith('audio/')) type = 'audio';

        handleSendMessage('', {
          type,
          url: base64String,
          mimeType: file.type,
          fileName: file.name
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async (text: string, media?: Message['media']) => {
    if ((!text.trim() && !media) || !activeChatId || !myProfile) return;

    const newMessage: Message = {
      id: `${myProfile.id}-${Date.now()}`,
      chatId: activeChatId,
      senderId: myProfile.id,
      senderName: myProfile.name,
      senderAvatar: myProfile.avatar,
      text: text,
      timestamp: Date.now(),
      status: MessageStatus.SENT,
      media
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
        id: `ai-${Date.now()}`,
        chatId: activeChatId,
        senderId: 'ai-gemini',
        text: aiText,
        timestamp: Date.now(),
        status: MessageStatus.DELIVERED,
        isAI: true,
        sources
      };
      setMessages(prev => [...prev, aiMessage]);
      dbService.saveMessage(aiMessage);
      setIsTyping(false);
    }
  };

  if (!isRegistered) {
    return (
        <div className="h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95">
                <div className={`w-20 h-20 bg-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg`}>
                    <Zap className="w-10 h-10 text-white" />
                </div>
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
                    <button type="submit" className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all">
                        Create My Nest
                    </button>
                </form>
            </div>
        </div>
    );
  }

  return (
    <div className={`flex h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-jakarta selection:bg-${currentTheme.class}/20`}>
      {/* Navigation - Sidebar for Desktop */}
      <nav className="hidden md:flex w-20 flex-col items-center py-8 gap-8 border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-50">
        <div onClick={() => setActiveChatId(null)} className={`w-12 h-12 bg-${currentTheme.class} rounded-2xl flex items-center justify-center cursor-pointer hover:rotate-12 transition-all shadow-lg`}>
          <Zap className="w-6 h-6 text-white" />
        </div>
        <div className="flex flex-col gap-6 flex-1">
          <button onClick={() => setActiveTab('chats')} className={`p-3.5 rounded-xl transition-all ${activeTab === 'chats' ? `bg-${currentTheme.class}/10 text-${currentTheme.class}` : 'text-slate-400'}`}><MessageSquare /></button>
          <button onClick={() => setActiveTab('contacts')} className={`p-3.5 rounded-xl transition-all ${activeTab === 'contacts' ? `bg-${currentTheme.class}/10 text-${currentTheme.class}` : 'text-slate-400'}`}><Users /></button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3.5 rounded-xl text-slate-400 hover:text-yellow-500">{isDarkMode ? <Sun /> : <Moon />}</button>
        </div>
        <button onClick={() => setShowSettings(true)} className="p-1"><img src={myProfile?.avatar} className="w-10 h-10 rounded-xl object-cover" alt="" /></button>
      </nav>

      {/* Chat List & Search */}
      <aside className={`${activeChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col border-r border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-black">ChatNest</h1>
            <button onClick={() => setShowSettings(true)} className="md:hidden w-10 h-10 rounded-xl overflow-hidden shadow-sm border border-white dark:border-slate-800">
                <img src={myProfile?.avatar} className="w-full h-full object-cover" alt="" />
            </button>
          </div>
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search nestlings..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white dark:bg-slate-800 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none shadow-sm focus:ring-2 ring-orange-500/10" />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {/* Current Conversations */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-4 mb-2 block">Recent Chats</label>
            {localFiltered.length > 0 ? localFiltered.map(chat => (
                <div key={chat.id} onClick={() => setActiveChatId(chat.id)} className={`flex items-center gap-4 p-4 cursor-pointer rounded-3xl transition-all ${activeChatId === chat.id ? 'bg-white dark:bg-slate-800 shadow-md' : 'hover:bg-white/50 dark:hover:bg-slate-800/20'}`}>
                <img src={chat.avatar} className="w-14 h-14 rounded-2xl object-cover" alt="" />
                <div className="flex-1 truncate">
                    <div className="flex justify-between items-center"><h3 className="font-bold text-sm">{chat.name}</h3><span className="text-[10px] opacity-40 font-bold">{chat.lastTimestamp ? new Date(chat.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span></div>
                    <p className="text-xs opacity-50 truncate">{chat.lastMessage || chat.phone}</p>
                </div>
                </div>
            )) : <p className="text-xs text-center py-4 opacity-40 italic">No recent chats found</p>}
          </div>

          {/* Discovery / Global Users (Search Results) */}
          {searchQuery && globalFiltered.length > 0 && (
            <div className="space-y-1 pt-4 border-t border-slate-100 dark:border-slate-800">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-4 mb-2 block">Global Nest (New People)</label>
                {globalFiltered.map(user => (
                    <div key={user.id} onClick={() => startNewChat(user)} className="flex items-center gap-4 p-4 cursor-pointer rounded-3xl bg-orange-500/5 border border-orange-500/10 hover:bg-orange-500/10 transition-all">
                        <img src={user.avatar} className="w-12 h-12 rounded-xl object-cover" alt="" />
                        <div className="flex-1 truncate">
                            <h3 className="font-bold text-sm text-orange-600 dark:text-orange-400">{user.name}</h3>
                            <p className="text-[10px] opacity-50 font-bold uppercase tracking-widest">{user.phone}</p>
                        </div>
                        <UserPlus className="w-4 h-4 text-orange-500" />
                    </div>
                ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main Chat View */}
      <main className={`${activeChatId ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col h-full bg-white dark:bg-slate-950 relative`}>
        {activeChat ? (
          <>
            <header className="px-4 py-3 md:px-6 md:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between glass-morphism z-40 sticky top-0">
              <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
                <button onClick={() => setActiveChatId(null)} className="md:hidden p-2 -ml-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-3 min-w-0">
                  <img src={activeChat.avatar} className="w-9 h-9 md:w-10 md:h-10 rounded-xl object-cover flex-shrink-0" alt="" />
                  <div className="truncate">
                    <h2 className="font-bold text-sm md:text-base truncate">{activeChat.name}</h2>
                    <p className="text-[9px] md:text-[10px] opacity-50 font-bold uppercase tracking-widest truncate">{isTyping ? 'Thinking...' : 'Active Now'}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                <button onClick={() => startCall('audio')} className={`p-2 md:p-2.5 rounded-xl text-slate-400 hover:text-${currentTheme.class} hover:bg-${currentTheme.class}/10 transition-all`} title="Audio Call">
                    <Phone className="w-5 h-5 md:w-5.5 md:h-5.5" />
                </button>
                <button onClick={() => startCall('video')} className={`p-2 md:p-2.5 rounded-xl text-slate-400 hover:text-${currentTheme.class} hover:bg-${currentTheme.class}/10 transition-all`} title="Video Call">
                    <Video className="w-5 h-5 md:w-5.5 md:h-5.5" />
                </button>
                <button className="p-2 text-slate-400"><MoreVertical className="w-4.5 h-4.5 md:w-5 md:h-5" /></button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.senderId === myProfile?.id ? 'items-end' : 'items-start'}`}>
                  <div className="relative group">
                    <div className={`max-w-[85%] md:max-w-lg p-4 rounded-2xl shadow-sm ${msg.senderId === myProfile?.id ? `bg-${currentTheme.class} text-white rounded-tr-none` : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none'}`}>
                      {msg.media?.type === 'image' && <img src={msg.media.url} className="w-full rounded-xl mb-2" alt="" />}
                      {msg.media?.type === 'video' && <video src={msg.media.url} controls className="w-full rounded-xl mb-2" />}
                      {msg.media?.type === 'audio' && <audio src={msg.media.url} controls className="w-full mb-2" />}
                      {msg.media?.type === 'file' && (
                        <a href={msg.media.url} download={msg.media.fileName || 'file'} className="flex items-center gap-2 bg-black/10 dark:bg-white/10 p-3 rounded-xl mb-2 hover:bg-black/20 transition-all">
                          <FileText className="w-6 h-6" />
                          <span className="text-xs font-bold truncate">{msg.media.fileName || 'Download File'}</span>
                        </a>
                      )}
                      <p className="text-[14px] font-medium leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-white/20 text-[11px]">
                          <p className="font-bold mb-1 opacity-70">Sources:</p>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((s: any, i: number) => (
                              <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded hover:bg-white/20 transition-all">
                                <ExternalLink className="w-3 h-3" />
                                <span className="truncate max-w-[150px]">{s.title || s.uri}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-1 mt-1 opacity-50 text-[9px] font-bold">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {msg.senderId === myProfile?.id && <CheckCheck className="w-3 h-3" />}
                      </div>
                    </div>

                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-1 ${msg.senderId === myProfile?.id ? 'justify-end' : 'justify-start'}`}>
                            {Object.entries(msg.reactions).map(([emoji, users]) => (
                                <button key={emoji} onClick={() => handleToggleReaction(msg.id, emoji)} className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold transition-all shadow-sm ${(users as string[]).includes(myProfile!.id) ? `bg-${currentTheme.class}/20 border border-${currentTheme.class}/30 text-${currentTheme.class}` : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                                    <span>{emoji}</span>
                                    <span className="opacity-70">{(users as string[]).length}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className={`absolute -top-10 ${msg.senderId === myProfile?.id ? 'right-0' : 'left-0'} hidden group-hover:flex items-center bg-white dark:bg-slate-800 shadow-2xl border border-slate-100 dark:border-slate-700 p-1.5 rounded-full z-20 animate-in slide-in-from-top-1`}>
                        {QUICK_REACTIONS.map(e => <button key={e} onClick={() => handleToggleReaction(msg.id, e)} className="p-1 hover:scale-125 transition-all text-sm">{e}</button>)}
                        <button onClick={() => setActiveReactionPickerId(msg.id)} className="p-1 text-slate-400 hover:text-orange-500"><PlusCircle className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>

            <footer className="p-4 md:p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
              <div className="max-w-4xl mx-auto flex items-end gap-2 md:gap-3 p-1.5 bg-slate-50 dark:bg-slate-900 rounded-[2rem] border border-slate-200/50 dark:border-slate-800">
                <div className="flex">
                    <button onClick={() => mediaInputRef.current?.click()} className={`p-3 md:p-3.5 rounded-full transition-all text-slate-400 hover:text-${currentTheme.class} hover:bg-${currentTheme.class}/10`} title="Attach Files">
                      <Plus className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                    <input type="file" ref={mediaInputRef} onChange={handleMediaFileSelect} className="hidden" accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.txt" />
                </div>
                <textarea 
                  rows={1} 
                  value={inputText} 
                  onChange={(e) => setInputText(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage(inputText))} 
                  placeholder="Hatch a message..." 
                  className="flex-1 bg-transparent py-3 px-1 outline-none text-[14px] md:text-[15px] font-medium resize-none min-h-[44px] flex items-center" 
                />
                <button onClick={() => handleSendMessage(inputText)} className={`p-3 md:p-3.5 bg-${currentTheme.class} text-white rounded-full shadow-xl active:scale-90 transition-all flex-shrink-0`}>
                    <Send className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-10">
            <div className={`w-24 h-24 md:w-32 md:h-32 bg-${currentTheme.class}/10 rounded-[2rem] md:rounded-[3rem] flex items-center justify-center mb-6 md:mb-10 shadow-2xl`}><Zap className={`w-12 h-12 md:w-16 md:h-16 text-${currentTheme.class}`} /></div>
            <h2 className="text-3xl md:text-4xl font-black mb-4">Welcome to ChatNest</h2>
            <p className="max-w-md opacity-50 font-medium text-sm md:text-base">The most intelligent nest for your digital conversations. Search by name or number to find others.</p>
          </div>
        )}

        {/* Call Overlay */}
        {isCallActive && (
            <div className="fixed inset-0 z-[1000] bg-slate-950 flex flex-col items-center justify-center animate-in fade-in duration-300 overflow-hidden">
                <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
                    {callType === 'video' ? (
                        remoteStream ? (
                            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex flex-col items-center gap-6 animate-pulse px-6">
                                <img src={activeChat?.avatar || incomingSignal?.from} className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white/10" alt="" />
                                <div className="text-center">
                                    <h3 className="text-xl md:text-2xl font-black text-white">{activeChat?.name || 'Incoming User'}</h3>
                                    <p className="text-orange-500 font-bold uppercase tracking-[0.4em] text-[10px] md:text-xs mt-2">
                                        {callStatus === 'dialing' ? 'Dialing...' : callStatus === 'incoming' ? 'Incoming Video Call...' : 'Connecting...'}
                                    </p>
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="flex flex-col items-center gap-8 md:gap-12 px-6">
                            <div className="relative">
                                <div className="absolute -inset-10 border-2 border-white/5 rounded-full animate-ping opacity-20" />
                                <img src={activeChat?.avatar || incomingSignal?.from} className="w-48 h-48 md:w-64 md:h-64 rounded-full border-8 border-white/10 shadow-2xl relative z-10" alt="" />
                                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-emerald-500 p-3 rounded-2xl shadow-lg z-20">
                                    <Mic2 className="w-5 h-5 md:w-6 md:h-6 text-white" />
                                </div>
                            </div>
                            <div className="text-center z-10">
                                <h3 className="text-2xl md:text-4xl font-black text-white mb-3">{activeChat?.name || 'Incoming Caller'}</h3>
                                <p className="text-orange-500 font-bold uppercase tracking-[0.4em] text-[10px] animate-pulse">
                                    {callStatus === 'dialing' ? 'Dialing...' : callStatus === 'incoming' ? 'Incoming Audio Call...' : 'On Call'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {callType === 'video' && (
                    <div className="absolute top-6 right-6 md:top-10 md:right-10 w-32 h-44 md:w-48 md:h-64 bg-slate-800 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl border-2 border-white/20 z-10 transition-transform">
                        {localStream ? (
                            <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`} />
                        ) : null}
                        {isVideoOff && (
                            <div className="w-full h-full flex items-center justify-center bg-slate-900">
                                <VideoOff className="w-8 h-8 text-slate-600" />
                            </div>
                        )}
                    </div>
                )}

                <div className="absolute top-6 left-6 md:top-10 md:left-10 flex items-center gap-3 bg-black/30 backdrop-blur-md p-3 md:p-4 rounded-2xl md:rounded-3xl border border-white/10 z-10">
                   <ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
                   <div>
                       <p className="text-white text-xs md:text-sm font-black truncate max-w-[120px]">{activeChat?.name || 'Nestling'}</p>
                       <p className="text-white/50 text-[8px] md:text-[10px] uppercase font-bold tracking-widest">Secure Call</p>
                   </div>
                </div>

                <div className="absolute bottom-12 flex items-center gap-4 md:gap-6 z-20 scale-90 md:scale-100">
                    {callStatus === 'incoming' ? (
                        <>
                            <button onClick={answerCall} className="w-16 h-16 md:w-20 md:h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-emerald-600 transition-all ring-4 ring-emerald-500/30">
                                {callType === 'video' ? <Video className="w-6 h-6 md:w-8 md:h-8" /> : <Phone className="w-6 h-6 md:w-8 md:h-8" />}
                            </button>
                            <button onClick={endCall} className="w-16 h-16 md:w-20 md:h-20 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-rose-600 transition-all ring-4 ring-rose-500/30">
                                <PhoneOff className="w-6 h-6 md:w-8 md:h-8" />
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={toggleMic} className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 transition-all ${isMicMuted ? 'bg-rose-500 text-white' : 'bg-white/10 text-white'}`}>
                                {isMicMuted ? <MicOff className="w-5 h-5 md:w-6 md:h-6" /> : <Mic className="w-5 h-5 md:w-6 md:h-6" />}
                            </button>
                            <button onClick={endCall} className="w-16 h-16 md:w-20 md:h-20 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-rose-600 transition-all ring-4 ring-rose-500/20">
                                <PhoneOff className="w-6 h-6 md:w-8 md:h-8" />
                            </button>
                            {callType === 'video' && (
                                <button onClick={toggleVideo} className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 transition-all ${isVideoOff ? 'bg-rose-500 text-white' : 'bg-white/10 text-white'}`}>
                                    {isVideoOff ? <VideoOff className="w-5 h-5 md:w-6 md:h-6" /> : <CameraIcon className="w-5 h-5 md:w-6 md:h-6" />}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        )}

        {/* Global Key Selection Modal */}
        {!hasApiKey && (
          <div className="fixed inset-0 z-[2000] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6 text-center">
            <div className="max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-2xl">
              <ShieldCheck className="w-16 h-16 text-orange-500 mx-auto mb-6" />
              <h2 className="text-2xl font-black mb-4">AI Features Locked</h2>
              <p className="text-sm opacity-60 mb-8">Advanced features like video generation require a paid API key.</p>
              <button onClick={async () => {
                  // @ts-ignore
                  if (window.aistudio) await window.aistudio.openSelectKey();
                  setHasApiKey(true);
              }} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg">Select API Key</button>
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md" onClick={() => setShowSettings(false)}>
                <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] p-6 md:p-10 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowSettings(false)} className="absolute top-8 right-8 text-slate-400 p-2"><X /></button>
                    <h2 className="text-2xl md:text-3xl font-black mb-8">Profile Settings</h2>
                    <div className="space-y-8">
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <img src={myProfile?.avatar} className="w-24 h-24 md:w-32 md:h-32 rounded-[2rem] object-cover border-4 border-orange-500/20" alt="" />
                                <div className="absolute inset-0 bg-black/40 rounded-[2rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="text-white" />
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-black">{myProfile?.name}</h3>
                                <p className="text-sm opacity-50 font-bold">{myProfile?.phone}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setIsDarkMode(!isDarkMode)} className="py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold flex items-center justify-center gap-3">
                                {isDarkMode ? <Sun /> : <Moon />} {isDarkMode ? 'Light' : 'Dark'}
                            </button>
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
