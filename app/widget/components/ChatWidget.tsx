// app/widget/components/ChatWidget.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useChat } from 'ai/react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';
import { ClearIcon, ChatBubbleIcon, ChevronDownIcon, LeadIcon } from '@/components/icons';

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

export default function ChatWidget({ spaceId, config, urlOverrides }: any) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [isOpen, setIsOpen] = useState(urlOverrides.preview ? true : false);
  const [unreadCount, setUnreadCount] = useState(0);

  const enableLeadCapture = urlOverrides.leadCapture !== null ? urlOverrides.leadCapture : (config?.lead_capture_enabled ?? false);
  const [isLeadCaptured, setIsLeadCaptured, removeLeadCaptured] = useLocalStorage(`lead_captured_${spaceId}`, !enableLeadCapture);
  
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);

  const [escalatingId, setEscalatingId] = useState<string | null>(null);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  
  const primaryColor = urlOverrides.color || config?.primary_color || '#000000';
  const botFontColor = urlOverrides.botFontColor || config?.bot_font_color || '#1f2937';
  const userFontColor = urlOverrides.userFontColor || config?.user_font_color || '#ffffff';
  
  const headerText = urlOverrides.header || config?.header_text || 'Documentation Bot';
  const descriptionText = urlOverrides.description || config?.description_text || '';
  const welcomeMessage = config?.welcome_message || 'How can I help you today?';
  const inputPlaceholder = urlOverrides.placeholder || config?.input_placeholder || 'Ask a question...';
  const removeBranding = urlOverrides.removeBranding !== null ? urlOverrides.removeBranding : (config?.remove_branding ?? false);
  
  const botAvatar = config?.bot_avatar || null;
  const agentsOnline = config?.agents_online ?? false;
  
  const enablePageContext = config?.page_context_enabled ?? false;
  const routingOptions = config?.routing_config || [];

  const currentUrl = enablePageContext ? (urlOverrides.parentUrl || (typeof window !== 'undefined' ? window.location.href : '')) : undefined;

  const defaultPrompts = ["How do I reset my password?", "Where can I find the documentation?", "How do I contact support?"];
  const showPrompts = urlOverrides.showPrompts !== null ? urlOverrides.showPrompts : (config?.show_prompts ?? true);
  const suggestedPrompts = urlOverrides.prompts !== null ? urlOverrides.prompts : (config?.suggested_prompts || defaultPrompts);

  const initMsg = { id: 'init', role: 'assistant', content: welcomeMessage } as const;
  
  const [savedMessages, setSavedMessages, removeSavedMessages] = useLocalStorage<any[]>(`chat_session_${spaceId}`, [initMsg]);
  const [routingContext, setRoutingContext, removeRoutingContext] = useLocalStorage<string | null>(`routing_context_${spaceId}`, null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages, append } = useChat({
    api: '/api/chat',
    body: { spaceId, currentUrl, routingContext }, 
    initialMessages: savedMessages,
  });

  const [liveSessionId, setLiveSessionId, removeLiveSessionId] = useLocalStorage<string | null>(`live_session_id_${spaceId}`, null);
  const [liveMessages, setLiveMessages, removeLiveMessages] = useLocalStorage<any[]>(`live_messages_${spaceId}`, []);

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
        if (prev.length <= 1) {
          return [...prev, { id: Date.now().toString(), role: 'assistant', content: matchingTrigger.message }];
        }
        return prev;
      });

    }, matchingTrigger.delay_seconds * 1000);

    return () => {
      if (triggerTimerRef.current) clearTimeout(triggerTimerRef.current);
    };
  }, [parentUrl]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.parent.postMessage({ type: 'kb-widget-resize', isOpen }, '*');
    }
  }, [isOpen]);

  useEffect(() => {
    setSavedMessages(messages);
  }, [messages, setSavedMessages]);

  useEffect(() => {
    const isNewMessage = messages.length > prevMessagesLength.current;
    const isNewLiveMessage = liveMessages.length > prevLiveMessagesLength.current;
    
    if (isNewMessage || isNewLiveMessage) {
      const lastMsg = isNewLiveMessage ? liveMessages[liveMessages.length - 1] : messages[messages.length - 1];
      if (lastMsg && lastMsg.role !== 'user' && (!isOpen || document.hidden)) {
        if (!isOpen) setUnreadCount(c => c + 1);
        playPopSound();
      }
    }
    prevMessagesLength.current = messages.length;
    prevLiveMessagesLength.current = liveMessages.length;
  }, [messages, liveMessages, isOpen]);

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
  }, [messages, liveMessages, isOpen]);

  const handleClearChat = () => {
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

  const handleLeadFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingLead(true);
    try {
      await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId, name: leadName, email: leadEmail })
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
    } catch (e) { 
      console.error('Ticket failed', e); 
    } finally {
      setIsSubmittingTicket(false);
    }
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
    setRoutingContext(option.value);
    append({ role: 'user', content: option.label });
  };

  const showRouting = !routingContext && messages.length === 1 && routingOptions.length > 0 && !liveSessionId;

  const Header = () => (
    <div className="p-4 shadow-sm text-white flex justify-center items-center relative z-10 shrink-0" style={{ backgroundColor: 'var(--primary-color)', color: userFontColor || '#ffffff' }}>
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2">
          {botAvatar && <img src={botAvatar} alt="Avatar" className="w-6 h-6 rounded-full object-cover border border-white/20 shadow-sm" />}
          <span className="font-medium text-sm">{headerText}</span>
        </div>
        {descriptionText && (
          <span className="text-[10px] font-medium opacity-90 mt-0.5">{descriptionText}</span>
        )}
      </div>
      
      {isLeadCaptured && (
        <button aria-label="Clear Chat" onClick={handleClearChat} className="absolute left-3 p-1.5 rounded-md hover:bg-black/10 transition-colors outline-none focus:ring-2" title="Clear Chat">
          <ClearIcon className="w-4 h-4" />
        </button>
      )}

      {/* Hide close button on desktop so the user clicks the launcher. Fallback visible on mobile. */}
      <button aria-label="Close Chat" onClick={() => setIsOpen(false)} className="sm:hidden absolute right-3 p-1.5 rounded-md hover:bg-black/10 transition-colors outline-none focus:ring-2" title="Close Chat">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );

  const renderBodyContent = () => {
    if (!isLeadCaptured) {
      return (
        <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-4 border border-[var(--border-color)]">
            <LeadIcon className="w-5 h-5 text-[var(--text-secondary)]" />
          </div>
          <h3 className="text-base font-medium text-[var(--text-primary)] mb-1">Let's get started</h3>
          <p className="text-xs text-[var(--text-secondary)] text-center mb-6 max-w-[250px]">Please enter your details so we can assist you better and follow up if needed.</p>
          
          <form onSubmit={handleLeadFormSubmit} className="w-full max-w-[280px] space-y-3">
            <div>
              <input aria-label="Your Name" type="text" required placeholder="Your Name" className="w-full p-2.5 border border-[var(--border-strong)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-md focus:outline-none focus:ring-2 transition-all text-sm shadow-sm" style={{ '--tw-ring-color': 'var(--primary-color)' } as any} value={leadName} onChange={e => setLeadName(e.target.value)} />
            </div>
            <div>
              <input aria-label="Your Email" type="email" required placeholder="Your Email" className="w-full p-2.5 border border-[var(--border-strong)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-md focus:outline-none focus:ring-2 transition-all text-sm shadow-sm" style={{ '--tw-ring-color': 'var(--primary-color)' } as any} value={leadEmail} onChange={e => setLeadEmail(e.target.value)} />
            </div>
            <button aria-label="Start Chat" type="submit" disabled={isSubmittingLead} className="w-full text-white py-3 rounded-md hover:opacity-90 transition-all font-medium shadow-sm mt-2 disabled:opacity-50 active:scale-95" style={{ backgroundColor: 'var(--primary-color)' }}>
              {isSubmittingLead ? 'Starting chat...' : 'Start Chat'}
            </button>
          </form>
        </div>
      );
    }

    return (
      <>
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-3 flex flex-col bg-[var(--bg-primary)]" aria-live="polite" aria-atomic="false">
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <MessageBubble 
                key={msg.id} msg={msg} isUser={msg.role === 'user'} botAvatar={botAvatar}
                primaryColor={primaryColor} botFontColor={botFontColor} userFontColor={userFontColor}
                isTyping={isLoading && index === messages.length - 1} isLatest={index === messages.length - 1 && liveMessages.length === 0}
                onFollowUpClick={(text: string) => append({ role: 'user', content: text })} liveSessionId={liveSessionId}
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
                botFontColor={botFontColor} userFontColor={userFontColor} handleCopy={handleCopy} copiedId={copiedId}
                liveSessionId={liveSessionId} agentsOnline={agentsOnline}
              />
            ))}

            {((isLoading && !liveSessionId && messages[messages.length - 1]?.role === 'user') || isAgentTyping) && (
              <div className="flex justify-start animate-in fade-in duration-300">
                 {botAvatar && <img src={botAvatar} alt="Bot Loading" className="w-7 h-7 rounded-full mr-2.5 object-cover flex-shrink-0 mt-0.5 border border-[var(--border-color)]" />}
                <div className="px-3 py-2 border border-[var(--border-color)] bg-[var(--msg-bot-bg)] shadow-sm rounded-2xl rounded-tl-sm flex items-center space-x-1 min-h-[36px]">
                  <div className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full animate-pulse" />
                  <div className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full animate-pulse delay-75" />
                  <div className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full animate-pulse delay-150" />
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
                  <button key={index} onClick={() => append({ role: 'user', content: prompt })} className="text-[13px] px-4 py-2.5 rounded-full border border-[var(--border-strong)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all shadow-sm text-center leading-tight max-w-full whitespace-normal break-words">
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
      </>
    );
  };

  const position = config?.position || 'right';
  const launcherHorizontalClasses = position === 'left' ? 'left-[22px]' : 'right-[22px]';

  return (
    <div className="fixed inset-0 flex flex-col pointer-events-none" data-theme={urlOverrides.theme} style={{ '--primary-color': primaryColor } as React.CSSProperties}>
      
      {/* Active Floating Chat Window */}
      {isOpen && (
        <div className="pointer-events-auto absolute top-[16px] bottom-[90px] left-[16px] right-[16px] flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans text-sm overflow-hidden rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.16)] border border-[var(--border-strong)] z-20 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-300 origin-bottom">
           <Header />
           {renderBodyContent()}
           {!removeBranding && (
            <div className="py-2 text-center text-[10px] text-[var(--text-secondary)] bg-[var(--bg-secondary)] border-t border-[var(--border-strong)] flex justify-center items-center shrink-0">
              Powered by <a href="#" target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-[var(--text-primary)] ml-1 transition-colors">Knowledge Bot</a>
            </div>
           )}
        </div>
      )}

      {/* Floating Launcher Button */}
      <div className={`pointer-events-auto absolute bottom-[22px] ${launcherHorizontalClasses} z-30 flex`}>
        <button 
          onClick={() => { setIsOpen(!isOpen); setUnreadCount(0); }}
          className="w-14 h-14 rounded-full shadow-[0_6px_24px_rgba(0,0,0,0.25)] flex items-center justify-center transition-transform hover:scale-105 active:scale-95 relative"
          style={{ backgroundColor: 'var(--primary-color)', color: userFontColor || '#ffffff' }}
          aria-label={isOpen ? "Close Chat" : "Open Chat"}
        >
          {unreadCount > 0 && !isOpen && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2" style={{ borderColor: 'var(--primary-color)' }}>
              {unreadCount}
            </span>
          )}
          {isOpen ? (
            <ChevronDownIcon className="w-6 h-6" />
          ) : (
            <ChatBubbleIcon className="w-7 h-7" />
          )}
        </button>
      </div>
    </div>
  );
}
