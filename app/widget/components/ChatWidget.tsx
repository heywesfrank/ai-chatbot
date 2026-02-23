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
  const headerText = urlOverrides.header || config?.header_text || 'Documentation Bot';
  const welcomeMessage = config?.welcome_message || 'How can I help you today?';
  const botAvatar = config?.bot_avatar || null;
  const removeBranding = config?.remove_branding || false;

  const defaultPrompts = ["How do I reset my password?", "Where can I find the documentation?", "How do I contact support?"];
  const showPrompts = urlOverrides.showPrompts !== null ? urlOverrides.showPrompts : (config?.show_prompts ?? true);
  const suggestedPrompts = urlOverrides.prompts !== null ? urlOverrides.prompts : (config?.suggested_prompts || defaultPrompts);

  const initMsg = { id: 'init', role: 'assistant', content: welcomeMessage } as const;
  
  const [savedMessages, setSavedMessages, removeSavedMessages] = useLocalStorage<any[]>(`chat_session_${spaceId}`, [initMsg]);
  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages, append } = useChat({
    api: '/api/chat',
    body: { spaceId }, 
    initialMessages: savedMessages,
  });

  const [liveSessionId, setLiveSessionId, removeLiveSessionId] = useLocalStorage<string | null>(`live_session_id_${spaceId}`, null);
  const [liveMessages, setLiveMessages, removeLiveMessages] = useLocalStorage<any[]>(`live_messages_${spaceId}`, []);

  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingChannelRef = useRef<any>(null);

  const prevMessagesLength = useRef(messages.length);
  const prevLiveMessagesLength = useRef(liveMessages.length);

  // Resize Message to Host iframe
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
          // Include created_at locally
          setLiveMessages(prev => [...prev, { id: newMsg.id, role: newMsg.role, content: newMsg.content, created_at: newMsg.created_at }]);
          setIsAgentTyping(false); // Stop typing indicator
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
        body: JSON.stringify({ spaceId, email, prompt, history })
      });
      
      const data = await res.json();
      if (data.sessionId) {
        setLiveSessionId(data.sessionId);
        const timestamp = new Date().toISOString();
        setLiveMessages([
          { id: Date.now().toString(), role: 'system', content: 'Connecting you to an agent...', created_at: timestamp },
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
      
      // Upload to Supabase Storage
      const { error } = await supabase.storage
        .from('chat_attachments')
        .upload(fileName, file);

      if (error) throw error;

      // Get the public URL
      const { data: publicUrlData } = supabase.storage
        .from('chat_attachments')
        .getPublicUrl(fileName);

      const fileUrl = publicUrlData.publicUrl;
      const isImage = file.type.startsWith('image/');
      
      // Format as Markdown: image preview or simple link
      const content = isImage ? `![${file.name}](${fileUrl})` : `[📎 ${file.name}](${fileUrl})`;

      // Push to UI Optimistically
      const tempId = Date.now().toString();
      const timestamp = new Date().toISOString();
      setLiveMessages(prev => [...prev, { id: tempId, role: 'user', content, created_at: timestamp }]);

      // Persist to Live Chat Table
      await fetch('/api/live-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: liveSessionId, role: 'user', content })
      });

    } catch (e) {
      console.error('File upload failed', e);
    }
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
      } catch (e) {
        console.error("Live message failed", e);
      }
    } else {
      handleSubmit(e);
    }
  };

  // Wrapper for sending user typing events to dashboard
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleInputChange(e);
    if (liveSessionId && typingChannelRef.current) {
      typingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { role: 'user' }
      });
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-0 top-0 left-0 right-0 flex items-center justify-center bg-transparent overflow-hidden" data-theme={urlOverrides.theme}>
        <button 
          onClick={() => { setIsOpen(true); setUnreadCount(0); }}
          className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95 relative"
          style={{ backgroundColor: 'var(--primary-color)' }}
          aria-label="Open Chat"
        >
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
              {unreadCount}
            </span>
          )}
          <ChatBubbleIcon className="w-6 h-6 fill-current text-white" />
        </button>
      </div>
    );
  }

  const Header = () => (
    <div className="p-4 font-medium text-center shadow-sm text-white flex justify-center items-center relative z-10 shrink-0" style={{ backgroundColor: 'var(--primary-color)' }}>
      <div className="flex items-center gap-2">
        {botAvatar && <img src={botAvatar} alt="Avatar" className="w-6 h-6 rounded-full object-cover border border-white/20 shadow-sm" />}
        <span>{headerText}</span>
      </div>
      
      {isLeadCaptured && (
        <button aria-label="Clear Chat" onClick={handleClearChat} className="absolute left-3 p-1.5 rounded-md hover:bg-white/20 text-white/90 hover:text-white transition-colors outline-none focus:ring-2 focus:ring-white/50" title="Clear Chat">
          <ClearIcon className="w-4 h-4" />
        </button>
      )}

      <button aria-label="Close Chat" onClick={() => setIsOpen(false)} className="absolute right-3 p-1.5 rounded-md hover:bg-white/20 text-white/90 hover:text-white transition-colors outline-none focus:ring-2 focus:ring-white/50" title="Close Chat">
        <ChevronDownIcon className="w-5 h-5" />
      </button>
    </div>
  );

  if (!isLeadCaptured) {
    return (
      <div className="flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans text-sm overflow-hidden" data-theme={urlOverrides.theme} style={{ '--primary-color': primaryColor } as React.CSSProperties}>
        <Header />
        <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-300">
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
        {!removeBranding && (
          <div className="py-2 text-center text-[10px] text-[var(--text-secondary)] bg-[var(--bg-secondary)] border-t border-[var(--border-strong)] flex justify-center items-center">
            Powered by <a href="#" target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-[var(--text-primary)] ml-1 transition-colors">Knowledge Bot</a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-[var(--bg-primary)] font-sans text-sm overflow-hidden" data-theme={urlOverrides.theme} style={{ '--primary-color': primaryColor } as React.CSSProperties}>
      <Header />

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-3 flex flex-col bg-[var(--bg-primary)]" aria-live="polite" aria-atomic="false">
        <div className="space-y-4">
          
          {messages.map((msg, index) => (
            <MessageBubble 
              key={msg.id}
              msg={msg}
              isUser={msg.role === 'user'}
              botAvatar={botAvatar}
              primaryColor={primaryColor}
              isTyping={isLoading && index === messages.length - 1}
              liveSessionId={liveSessionId}
              handleCopy={handleCopy}
              copiedId={copiedId}
              submitFeedback={submitFeedback}
              feedback={feedback}
              userPrompt={index > 0 && messages[index - 1].role === 'user' ? messages[index - 1].content : ''}
              submitTicket={submitTicket}
              isSubmittingTicket={isSubmittingTicket}
              escalatingId={escalatingId}
              setEscalatingId={setEscalatingId}
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
              key={msg.id}
              msg={msg}
              isUser={msg.role === 'user'}
              botAvatar={botAvatar}
              primaryColor={primaryColor}
              handleCopy={handleCopy}
              copiedId={copiedId}
              liveSessionId={liveSessionId}
            />
          ))}

          {/* COMBINED Agent & AI Typing Indicator */}
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

        {messages.length === 1 && showPrompts && suggestedPrompts.length > 0 && !liveSessionId && (
          <>
            <div className="flex-1" />
            <div className="w-full flex flex-wrap justify-center gap-2 mt-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
              {suggestedPrompts.map((prompt: string, index: number) => (
                <button
                  key={index}
                  onClick={() => append({ role: 'user', content: prompt })}
                  className="text-[13px] px-4 py-2.5 rounded-full border border-[var(--border-strong)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all shadow-sm text-center leading-tight max-w-full whitespace-normal break-words"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput 
        input={input} 
        handleInputChange={onInputChange} 
        handleFormSubmit={handleFormSubmit} 
        disabled={(isLoading && !liveSessionId)}
        primaryColor={primaryColor} 
        isLiveChat={!!liveSessionId}
        onFileUpload={handleFileUpload}
      />

      {!removeBranding && (
        <div className="py-2 text-center text-[10px] text-[var(--text-secondary)] bg-[var(--bg-secondary)] border-t border-[var(--border-strong)] flex justify-center items-center">
          Powered by <a href="#" target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-[var(--text-primary)] ml-1 transition-colors">Knowledge Bot</a>
        </div>
      )}
    </div>
  );
}
