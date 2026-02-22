// app/widget/components/ChatWidget.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useChat } from 'ai/react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { useSessionStorage } from '@/hooks/useSessionStorage';
import ChatInput from './ChatInput';
import LeadCaptureForm from './LeadCaptureForm';
import MessageBubble from './MessageBubble';
import { ClearIcon } from '@/components/icons';

export default function ChatWidget({ spaceId, config, urlOverrides }: any) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const enableLeadCapture = urlOverrides.leadCapture !== null ? urlOverrides.leadCapture : (config?.lead_capture_enabled ?? false);
  const [isLeadCaptured, setIsLeadCaptured, removeLeadCaptured] = useSessionStorage(`lead_captured_${spaceId}`, !enableLeadCapture);
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
  
  const [savedMessages, setSavedMessages, removeSavedMessages] = useSessionStorage<any[]>(`chat_session_${spaceId}`, [initMsg]);
  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages, append } = useChat({
    api: '/api/chat',
    body: { spaceId }, 
    initialMessages: savedMessages,
  });

  const [liveSessionId, setLiveSessionId, removeLiveSessionId] = useSessionStorage<string | null>(`live_session_id_${spaceId}`, null);
  const [liveMessages, setLiveMessages, removeLiveMessages] = useSessionStorage<{id: string, role: string, content: string}[]>(`live_messages_${spaceId}`, []);

  // Update session storage whenever messages change
  useEffect(() => {
    setSavedMessages(messages);
  }, [messages, setSavedMessages]);

  // Real-time listener for human escalation
  useEffect(() => {
    if (!liveSessionId) return;

    const channel = supabase
      .channel(`realtime:session_${liveSessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_messages',
        filter: `session_id=eq.${liveSessionId}`
      }, payload => {
        const newMsg = payload.new as any;
        if (newMsg.role === 'agent') {
          setLiveMessages(prev => [...prev, { id: newMsg.id, role: newMsg.role, content: newMsg.content }]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [liveSessionId, setLiveMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, liveMessages]);

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

  const handleLeadSubmit = async (name: string, email: string) => {
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
        body: JSON.stringify({ spaceId, email, prompt, history })
      });
      
      const data = await res.json();
      if (data.sessionId) {
        setLiveSessionId(data.sessionId);
        // Inject system message to represent escalation state cleanly in history
        setLiveMessages([
          { id: Date.now().toString(), role: 'system', content: 'Connecting you to an agent...' },
          { id: (Date.now() + 1).toString(), role: 'user', content: prompt }
        ]);
      }
      setEscalatingId(null);
    } catch (e) { 
      console.error('Ticket failed', e); 
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (liveSessionId) {
      const userMsg = input.trim();
      const tempId = Date.now().toString();
      
      setLiveMessages(prev => [...prev, { id: tempId, role: 'user', content: userMsg }]);
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

  if (!isLeadCaptured) {
    return (
      <LeadCaptureForm 
        primaryColor={primaryColor}
        botAvatar={botAvatar}
        headerText={headerText}
        removeBranding={removeBranding}
        handleLeadSubmit={handleLeadSubmit}
        isSubmittingLead={isSubmittingLead}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white font-sans text-sm" style={{ '--primary-color': primaryColor } as React.CSSProperties}>
      <div className="p-4 font-medium text-center shadow-sm text-white flex justify-center items-center relative z-10" style={{ backgroundColor: 'var(--primary-color)' }}>
        <div className="flex items-center gap-2">
          {botAvatar && <img src={botAvatar} alt="Avatar" className="w-6 h-6 rounded-full object-cover border border-white/20 shadow-sm" />}
          <span>{headerText}</span>
        </div>
        <button aria-label="Clear Chat" onClick={handleClearChat} className="absolute right-3 p-2 rounded-md hover:bg-white/20 text-white/90 hover:text-white transition-colors outline-none focus:ring-2 focus:ring-white/50" title="Clear Chat">
          <ClearIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-3 flex flex-col" aria-live="polite" aria-atomic="false">
        <div className="space-y-4">
          
          {/* Main AI Messages */}
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

          {/* Live Chat Divider */}
          {liveMessages.length > 0 && (
            <div className="flex justify-center my-6 relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-gray-100" /></div>
              <div className="relative flex justify-center"><span className="bg-white px-3 text-[10px] uppercase font-bold tracking-widest text-gray-400">Live Chat</span></div>
            </div>
          )}

          {/* Realtime Live Messages */}
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

          {isLoading && !liveSessionId && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex justify-start">
               {botAvatar && <img src={botAvatar} alt="Bot Loading" className="w-7 h-7 rounded-full mr-2.5 object-cover flex-shrink-0 mt-0.5 border border-gray-100" />}
              <div className="px-3 py-2 border border-gray-200 bg-white shadow-sm rounded-md flex items-center space-x-1 min-h-[36px]">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse delay-75" />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse delay-150" />
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center my-2">
              <span className="bg-red-50 text-red-600 border border-red-100 px-3 py-2 rounded-sm text-xs shadow-sm">
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
                  className="text-[13px] px-4 py-2.5 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all shadow-sm text-center leading-tight max-w-full whitespace-normal break-words"
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
        handleInputChange={handleInputChange} 
        handleFormSubmit={handleFormSubmit} 
        disabled={isLoading && !liveSessionId}
        primaryColor={primaryColor} 
      />

      {!removeBranding && (
        <div className="py-2 text-center text-[10px] text-gray-400 bg-gray-50 border-t border-gray-100 flex justify-center items-center">
          Powered by <a href="#" target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-500 hover:text-gray-800 ml-1 transition-colors">Knowledge Bot</a>
        </div>
      )}
    </div>
  );
}
