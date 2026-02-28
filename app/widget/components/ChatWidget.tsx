// app/widget/components/ChatWidget.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useChat } from 'ai/react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import ReactMarkdown from 'react-markdown';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';
import LeadCaptureForm from './LeadCaptureForm';
import HelpTab from './HelpTab';
import { ClearIcon, ChatBubbleIcon, ChevronDownIcon, MessageSquareIcon, HelpCircleIcon, HomeIcon } from '@/components/icons';

const playPopSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch(e) {}
};

// Generates a consistent pastel-ish background color for an email
const getAvatarColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
};

type Conversation = { id: string; updatedAt: number; messages: any[]; liveSessionId: string | null; liveMessages: any[] };

export default function ChatWidget({ spaceId, config, urlOverrides }: any) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [isOpen, setIsOpen] = useState(urlOverrides.preview ? true : false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 430);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const enableLeadCapture = urlOverrides.leadCapture !== null ? urlOverrides.leadCapture : (config?.leadCaptureEnabled ?? config?.lead_capture_enabled ?? false);
  const [isLeadCaptured, setIsLeadCaptured, removeLeadCaptured] = useLocalStorage(`lead_captured_${spaceId}`, !enableLeadCapture);
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);

  const [escalatingId, setEscalatingId] = useState<string | null>(null);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  
  const primaryColor = urlOverrides.color || config?.primaryColor || config?.primary_color || '#000000';
  const botFontColor = urlOverrides.botFontColor || config?.botFontColor || config?.bot_font_color || '#1f2937';
  const userFontColor = urlOverrides.userFontColor || config?.userFontColor || config?.user_font_color || '#ffffff';
  
  const agentBubbleColor = urlOverrides.agentBubbleColor || config?.agentBubbleColor || config?.agent_bubble_color || '#f3f4f6';
  const userBubbleColor = urlOverrides.userBubbleColor || config?.userBubbleColor || config?.user_bubble_color || primaryColor;
  const launcherColor = urlOverrides.launcherColor || config?.launcherColor || config?.launcher_color || primaryColor;
  const launcherIconColor = urlOverrides.launcherIconColor || config?.launcherIconColor || config?.launcher_icon_color || userFontColor;
  
  const headerText = urlOverrides.header || config?.headerText || config?.header_text || 'Documentation Bot';
  const descriptionText = urlOverrides.description || config?.descriptionText || config?.description_text || '';
  const welcomeMessage = config?.welcomeMessage || config?.welcome_message || 'How can I help you today?';
  const inputPlaceholder = urlOverrides.placeholder || config?.inputPlaceholder || config?.input_placeholder || 'Ask a question...';
  const removeBranding = urlOverrides.removeBranding !== null ? urlOverrides.removeBranding : (config?.removeBranding ?? config?.remove_branding ?? false);
  
  const botAvatar = config?.botAvatar || config?.bot_avatar || null;
  const agentsOnline = config?.agentsOnline ?? config?.agents_online ?? false;
  const teamMembers = config?.teamMembers || [];
  
  const enablePageContext = urlOverrides.pageContextEnabled !== undefined && urlOverrides.pageContextEnabled !== null ? urlOverrides.pageContextEnabled : (config?.pageContextEnabled ?? config?.page_context_enabled ?? false);
  const routingOptions = urlOverrides.routingConfig !== undefined && urlOverrides.routingConfig !== null ? urlOverrides.routingConfig : (config?.routingConfig || config?.routing_config || []);
  const tabsEnabled = urlOverrides.tabsEnabled !== null ? urlOverrides.tabsEnabled : (config?.tabsEnabled ?? config?.tabs_enabled ?? false);

  // New features
  const homeTabEnabled = urlOverrides.homeTabEnabled !== null ? urlOverrides.homeTabEnabled : (config?.homeTabEnabled ?? config?.home_tab_enabled ?? false);
  const greetingTitle = urlOverrides.greetingTitle || config?.greetingTitle || config?.greeting_title || 'Hello there.';
  const greetingBody = urlOverrides.greetingBody || config?.greetingBody || config?.greeting_body || 'How can we help you today?';
  const homeContent = urlOverrides.homeContent || config?.homeContent || config?.home_content || '';

  const currentUrl = enablePageContext ? (urlOverrides.parentUrl || (typeof window !== 'undefined' ? window.location.href : '')) : undefined;

  const defaultPrompts = ["How do I reset my password?", "Where can I find the documentation?", "How do I contact support?"];
  const showPrompts = urlOverrides.showPrompts !== null ? urlOverrides.showPrompts : (config?.showPrompts ?? config?.show_prompts ?? true);
  const suggestedPrompts = urlOverrides.prompts !== null ? urlOverrides.prompts : (config?.suggestedPrompts || config?.suggested_prompts || defaultPrompts);

  const initMsg = { id: 'init', role: 'assistant', content: welcomeMessage } as const;

  // Migration & State for Conversations List
  const [conversations, setConversations] = useLocalStorage<Conversation[]>(`conversations_${spaceId}`, []);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<'home' | 'messages' | 'help'>(tabsEnabled && homeTabEnabled ? 'home' : 'messages');
  const [messagesView, setMessagesView] = useState<'list' | 'chat'>(tabsEnabled ? 'list' : 'chat');

  // Legacy local storage hook for seamless transition
  const [savedMessages, setSavedMessages, removeSavedMessages] = useLocalStorage<any[]>(`chat_session_${spaceId}`, [initMsg]);
  const [routingContext, setRoutingContext, removeRoutingContext] = useLocalStorage<string | null>(`routing_context_${spaceId}`, null);

  const [liveSessionId, setLiveSessionId, removeLiveSessionId] = useLocalStorage<string | null>(`live_session_id_${spaceId}`, null);
  const [liveMessages, setLiveMessages, removeLiveMessages] = useLocalStorage<any[]>(`live_messages_${spaceId}`, []);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages, append } = useChat({
    api: '/api/chat',
    body: { 
      spaceId, 
      currentUrl, 
      routingContext,
      previewConfig: urlOverrides.preview ? {
        systemPrompt: urlOverrides.systemPrompt,
        language: urlOverrides.language,
        followUpQuestionsEnabled: urlOverrides.followUpQuestionsEnabled,
        matchThreshold: urlOverrides.matchThreshold,
        reasoningEffort: urlOverrides.reasoningEffort,
        verbosity: urlOverrides.verbosity,
      } : undefined
    }, 
    initialMessages: savedMessages,
  });

  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingChannelRef = useRef<any>(null);

  const prevMessagesLength = useRef(messages.length);
  const prevLiveMessagesLength = useRef(liveMessages.length);

  const triggers = config?.triggers || [];
  const parentUrl = urlOverrides.parentUrl || '';
  const triggerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriggeredRef = useRef(false);

  // Transition legacy sessions to the new format if tabs are enabled
  useEffect(() => {
    if (tabsEnabled && conversations.length === 0 && savedMessages.length > 1) {
      const legacyConv = { id: Date.now().toString(), updatedAt: Date.now(), messages: savedMessages, liveSessionId, liveMessages };
      setConversations([legacyConv]);
      setActiveConvId(legacyConv.id);
    }
    if (!tabsEnabled) {
      setMessagesView('chat');
      setActiveTab('messages');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabsEnabled, homeTabEnabled]);

  // Keep `conversations` array strictly synchronized with the current active chat view
  useEffect(() => {
    if (activeConvId && tabsEnabled) {
      setConversations(prev => {
        const exists = prev.find(c => c.id === activeConvId);
        if (exists) {
          return prev.map(c => c.id === activeConvId ? { ...c, messages, liveSessionId, liveMessages, updatedAt: Date.now() } : c);
        } else {
          return [{ id: activeConvId, messages, liveSessionId, liveMessages, updatedAt: Date.now() }, ...prev];
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, liveMessages, liveSessionId]);

  useEffect(() => {
    if (urlOverrides.preview) {
       setIsLeadCaptured(!enableLeadCapture);
    }
  }, [enableLeadCapture, urlOverrides.preview, setIsLeadCaptured]);

  useEffect(() => {
    if (hasTriggeredRef.current || !parentUrl || triggers.length === 0) return;
    if (messages.length > 1 || liveSessionId) return;

    const matchingTrigger = triggers.find((t: any) => parentUrl.includes(t.url_match));
    if (!matchingTrigger) return;

    triggerTimerRef.current = setTimeout(() => {
      if (hasTriggeredRef.current || messages.length > 1 || liveSessionId) return;
      hasTriggeredRef.current = true;

      setIsOpen(prev => {
        if (!prev) playPopSound();
        return true;
      });
      
      setMessages(prev => {
        if (prev.length <= 1) return [{ id: 'init', role: 'assistant', content: matchingTrigger.message }];
        return prev;
      });
    }, matchingTrigger.delay_seconds * 1000);

    return () => { if (triggerTimerRef.current) clearTimeout(triggerTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentUrl]);

  useEffect(() => {
    if (typeof window !== 'undefined') window.parent.postMessage({ type: 'kb-widget-resize', isOpen: isOpen || urlOverrides.preview }, '*');
  }, [isOpen, urlOverrides.preview]);

  useEffect(() => {
    setSavedMessages(messages);
  }, [messages, setSavedMessages]);

  useEffect(() => {
    const isNewMessage = messages.length > prevMessagesLength.current;
    const isNewLiveMessage = liveMessages.length > prevLiveMessagesLength.current;
    
    if (isNewMessage || isNewLiveMessage) {
      const lastMsg = isNewLiveMessage ? liveMessages[liveMessages.length - 1] : messages[messages.length - 1];
      if (lastMsg && lastMsg.role !== 'user' && (!isOpen || document.hidden)) {
        if (!isOpen && !urlOverrides.preview) setUnreadCount(c => c + 1);
        playPopSound();
      }
    }
    prevMessagesLength.current = messages.length;
    prevLiveMessagesLength.current = liveMessages.length;
  }, [messages, liveMessages, isOpen, urlOverrides.preview]);

  useEffect(() => {
    if (!liveSessionId) return;

    const channelName = `session_${liveSessionId}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_messages',
        filter: `session_id=eq.${liveSessionId}`
      }, payload => {
        const newMsg = payload.new as any;
        if (newMsg.role === 'agent') {
          setLiveMessages(prev => [...prev, { id: newMsg.id, role: newMsg.role, content: newMsg.content, created_at: newMsg.created_at }]);
          setIsAgentTyping(false);
        }
      })
      .on('broadcast', { event: 'typing' }, payload => {
        if (payload.payload?.role === 'agent') {
          setIsAgentTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsAgentTyping(false), 3000);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') typingChannelRef.current = channel;
      });

    return () => { 
      supabase.removeChannel(channel); 
      typingChannelRef.current = null;
    };
  }, [liveSessionId, setLiveMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, liveMessages, isOpen, urlOverrides.preview, messagesView, activeTab]);

  const startNewConversation = () => {
    const newId = Date.now().toString();
    setActiveConvId(newId);
    setMessages([initMsg]);
    setLiveSessionId(null);
    setLiveMessages([]);
    setRoutingContext(null);
    setMessagesView('chat');
    setActiveTab('messages');
  };

  const loadConversation = (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setActiveConvId(conv.id);
      setMessages(conv.messages);
      setLiveSessionId(conv.liveSessionId);
      setLiveMessages(conv.liveMessages || []);
      setMessagesView('chat');
    }
  };

  const handleClearChat = () => {
    if (tabsEnabled && activeConvId) {
       setConversations(prev => prev.filter(c => c.id !== activeConvId));
       setMessagesView('list');
    }
    setMessages([initMsg]);
    removeSavedMessages();
    setFeedback({});
    if (enableLeadCapture) removeLeadCaptured();
    setEscalatingId(null);
    removeLiveSessionId();
    removeLiveMessages();
    removeRoutingContext();
  };

  const handleCopy = (text: string, id: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const submitFeedback = async (msgId: string, prompt: string, response: string, rating: 'up' | 'down') => {
    if (feedback[msgId] === rating) return; 
    setFeedback(prev => ({ ...prev, [msgId]: rating }));
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId, messageId: msgId, prompt, response, rating })
      });
    } catch (e) { console.error(e); }
  };

  const handleLeadFormSubmit = async (name: string, email: string) => {
    setIsSubmittingLead(true);
    try {
      await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId, name, email })
      });
      setIsLeadCaptured(true);
    } catch (e) { console.error('Lead capture failed', e); }
    setIsSubmittingLead(false);
  };

  const submitTicket = async (msgId: string, prompt: string, email: string) => {
    if (!email || isSubmittingTicket) return;
    setIsSubmittingTicket(true);
    try {
      const history = messages.filter(m => m.id !== 'init').map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId, email, prompt, history, url: window.location.href })
      });
      
      const data = await res.json();
      if (data.sessionId) {
        setLiveSessionId(data.sessionId);
        const timestamp = new Date().toISOString();
        const notification = agentsOnline ? 'Connecting you to an agent...' : 'Ticket created! We will reply to your email soon.';
        setLiveMessages([
          { id: Date.now().toString(), role: 'system', content: notification, created_at: timestamp },
          { id: (Date.now() + 1).toString(), role: 'user', content: prompt, created_at: timestamp }
        ]);
      }
      setEscalatingId(null);
    } catch (e) { console.error('Ticket failed', e); } finally { setIsSubmittingTicket(false); }
  };

  const handleFileUpload = async (file: File) => {
    if (!liveSessionId) return;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${liveSessionId}/${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('chat_attachments').upload(fileName, file);
      if (error) throw error;

      const { data: publicUrlData } = supabase.storage.from('chat_attachments').getPublicUrl(fileName);
      const fileUrl = publicUrlData.publicUrl;
      const isImage = file.type.startsWith('image/');
      const content = isImage ? `![${file.name}](${fileUrl})` : `[📎 ${file.name}](${fileUrl})`;

      const tempId = Date.now().toString();
      const timestamp = new Date().toISOString();
      setLiveMessages(prev => [...prev, { id: tempId, role: 'user', content, created_at: timestamp }]);

      await fetch('/api/live-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: liveSessionId, role: 'user', content })
      });
    } catch (e) { console.error('File upload failed', e); }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (!activeConvId && tabsEnabled) setActiveConvId(Date.now().toString());

    if (liveSessionId) {
      const userMsg = input.trim();
      const tempId = Date.now().toString();
      const timestamp = new Date().toISOString();
      
      setLiveMessages(prev => [...prev, { id: tempId, role: 'user', content: userMsg, created_at: timestamp }]);
      handleInputChange({ target: { value: '' } } as any);

      try {
        await fetch('/api/live-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: liveSessionId, role: 'user', content: userMsg })
        });
      } catch (e) { console.error("Live message failed", e); }
    } else {
      handleSubmit(e);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleInputChange(e);
    if (liveSessionId && typingChannelRef.current) {
      typingChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { role: 'user' } });
    }
  };

  const handleRoutingSelection = (option: any) => {
    if (!activeConvId && tabsEnabled) setActiveConvId(Date.now().toString());
    setRoutingContext(option.value);
    append({ role: 'user', content: option.label });
  };

  const formatTimeAgo = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
  };

  const showRouting = !routingContext && messages.length === 1 && routingOptions.length > 0 && !liveSessionId;
  const isLeft = (config?.position === 'left');
  const showChatWindow = isOpen || urlOverrides.preview;
  const isLauncherMorphOpen = !urlOverrides.preview && isOpen;

  // The Big Header Component (Shared by Home Tab or Messages list if Home is disabled)
  const GreetingHeader = () => (
    <div className="p-6 shrink-0 relative overflow-hidden" style={{ background: `linear-gradient(145deg, var(--primary-color) 0%, transparent 100%)` }}>
      {/* Avatars */}
      {agentsOnline && teamMembers.length > 0 && (
        <div className="absolute top-5 right-5 flex flex-row-reverse -space-x-reverse -space-x-2">
          {teamMembers.slice(0, 3).map((m: any, i: number) => (
            <div key={i} className="w-8 h-8 rounded-full border-2 border-[var(--bg-primary)] flex items-center justify-center text-[11px] font-bold text-white shadow-sm" style={{ backgroundColor: getAvatarColor(m.email), zIndex: i }}>
              {m.email.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      )}
      
      {/* Bot Logo / Fallback */}
      {botAvatar && <img src={botAvatar} alt="Logo" className="w-12 h-12 rounded-xl mb-6 object-cover shadow-sm bg-white" />}
      
      <h1 className="text-[28px] font-bold text-[var(--text-primary)] mb-1 leading-tight">{greetingTitle}</h1>
      <p className="text-base text-[var(--text-primary)] opacity-80 mb-6">{greetingBody}</p>

      {/* Send Message Card */}
      <button onClick={startNewConversation} className="w-full bg-[var(--bg-primary)] rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all border border-[var(--border-strong)] group active:scale-[0.98]">
        <span className="font-semibold text-[var(--text-primary)]">Send us a message</span>
        <svg className="w-5 h-5 text-[var(--primary-color)] group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  );

  const ChatHeader = () => (
    <div className="p-3.5 flex items-center relative z-10 shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.05)]" style={{ backgroundColor: 'var(--primary-color)', color: '#ffffff' }}>
      {tabsEnabled && (
        <button onClick={() => setMessagesView('list')} className="p-1.5 rounded-md hover:bg-white/20 transition-colors mr-2 outline-none">
          <svg className="w-5 h-5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
        </button>
      )}
      <div className="flex items-center gap-2.5 flex-1">
        {botAvatar && <img src={botAvatar} alt="Avatar" className="w-7 h-7 rounded-full object-cover shadow-sm bg-white" />}
        <div className="flex flex-col">
          <span className="font-semibold text-sm leading-tight">{headerText}</span>
          {descriptionText && <span className="text-[10px] font-medium opacity-90">{descriptionText}</span>}
        </div>
      </div>
      
      {!tabsEnabled && isLeadCaptured && (
        <button aria-label="Clear Chat" onClick={handleClearChat} className="p-2 rounded-md hover:bg-black/10 transition-colors outline-none focus:ring-2" title="Clear Chat">
          <ClearIcon className="w-4 h-4" />
        </button>
      )}

      {!urlOverrides.preview && !tabsEnabled && (
        <button aria-label="Close Chat" onClick={() => setIsOpen(false)} className="p-2 rounded-md hover:bg-black/10 transition-colors outline-none focus:ring-2 ml-1" title="Close Chat">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );

  const HomeTab = () => {
    let blocks = [];
    try {
      blocks = JSON.parse(homeContent || '[]');
      if (!Array.isArray(blocks)) blocks = [];
    } catch (e) {
      blocks = [];
    }

    return (
      <div className="flex flex-col h-full bg-[var(--bg-secondary)] overflow-y-auto">
        <GreetingHeader />
        {blocks.length > 0 && (
          <div className="p-5 flex-1 flex flex-col gap-4">
            {blocks.map((block: any, i: number) => {
              const innerContent = (
                <>
                  {block.imageUrl && (
                    <div className="w-full aspect-[16/9] bg-white overflow-hidden shrink-0">
                      <img src={block.imageUrl} className="w-full h-full object-cover" alt={block.title || 'Image'} />
                    </div>
                  )}
                  {(block.title || block.description) && (
                    <div className="p-4 bg-[var(--bg-secondary)] flex flex-col gap-1.5">
                      {block.title && <h3 className="font-semibold text-[var(--text-primary)] text-[15px] leading-tight">{block.title}</h3>}
                      {block.description && <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{block.description}</p>}
                    </div>
                  )}
                </>
              );

              const cardClasses = "block bg-[var(--bg-primary)] rounded-xl overflow-hidden border border-[var(--border-strong)] shadow-sm hover:shadow-md transition-shadow group";

              if (block.linkUrl) {
                return (
                  <a key={block.id || i} href={block.linkUrl} target="_blank" rel="noopener noreferrer" className={cardClasses}>
                    {innerContent}
                  </a>
                );
              }

              return (
                <div key={block.id || i} className={cardClasses}>
                  {innerContent}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const ConversationsList = () => (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {homeTabEnabled ? (
        <div className="p-5 pb-3 shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-strong)] sticky top-0 z-10 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Messages</h2>
          <button onClick={startNewConversation} className="text-[11px] font-medium text-[var(--primary-color)] bg-[var(--primary-color)]/10 hover:bg-[var(--primary-color)]/20 px-3 py-1.5 rounded-full transition-colors">
            New Chat
          </button>
        </div>
      ) : (
        <GreetingHeader />
      )}

      <div className="flex-1 overflow-y-auto p-5 bg-[var(--bg-secondary)]">
        {conversations.length > 0 ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {homeTabEnabled && <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 px-1">Recent History</div>}
            <div className="flex flex-col gap-2.5">
              {conversations.sort((a,b) => b.updatedAt - a.updatedAt).map(conv => {
                const lastUserMsg = conv.messages.slice().reverse().find(m => m.role === 'user')?.content || 'New Conversation';
                return (
                  <button key={conv.id} onClick={() => loadConversation(conv.id)} className="flex flex-col p-4 bg-[var(--bg-primary)] border border-[var(--border-strong)] rounded-xl transition-colors text-left shadow-sm group hover:border-[var(--primary-color)]">
                     <div className="flex items-center justify-between mb-1.5">
                       <span className="text-[10px] text-[var(--text-secondary)] font-medium group-hover:text-[var(--text-primary)] transition-colors">{formatTimeAgo(conv.updatedAt)}</span>
                       <svg className="w-3.5 h-3.5 text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity group-hover:text-[var(--primary-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                     </div>
                     <span className="text-sm font-medium text-[var(--text-primary)] line-clamp-2 leading-snug">{lastUserMsg}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          homeTabEnabled && (
            <div className="text-center mt-10">
              <p className="text-[var(--text-secondary)] text-sm">No recent messages.</p>
            </div>
          )
        )}
      </div>
    </div>
  );

  const renderChatInterface = () => {
    if (!isLeadCaptured) {
      return <LeadCaptureForm onSubmit={handleLeadFormSubmit} isSubmitting={isSubmittingLead} />;
    }

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-3 flex flex-col bg-[var(--bg-primary)] relative" aria-live="polite" aria-atomic="false">
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <MessageBubble 
                key={msg.id} msg={msg} isUser={msg.role === 'user'} botAvatar={botAvatar}
                primaryColor={primaryColor} agentBubbleColor={agentBubbleColor} userBubbleColor={userBubbleColor} 
                botFontColor={botFontColor} userFontColor={userFontColor}
                isTyping={isLoading && index === messages.length - 1} isLatest={index === messages.length - 1 && liveMessages.length === 0}
                onFollowUpClick={(text: string) => { if (!activeConvId && tabsEnabled) setActiveConvId(Date.now().toString()); append({ role: 'user', content: text }); }} liveSessionId={liveSessionId}
                handleCopy={handleCopy} copiedId={copiedId} submitFeedback={submitFeedback} feedback={feedback}
                userPrompt={index > 0 && messages[index - 1].role === 'user' ? messages[index - 1].content : ''}
                submitTicket={submitTicket} isSubmittingTicket={isSubmittingTicket} escalatingId={escalatingId} setEscalatingId={setEscalatingId} agentsOnline={agentsOnline}
              />
            ))}

            {liveMessages.length > 0 && (
              <div className="flex justify-center my-6 relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-[var(--border-strong)]" /></div>
                <div className="relative flex justify-center"><span className="bg-[var(--bg-primary)] px-3 text-[10px] uppercase font-bold tracking-widest text-[var(--text-secondary)]">Live Chat</span></div>
              </div>
            )}

            {liveMessages.map((msg) => (
              <MessageBubble 
                key={msg.id} msg={msg} isUser={msg.role === 'user'} botAvatar={botAvatar} primaryColor={primaryColor}
                agentBubbleColor={agentBubbleColor} userBubbleColor={userBubbleColor}
                botFontColor={botFontColor} userFontColor={userFontColor} handleCopy={handleCopy} copiedId={copiedId}
                liveSessionId={liveSessionId} agentsOnline={agentsOnline}
              />
            ))}

            {((isLoading && !liveSessionId && messages[messages.length - 1]?.role === 'user') || isAgentTyping) && (
              <div className="flex justify-start animate-in fade-in duration-300">
                 {botAvatar && <img src={botAvatar} alt="Bot Loading" className="w-7 h-7 rounded-full mr-2.5 object-cover flex-shrink-0 mt-0.5 border border-[var(--border-color)] bg-white" />}
                <div 
                  className="px-3 py-2 border border-[var(--border-color)] shadow-sm rounded-2xl rounded-tl-sm flex items-center space-x-1 min-h-[36px]"
                  style={{ backgroundColor: agentBubbleColor || 'var(--msg-bot-bg)' }}
                >
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse opacity-60" style={{ backgroundColor: botFontColor || 'var(--text-secondary)' }} />
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse delay-75 opacity-60" style={{ backgroundColor: botFontColor || 'var(--text-secondary)' }} />
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse delay-150 opacity-60" style={{ backgroundColor: botFontColor || 'var(--text-secondary)' }} />
                </div>
              </div>
            )}

            {error && (
              <div className="flex justify-center my-2">
                <span className="bg-red-50 text-red-600 border border-red-100 px-3 py-2 rounded-lg text-xs shadow-sm">
                  Sorry, an error occurred.
                </span>
              </div>
            )}
          </div>

          {showRouting && (
            <div className="flex flex-col gap-2 mt-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
              {routingOptions.map((option: any) => (
                <button key={option.id} onClick={() => handleRoutingSelection(option)} className="w-full text-left p-3 rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] transition-all shadow-sm group">
                  <span className="font-medium text-[var(--text-primary)] text-sm">{option.label}</span>
                </button>
              ))}
            </div>
          )}

          {!showRouting && messages.length === 1 && showPrompts && suggestedPrompts.length > 0 && !liveSessionId && (
            <>
              <div className="flex-1" />
              <div className="w-full flex flex-wrap justify-center gap-2 mt-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
                {suggestedPrompts.map((prompt: string, index: number) => (
                  <button key={index} onClick={() => { if (!activeConvId && tabsEnabled) setActiveConvId(Date.now().toString()); append({ role: 'user', content: prompt }); }} className="text-[13px] px-4 py-2.5 rounded-full border border-[var(--border-strong)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all shadow-sm text-center leading-tight max-w-full whitespace-normal break-words">
                    {prompt}
                  </button>
                ))}
              </div>
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        <ChatInput 
          input={input} handleInputChange={onInputChange} handleFormSubmit={handleFormSubmit} 
          disabled={(isLoading && !liveSessionId) || showRouting} primaryColor={primaryColor} 
          isLiveChat={!!liveSessionId} onFileUpload={handleFileUpload} inputPlaceholder={inputPlaceholder}
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 pointer-events-none text-[var(--text-primary)] font-sans text-sm" data-theme={urlOverrides.theme || config?.theme} style={{ '--primary-color': primaryColor } as React.CSSProperties}>
      
      <style dangerouslySetInnerHTML={{__html: `:root, html, body, main { background: transparent !important; }`}} />

      {/* Floating Chat Window */}
      <div className={`pointer-events-auto absolute flex flex-col bg-[var(--bg-primary)] overflow-hidden border border-[var(--border-strong)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[0_4px_24px_rgba(0,0,0,0.15)]
        ${isMobile
          ? 'inset-0 rounded-none'
          : `bottom-[104px] w-[calc(100%-48px)] max-w-[420px] h-[calc(100%-120px)] max-h-[720px] rounded-2xl ${isLeft ? 'left-6 origin-bottom-left' : 'right-6 origin-bottom-right'}`
        }
        ${showChatWindow ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-8 pointer-events-none'}
      `}>
        
        {(!tabsEnabled || (activeTab === 'messages' && messagesView === 'chat')) && <ChatHeader />}

        <div className="flex-1 overflow-hidden flex flex-col relative bg-[var(--bg-primary)]">
           {tabsEnabled && homeTabEnabled && activeTab === 'home' && <HomeTab />}
           {tabsEnabled && activeTab === 'messages' && messagesView === 'list' && <ConversationsList />}
           {(!tabsEnabled || (activeTab === 'messages' && messagesView === 'chat')) && renderChatInterface()}
           {tabsEnabled && activeTab === 'help' && <HelpTab spaceId={spaceId} primaryColor={primaryColor} searchPlaceholder={config?.helpSearchPlaceholder || config?.help_search_placeholder} />}
        </div>

        {tabsEnabled && (
          <div className="flex border-t border-[var(--border-strong)] bg-[var(--bg-primary)] p-1.5 shrink-0 z-20 pb-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
            {homeTabEnabled && (
              <button 
                onClick={() => setActiveTab('home')} 
                className={`flex-1 py-2 flex flex-col items-center gap-1.5 rounded-lg transition-all ${activeTab === 'home' ? 'text-[var(--primary-color)] font-semibold' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
              >
                <HomeIcon className="w-5 h-5" />
                <span className="text-[10px]">Home</span>
              </button>
            )}
            <button 
              onClick={() => { setActiveTab('messages'); if (conversations.length > 0) setMessagesView('list'); }} 
              className={`flex-1 py-2 flex flex-col items-center gap-1.5 rounded-lg transition-all ${activeTab === 'messages' ? 'text-[var(--primary-color)] font-semibold' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
            >
              <MessageSquareIcon className="w-5 h-5" />
              <span className="text-[10px]">Messages</span>
            </button>
            <button 
              onClick={() => setActiveTab('help')} 
              className={`flex-1 py-2 flex flex-col items-center gap-1.5 rounded-lg transition-all ${activeTab === 'help' ? 'text-[var(--primary-color)] font-semibold' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
            >
              <HelpCircleIcon className="w-5 h-5" />
              <span className="text-[10px]">Help</span>
            </button>
          </div>
        )}

        {!removeBranding && (
          <div className="py-2.5 text-center text-[10px] text-[var(--text-secondary)] bg-[var(--bg-primary)] flex justify-center items-center shrink-0 z-20 pb-3">
            Powered by 
            <a href="https://heyapoyo.com" target="_blank" rel="noopener noreferrer" className="flex items-center hover:opacity-100 transition-opacity opacity-80">
              <img src="/apoyo.png" alt="Apoyo" className="h-[18px] ml-1.5" />
            </a>
          </div>
        )}
      </div>

      {/* Floating Launcher Button */}
      {(!isMobile || !showChatWindow) && (
        <div className={`pointer-events-auto absolute bottom-6 ${isLeft ? 'left-6' : 'right-6'} w-16 h-16 z-30`}>
          <button 
            onClick={() => { if(!urlOverrides.preview) { setIsOpen(!isOpen); setUnreadCount(0); } }}
            className={`w-full h-full rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.1)] flex items-center justify-center transition-transform hover:scale-105 active:scale-95 relative ${urlOverrides.preview ? 'cursor-default hover:scale-100 active:scale-100' : ''}`}
            style={{ backgroundColor: launcherColor, color: launcherIconColor }}
            aria-label={isLauncherMorphOpen ? "Close Chat" : "Open Chat"}
          >
            {unreadCount > 0 && !showChatWindow && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2" style={{ borderColor: launcherColor }}>
                {unreadCount}
              </span>
            )}
            
            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isLauncherMorphOpen ? 'rotate-0 opacity-100 scale-100' : '-rotate-90 opacity-0 scale-50'}`}>
              <ChevronDownIcon className="w-6 h-6" />
            </div>
            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isLauncherMorphOpen ? 'rotate-90 opacity-0 scale-50' : 'rotate-0 opacity-100 scale-100'}`}>
              <ChatBubbleIcon className="w-7 h-7" />
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
