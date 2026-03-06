// app/widget/components/ChatWidget.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useChat } from 'ai/react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { playPopSound } from '../utils';

import ChatHeader from './ChatHeader';
import HomeTab from './HomeTab';
import ConversationsList from './ConversationsList';
import ChatInterface from './ChatInterface';
import HelpTab from './HelpTab';

import { ChatBubbleIcon, ChevronDownIcon, MessageSquareIcon, HelpCircleIcon, HomeIcon } from '@/components/icons';

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

  const homeTabEnabled = urlOverrides.homeTabEnabled !== null ? urlOverrides.homeTabEnabled : (config?.homeTabEnabled ?? config?.home_tab_enabled ?? false);
  const greetingTitle = urlOverrides.greetingTitle || config?.greetingTitle || config?.greeting_title || 'Hello there.';
  const greetingBody = urlOverrides.greetingBody || config?.greetingBody || config?.greeting_body || 'How can we help you today?';
  const homeContent = urlOverrides.homeContent || config?.homeContent || config?.home_content || '';

  const currentUrl = enablePageContext ? (urlOverrides.parentUrl || (typeof window !== 'undefined' ? window.location.href : '')) : undefined;

  const defaultPrompts = ["How do I reset my password?", "Where can I find the documentation?", "How do I contact support?"];
  const showPrompts = urlOverrides.showPrompts !== null ? urlOverrides.showPrompts : (config?.showPrompts ?? config?.show_prompts ?? true);
  const suggestedPrompts = urlOverrides.prompts !== null ? urlOverrides.prompts : (config?.suggestedPrompts || config?.suggested_prompts || defaultPrompts);

  const initMsg = { id: 'init', role: 'assistant', content: welcomeMessage } as const;

  const [conversations, setConversations] = useLocalStorage<Conversation[]>(`conversations_${spaceId}`, []);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'home' | 'messages' | 'help'>(tabsEnabled && homeTabEnabled ? 'home' : 'messages');
  const [messagesView, setMessagesView] = useState<'list' | 'chat'>(tabsEnabled ? 'list' : 'chat');

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

  useEffect(() => {
    if (tabsEnabled && conversations.length === 0 && savedMessages.length > 1) {
      const legacyConv = { id: crypto.randomUUID(), updatedAt: Date.now(), messages: savedMessages, liveSessionId, liveMessages };
      setConversations([legacyConv]);
      setActiveConvId(legacyConv.id);
    }
    if (!tabsEnabled) {
      setMessagesView('chat');
      setActiveTab('messages');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabsEnabled, homeTabEnabled]);

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

  const startNewConversation = () => {
    const newId = crypto.randomUUID();
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
          { id: crypto.randomUUID(), role: 'system', content: notification, created_at: timestamp },
          { id: crypto.randomUUID(), role: 'user', content: prompt, created_at: timestamp }
        ]);
      }
      setEscalatingId(null);
    } catch (e) { console.error('Ticket failed', e); } finally { setIsSubmittingTicket(false); }
  };

  const handleFileUpload = async (file: File) => {
    if (!liveSessionId) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', liveSessionId);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.error || 'Failed to upload file');
      }

      const { fileUrl } = await uploadRes.json();
      const isImage = file.type.startsWith('image/');
      const content = isImage ? `![${file.name}](${fileUrl})` : `[📎 ${file.name}](${fileUrl})`;

      const tempId = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      setLiveMessages(prev => [...prev, { id: tempId, role: 'user', content, created_at: timestamp }]);

      await fetch('/api/live-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: liveSessionId, role: 'user', content })
      });
    } catch (e: any) { 
      console.error('File upload failed', e); 
      alert(e.message || 'File upload failed'); 
    }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (!activeConvId && tabsEnabled) setActiveConvId(crypto.randomUUID());

    if (liveSessionId) {
      const userMsg = input.trim();
      const tempId = crypto.randomUUID();
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
    if (!activeConvId && tabsEnabled) setActiveConvId(crypto.randomUUID());
    setRoutingContext(option.value);
    append({ role: 'user', content: option.label });
  };

  const handlePromptClick = (text: string) => {
    if (!activeConvId && tabsEnabled) setActiveConvId(crypto.randomUUID());
    append({ role: 'user', content: text });
  };

  const handleFollowUpClick = (text: string) => {
    if (!activeConvId && tabsEnabled) setActiveConvId(crypto.randomUUID());
    append({ role: 'user', content: text });
  };

  const showRouting = !routingContext && messages.length === 1 && routingOptions.length > 0 && !liveSessionId;

  // Synchronize perfectly with DB layout over URL overrides to prevent layout jitter
  const positionPref = urlOverrides.preview && urlOverrides.position 
    ? urlOverrides.position 
    : (config?.position || urlOverrides.position || 'right');
  const isLeft = positionPref === 'left';
  
  const showChatWindow = isOpen || urlOverrides.preview;
  const isLauncherMorphOpen = !urlOverrides.preview && isOpen;

  const greetingProps = {
    agentsOnline, teamMembers, botAvatar, greetingTitle, greetingBody, startNewConversation
  };

  const chatInterfaceProps = {
    isLeadCaptured, handleLeadFormSubmit, isSubmittingLead,
    messages, liveMessages, botAvatar, primaryColor, agentBubbleColor, userBubbleColor, botFontColor, userFontColor,
    isLoading, isAgentTyping, error, liveSessionId, escalatingId, setEscalatingId, isSubmittingTicket, agentsOnline,
    showRouting, routingOptions, handleRoutingSelection, showPrompts, suggestedPrompts, onPromptClick: handlePromptClick, onFollowUpClick: handleFollowUpClick,
    input, onInputChange, handleFormSubmit, handleFileUpload, inputPlaceholder, handleCopy, copiedId, submitFeedback, feedback, submitTicket, messagesEndRef
  };

  return (
    <div className="fixed inset-0 pointer-events-none text-[var(--text-primary)] font-sans text-sm" data-theme={urlOverrides.theme || config?.theme} style={{ '--primary-color': primaryColor } as React.CSSProperties}>
      
      <style dangerouslySetInnerHTML={{__html: `:root, html, body, main { background: transparent !important; }`}} />

      {/* Floating Chat Window */}
      <div className={`pointer-events-auto absolute flex flex-col bg-[var(--bg-primary)] overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
        ${isMobile && !urlOverrides.preview
          ? 'inset-0 rounded-none border-none'
          : `${isMobile ? 'bottom-[96px]' : 'bottom-[104px]'} ${isMobile ? 'w-[calc(100%-32px)]' : 'w-[calc(100%-48px)]'} max-w-[420px] ${isMobile ? 'h-[calc(100%-112px)]' : 'h-[calc(100%-120px)]'} max-h-[750px] rounded-2xl border border-[var(--border-strong)] shadow-[0_4px_24px_rgba(0,0,0,0.15)] ${isLeft ? (isMobile ? 'left-4 origin-bottom-left' : 'left-6 origin-bottom-left') : (isMobile ? 'right-4 origin-bottom-right' : 'right-6 origin-bottom-right')}`
        }
        ${showChatWindow ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-8 pointer-events-none'}
      `}>
        
        {(!tabsEnabled || (activeTab === 'messages' && messagesView === 'chat')) && (
          <ChatHeader 
            tabsEnabled={tabsEnabled} setMessagesView={setMessagesView} botAvatar={botAvatar} 
            headerText={headerText} descriptionText={descriptionText} isLeadCaptured={isLeadCaptured} 
            handleClearChat={handleClearChat} urlOverrides={urlOverrides} setIsOpen={setIsOpen} 
          />
        )}

        <div className="flex-1 overflow-hidden flex flex-col relative bg-[var(--bg-primary)]">
           {tabsEnabled && homeTabEnabled && activeTab === 'home' && (
             <HomeTab homeContent={homeContent} greetingProps={greetingProps} />
           )}
           {tabsEnabled && activeTab === 'messages' && messagesView === 'list' && (
             <ConversationsList 
               homeTabEnabled={homeTabEnabled} startNewConversation={startNewConversation} 
               conversations={conversations} loadConversation={loadConversation} greetingProps={greetingProps} 
             />
           )}
           {(!tabsEnabled || (activeTab === 'messages' && messagesView === 'chat')) && (
             <ChatInterface {...chatInterfaceProps} />
           )}
           {tabsEnabled && activeTab === 'help' && (
             <HelpTab spaceId={spaceId} primaryColor={primaryColor} searchPlaceholder={config?.helpSearchPlaceholder || config?.help_search_placeholder} />
           )}
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
            <a 
              href={urlOverrides.preview ? '/premium' : 'https://app.heyapoyo.com'} 
              target={urlOverrides.preview ? '_parent' : '_blank'} 
              rel="noopener noreferrer" 
              className="flex items-center hover:opacity-100 transition-opacity opacity-80"
            >
              <img src="/apoyo.png" alt="Apoyo" className="h-[18px] ml-1.5" />
            </a>
          </div>
        )}
      </div>

      {/* Floating Launcher Button */}
      {(!isMobile || !showChatWindow || urlOverrides.preview) && (
        <div className={`pointer-events-auto absolute ${isMobile ? 'bottom-4' : 'bottom-6'} ${isLeft ? (isMobile ? 'left-4' : 'left-6') : (isMobile ? 'right-4' : 'right-6')} w-16 h-16 z-30`}>
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
