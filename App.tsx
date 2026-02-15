
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
    PlusCircle, Maximize2, Volume2, VolumeX, Mic2, Upload
} from 'lucide-react';

const THEME_COLORS = [
    { name: 'orange', class: 'orange-500', hex: '#f97316' },
    { name: 'blue', class: 'blue-500', hex: '#3b82f6' },
    { name: 'violet', class: 'violet-500', hex: '#8b5cf6' },
    { name: 'emerald', class: 'emerald-500', hex: '#10b981' }
];

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '✨'];

export default function App() {
  const [myProfile, setMyProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('chatnest_profile');
    if (saved) return JSON.parse(saved);
    const guest: UserProfile = {
        id: 'user-' + Math.random().toString(36).substr(2, 9),
        name: 'Nestling Guest',
        phone: '+1 234 567 890',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=Guest-${Date.now()}`,
        bio: 'Just hanging in the nest.',
        status: 'online'
    };
    localStorage.setItem('chatnest_profile', JSON.stringify(guest));
    return guest;
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

  const filteredList = chats.filter(chat => 
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    chat.phone.includes(searchQuery)
  );

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('chatnest_dark', isDarkMode.toString());
  }, [isDarkMode]);

  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore
      if (window.aistudio) {
        // @ts-ignore
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    if (activeChatId) setMessages(dbService.getMessages(activeChatId));
  }, [activeChatId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    apiService.connect(
      (data) => {
        if (data.type === 'signal') {
          handleIncomingSignal(data);
        } else if (data.type === 'new_message') {
          if (data.message.chatId === activeChatId) {
            setMessages(prev => [...prev, data.message]);
          }
          setChats(dbService.getChats());
        }
      },
      (status) => console.log("Backend connection:", status)
    );
  }, [activeChatId]);

  useEffect(() => {
    if (localVideoRef.current && localStream && callType === 'video') {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isCallActive, callType]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream && callType === 'video') {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isCallActive, callType]);

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

  const handleOpenKeySelection = async () => {
    // @ts-ignore
    if (window.aistudio) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
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
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMediaFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size to prevent quota issues (limit to 1MB)
    if (file.size > 1 * 1024 * 1024) {
      alert("File too large. Please select a file smaller than 1MB to avoid storage limit errors.");
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

  return (
    <div className={`flex h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-jakarta selection:bg-${currentTheme.class}/20`}>
      {/* Navigation */}
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

      {/* Chat List */}
      <aside className={`${activeChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col border-r border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50`}>
        <div className="p-6">
          <h1 className="text-2xl font-black mb-6">ChatNest</h1>
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search nestlings..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white dark:bg-slate-800 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none shadow-sm" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
          {filteredList.map(chat => (
            <div key={chat.id} onClick={() => setActiveChatId(chat.id)} className={`flex items-center gap-4 p-4 cursor-pointer rounded-3xl transition-all ${activeChatId === chat.id ? 'bg-white dark:bg-slate-800 shadow-md' : 'hover:bg-white/50 dark:hover:bg-slate-800/20'}`}>
              <img src={chat.avatar} className="w-14 h-14 rounded-2xl object-cover" alt="" />
              <div className="flex-1 truncate">
                <div className="flex justify-between items-center"><h3 className="font-bold text-sm">{chat.name}</h3><span className="text-[10px] opacity-40 font-bold">{chat.lastTimestamp ? new Date(chat.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span></div>
                <p className="text-xs opacity-50 truncate">{chat.lastMessage || chat.phone}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Chat View */}
      <main className={`${activeChatId ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col h-full bg-white dark:bg-slate-950 relative`}>
        {activeChat ? (
          <>
            <header className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between glass-morphism z-40">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveChatId(null)} className="md:hidden p-2"><ArrowLeft /></button>
                <div className="flex items-center gap-3">
                  <img src={activeChat.avatar} className="w-10 h-10 rounded-xl object-cover" alt="" />
                  <div><h2 className="font-bold text-sm">{activeChat.name}</h2><p className="text-[10px] opacity-50 font-bold uppercase tracking-widest">{isTyping ? 'Thinking...' : 'Active Now'}</p></div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startCall('audio')} className={`p-2.5 rounded-xl text-slate-400 hover:text-${currentTheme.class} hover:bg-${currentTheme.class}/10 transition-all`} title="Audio Call"><Phone className="w-5.5 h-5.5" /></button>
                <button onClick={() => startCall('video')} className={`p-2.5 rounded-xl text-slate-400 hover:text-${currentTheme.class} hover:bg-${currentTheme.class}/10 transition-all`} title="Video Call"><Video className="w-5.5 h-5.5" /></button>
                <button className="p-2 text-slate-400"><MoreVertical className="w-5 h-5" /></button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.senderId === myProfile?.id ? 'items-end' : 'items-start'}`}>
                  <div className="relative group">
                    <div className={`max-w-lg p-4 rounded-2xl shadow-sm ${msg.senderId === myProfile?.id ? `bg-${currentTheme.class} text-white rounded-tr-none` : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none'}`}>
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

            <footer className="p-6 border-t border-slate-100 dark:border-slate-800">
              <div className="max-w-4xl mx-auto flex items-end gap-3 p-1.5 bg-slate-50 dark:bg-slate-900 rounded-[2rem] border border-slate-200/50 dark:border-slate-800">
                <div className="flex">
                    <button onClick={() => mediaInputRef.current?.click()} className={`p-3.5 rounded-full transition-all text-slate-400 hover:text-${currentTheme.class} hover:bg-${currentTheme.class}/10`} title="Attach Files">
                      <Plus className="w-6 h-6" />
                    </button>
                    <input type="file" ref={mediaInputRef} onChange={handleMediaFileSelect} className="hidden" accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.txt" />
                </div>
                <textarea 
                  rows={1} 
                  value={inputText} 
                  onChange={(e) => setInputText(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage(inputText))} 
                  placeholder="Hatch a message..." 
                  className="flex-1 bg-transparent py-3 px-2 outline-none text-[15px] font-medium resize-none min-h-[44px] flex items-center" 
                />
                <button onClick={() => handleSendMessage(inputText)} className={`p-3.5 bg-${currentTheme.class} text-white rounded-full shadow-xl active:scale-90 transition-all`}><Send className="w-6 h-6" /></button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-10">
            <div className={`w-32 h-32 bg-${currentTheme.class}/10 rounded-[3rem] flex items-center justify-center mb-10 shadow-2xl`}><Zap className={`w-16 h-16 text-${currentTheme.class}`} /></div>
            <h2 className="text-4xl font-black mb-4">Welcome to ChatNest</h2>
            <p className="max-w-md opacity-50 font-medium">The most intelligent nest for your digital conversations.</p>
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
                            <div className="flex flex-col items-center gap-6 animate-pulse">
                                <img src={activeChat?.avatar || incomingSignal?.from} className="w-40 h-40 rounded-full border-4 border-white/10" alt="" />
                                <div className="text-center">
                                    <h3 className="text-2xl font-black text-white">{activeChat?.name || 'Incoming User'}</h3>
                                    <p className="text-orange-500 font-bold uppercase tracking-[0.4em] text-xs mt-2">
                                        {callStatus === 'dialing' ? 'Dialing...' : callStatus === 'incoming' ? 'Incoming Video Call...' : 'Connecting...'}
                                    </p>
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="flex flex-col items-center gap-12">
                            <div className="relative">
                                <div className="absolute -inset-10 border-2 border-white/5 rounded-full animate-ping opacity-20" />
                                <div className="absolute -inset-20 border border-white/5 rounded-full animate-pulse opacity-10" />
                                <img src={activeChat?.avatar || incomingSignal?.from} className="w-64 h-64 rounded-full border-8 border-white/10 shadow-2xl relative z-10" alt="" />
                                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-emerald-500 p-3 rounded-2xl shadow-lg z-20">
                                    <Mic2 className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <div className="text-center z-10">
                                <h3 className="text-4xl font-black text-white mb-3">{activeChat?.name || 'Incoming Caller'}</h3>
                                <p className="text-orange-500 font-bold uppercase tracking-[0.6em] text-[10px] animate-pulse">
                                    {callStatus === 'dialing' ? 'Dialing...' : callStatus === 'incoming' ? 'Incoming Audio Call...' : 'On Call'}
                                </p>
                            </div>
                            <div className="flex items-end gap-1.5 h-12">
                                {[...Array(12)].map((_, i) => (
                                    <div key={i} className={`w-1.5 bg-white/20 rounded-full animate-recording-bar`} style={{ height: `${20 + Math.random() * 80}%`, animationDelay: `${i * 0.1}s` }} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {callType === 'video' && (
                    <div className="absolute top-10 right-10 w-48 h-64 bg-slate-800 rounded-3xl overflow-hidden shadow-2xl border-2 border-white/20 z-10 transition-transform active:scale-95">
                        {localStream ? (
                            <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`} />
                        ) : null}
                        {isVideoOff && (
                            <div className="w-full h-full flex items-center justify-center bg-slate-900">
                                <VideoOff className="w-10 h-10 text-slate-600" />
                            </div>
                        )}
                    </div>
                )}

                <div className="absolute top-10 left-10 flex items-center gap-4 bg-black/30 backdrop-blur-md p-4 rounded-3xl border border-white/10 z-10">
                   <ShieldCheck className="w-5 h-5 text-emerald-500" />
                   <div>
                       <p className="text-white text-sm font-black">{activeChat?.name || 'Nestling'}</p>
                       <p className="text-white/50 text-[10px] uppercase font-bold tracking-widest">Secure Connection</p>
                   </div>
                </div>

                <div className="absolute bottom-12 flex items-center gap-6 z-20">
                    {callStatus === 'incoming' ? (
                        <>
                            <button onClick={answerCall} className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-emerald-600 transition-all active:scale-90 ring-4 ring-emerald-500/30">
                                {callType === 'video' ? <Video className="w-8 h-8" /> : <Phone className="w-8 h-8" />}
                            </button>
                            <button onClick={endCall} className="w-20 h-20 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-rose-600 transition-all active:scale-90 ring-4 ring-rose-500/30">
                                <PhoneOff className="w-8 h-8" />
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={toggleMic} className={`w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 transition-all active:scale-90 ${isMicMuted ? 'bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                                {isMicMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                            </button>
                            <button onClick={endCall} className="w-20 h-20 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-rose-600 transition-all active:scale-90 hover:rotate-12 ring-4 ring-rose-500/20">
                                <PhoneOff className="w-8 h-8" />
                            </button>
                            {callType === 'video' && (
                                <button onClick={toggleVideo} className={`w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 transition-all active:scale-90 ${isVideoOff ? 'bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                                    {isVideoOff ? <VideoOff className="w-6 h-6" /> : <CameraIcon className="w-6 h-6" />}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        )}

        {!hasApiKey && (
          <div className="fixed inset-0 z-[2000] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6 text-center">
            <div className="max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95">
              <div className="w-20 h-20 bg-orange-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <ShieldCheck className="w-10 h-10 text-orange-500" />
              </div>
              <h2 className="text-2xl font-black mb-4">API Key Required</h2>
              <p className="text-sm opacity-60 mb-8 font-medium leading-relaxed">
                To use video generation and other advanced AI features, you must select a paid API key. 
                Visit the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-orange-500 underline font-bold">billing documentation</a> for details.
              </p>
              <button onClick={handleOpenKeySelection} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg hover:bg-orange-600 transition-all transform active:scale-95">
                Select API Key
              </button>
            </div>
          </div>
        )}

        {activeReactionPickerId && (
            <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/20 backdrop-blur-sm" onClick={() => setActiveReactionPickerId(null)}>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                    <h2 className="text-sm font-black uppercase tracking-widest opacity-40 mb-4 px-2">Nest Reactions</h2>
                    <div className="grid grid-cols-6 gap-3">
                        {['🔥', '✨', '🚀', '⭐', '🎈', '🎉', '💡', '🤔', '👀', '💯', '🌈', '👏', '🙌', '🤝', '🦋', '🍀', '🍕', '🎸', '🎮'].map(e => (
                            <button key={e} onClick={() => handleToggleReaction(activeReactionPickerId, e)} className="text-2xl hover:scale-125 transition-all p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">{e}</button>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </main>

      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md" onClick={() => setShowSettings(false)}>
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowSettings(false)} className="absolute top-8 right-8 text-slate-400 p-2"><X /></button>
                <h2 className="text-3xl font-black mb-8">Settings</h2>
                <div className="space-y-8">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Profile</label>
                        <div className="flex items-center gap-6 p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl group relative">
                            <div className="relative cursor-pointer overflow-hidden rounded-2xl w-24 h-24 shadow-lg border-2 border-white dark:border-slate-700" onClick={() => fileInputRef.current?.click()}>
                                <img src={myProfile?.avatar} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="w-8 h-8 text-white" />
                                </div>
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
                            <div>
                                <h3 className="text-xl font-black">{myProfile?.name}</h3>
                                <p className="text-sm opacity-50 font-bold">{myProfile?.phone}</p>
                                <button onClick={() => fileInputRef.current?.click()} className="mt-2 text-xs font-black text-orange-500 uppercase tracking-widest flex items-center gap-2 hover:opacity-70 transition-opacity">
                                    <Upload className="w-3 h-3" /> Change Photo
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold flex items-center justify-center gap-3">
                        {isDarkMode ? <Sun /> : <Moon />} {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                    </button>
                    <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full py-4 bg-rose-50 text-rose-500 rounded-2xl font-bold">Sign Out</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
