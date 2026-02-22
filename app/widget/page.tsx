'use client';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from 'ai/react';

const flattenText = (node: any): string => {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(flattenText).join('');
  if (node && typeof node === 'object' && node.props && node.props.children) {
    return flattenText(node.props.children);
  }
  return '';
};

export default function WidgetWrapper() {
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  
  const [urlOverrides, setUrlOverrides] = useState<{
    color: string;
    header: string;
    showPrompts: boolean | null;
    prompts: string[] | null;
    leadCapture: boolean | null;
  }>({ color: '', header: '', showPrompts: null, prompts: null, leadCapture: null });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sid = urlParams.get('spaceId');
    const showPromptsParam = urlParams.get('showPrompts');
    const promptsParam = urlParams.get('prompts');
    const leadCaptureParam = urlParams.get('leadCapture');

    let parsedPrompts = null;
    if (promptsParam) {
      try { parsedPrompts = JSON.parse(promptsParam); } catch (e) { console.error(e); }
    }

    setSpaceId(sid);
    setUrlOverrides({
      color: urlParams.get('color') || '',
      header: urlParams.get('header') || '',
      showPrompts: showPromptsParam !== null ? showPromptsParam === 'true' : null,
      prompts: parsedPrompts,
      leadCapture: leadCaptureParam !== null ? leadCaptureParam === 'true' : null
    });

    if (sid) {
      fetch(`/api/widget-config?spaceId=${sid}`)
        .then(res => res.json())
        .then(data => {
          if (data.config) setConfig(data.config);
          setLoadingConfig(false);
        })
        .catch(() => setLoadingConfig(false));
    } else {
      setLoadingConfig(false);
    }
  }, []);

  if (loadingConfig) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="flex space-x-1">
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse" />
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse delay-75" />
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse delay-150" />
        </div>
      </div>
    );
  }

  return <ChatWidget spaceId={spaceId} config={config} urlOverrides={urlOverrides} />;
}

function ChatWidget({ spaceId, config, urlOverrides }: { spaceId: string | null, config: any, urlOverrides: any }) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Lead Capture State
  const enableLeadCapture = urlOverrides.leadCapture !== null ? urlOverrides.leadCapture : (config?.lead_capture_enabled ?? false);
  const [isLeadCaptured, setIsLeadCaptured] = useState(true);
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);

  // Human Escalation State
  const [escalatingId, setEscalatingId] = useState<string | null>(null);
  const [escalationEmail, setEscalationEmail] = useState('');
  const [escalatedIds, setEscalatedIds] = useState<Record<string, boolean>>({});
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  
  const primaryColor = urlOverrides.color || config?.primary_color || '#000000';
  const headerText = urlOverrides.header || config?.header_text || 'Documentation Bot';
  const welcomeMessage = config?.welcome_message || 'How can I help you today?';
  const botAvatar = config?.bot_avatar || null;
  const removeBranding = config?.remove_branding || false;

  const defaultPrompts = ["How do I reset my password?", "Where can I find the documentation?", "How do I contact support?"];
  const showPrompts = urlOverrides.showPrompts !== null ? urlOverrides.showPrompts : (config?.show_prompts ?? true);
  const suggestedPrompts = urlOverrides.prompts !== null ? urlOverrides.prompts : (config?.suggested_prompts || defaultPrompts);

  const storageKey = `chat_session_${spaceId}`;
  const leadStorageKey = `lead_captured_${spaceId}`;
  const initMsg = { id: 'init', role: 'assistant', content: welcomeMessage } as const;

  const getInitialMessages = () => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {}
      }
    }
    return [initMsg];
  };

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages, append } = useChat({
    api: '/api/chat',
    body: { spaceId }, 
    initialMessages: getInitialMessages(),
  });

  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  useEffect(() => {
    if (enableLeadCapture && typeof window !== 'undefined') {
      setIsLeadCaptured(!!sessionStorage.getItem(leadStorageKey));
    } else {
      setIsLeadCaptured(true);
    }
  }, [enableLeadCapture, spaceId]);

  const handleClearChat = () => {
    setMessages([initMsg]);
    sessionStorage.removeItem(storageKey);
    setFeedback({});
    
    // Reset lead capture if enabled
    if (enableLeadCapture) {
      sessionStorage.removeItem(leadStorageKey);
      setIsLeadCaptured(false);
      setLeadName('');
      setLeadEmail('');
    }
    
    // Reset active escalation states
    setEscalatingId(null);
    setEscalatedIds({});
    setEscalationEmail('');
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

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingLead(true);
    try {
      await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId, name: leadName, email: leadEmail })
      });
      sessionStorage.setItem(leadStorageKey, 'true');
      setIsLeadCaptured(true);
    } catch (e) { console.error('Lead capture failed', e); }
    setIsSubmittingLead(false);
  };

  const submitTicket = async (msgId: string, prompt: string) => {
    if (!escalationEmail || isSubmittingTicket) return;
    setIsSubmittingTicket(true);
    try {
      await fetch('/api/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId, email: escalationEmail, prompt })
      });
      setEscalatedIds(prev => ({ ...prev, [msgId]: true }));
      setEscalatingId(null);
      setEscalationEmail(''); // Clear out the email input after successful submission
    } catch (e) { 
      console.error('Ticket failed', e); 
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  // --- PRE-CHAT CAPTURE VIEW ---
  if (!isLeadCaptured) {
    return (
      <div className="flex flex-col h-screen bg-white font-sans text-sm" style={{ '--primary-color': primaryColor } as React.CSSProperties}>
        <div className="p-4 font-medium text-center shadow-sm text-white flex justify-center items-center" style={{ backgroundColor: 'var(--primary-color)' }}>
          <div className="flex items-center gap-2">
            {botAvatar && <img src={botAvatar} alt="Avatar" className="w-6 h-6 rounded-full object-cover border border-white/20 shadow-sm" />}
            <span>{headerText}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-300">
          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          </div>
          <h3 className="text-base font-medium text-gray-900 mb-1">Let's get started</h3>
          <p className="text-xs text-gray-500 text-center mb-6 max-w-[250px]">Please enter your details so we can assist you better and follow up if needed.</p>
          
          <form onSubmit={handleLeadSubmit} className="w-full max-w-[280px] space-y-3">
            <div>
              <input type="text" required placeholder="Your Name" className="w-full p-2.5 border border-gray-200 rounded-sm focus:outline-none transition-colors text-sm bg-gray-50/50 text-gray-800" value={leadName} onChange={e => setLeadName(e.target.value)} />
            </div>
            <div>
              <input type="email" required placeholder="Your Email" className="w-full p-2.5 border border-gray-200 rounded-sm focus:outline-none transition-colors text-sm bg-gray-50/50 text-gray-800" value={leadEmail} onChange={e => setLeadEmail(e.target.value)} />
            </div>
            <button type="submit" disabled={isSubmittingLead} className="w-full text-white py-2.5 rounded-sm hover:opacity-90 transition-opacity font-medium shadow-sm mt-2 disabled:opacity-50" style={{ backgroundColor: 'var(--primary-color)' }}>
              {isSubmittingLead ? 'Starting chat...' : 'Start Chat'}
            </button>
          </form>
        </div>
        {!removeBranding && (
          <div className="py-2 text-center text-[10px] text-gray-400 bg-gray-50 border-t border-gray-100 flex justify-center items-center">
            Powered by <a href="#" target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-500 hover:text-gray-800 ml-1 transition-colors">Knowledge Bot</a>
          </div>
        )}
      </div>
    );
  }

  // --- MAIN CHAT VIEW ---
  return (
    <div className="flex flex-col h-screen bg-white font-sans text-sm" style={{ '--primary-color': primaryColor } as React.CSSProperties}>
      <div className="p-4 font-medium text-center shadow-sm text-white flex justify-center items-center relative z-10" style={{ backgroundColor: 'var(--primary-color)' }}>
        <div className="flex items-center gap-2">
          {botAvatar && <img src={botAvatar} alt="Avatar" className="w-6 h-6 rounded-full object-cover border border-white/20 shadow-sm" />}
          <span>{headerText}</span>
        </div>
        <button onClick={handleClearChat} className="absolute right-3 p-2 rounded-md hover:bg-white/20 text-white/90 hover:text-white transition-colors outline-none focus:ring-2 focus:ring-white/50" title="Clear Chat">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-3 flex flex-col" aria-live="polite" aria-atomic="false">
        <div className="space-y-4">
          {messages.map((msg, index) => {
            const userPrompt = index > 0 && messages[index - 1].role === 'user' ? messages[index - 1].content : '';
            const isTyping = isLoading && index === messages.length - 1;

            return (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && botAvatar && (
                  <img src={botAvatar} alt="Bot" className="w-7 h-7 rounded-full mr-2.5 object-cover flex-shrink-0 mt-0.5 border border-gray-100" />
                )}
                
                <div className={`flex flex-col gap-1 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div 
                    className={`px-3 py-2 rounded-md leading-relaxed break-words shadow-sm w-full ${msg.role === 'user' ? 'text-white' : 'border border-gray-200 bg-white text-gray-800'}`}
                    style={msg.role === 'user' ? { backgroundColor: 'var(--primary-color)' } : {}}
                  >
                    {msg.role === 'user' ? msg.content : (
                      <ReactMarkdown 
                        className="prose prose-sm max-w-none prose-p:my-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-a:text-blue-600"
                        components={{
                          pre: ({ children, ...props }) => {
                            const codeText = flattenText(children);
                            return (
                              <div className="relative group/code my-2">
                                <pre {...props}>{children}</pre>
                                <button onClick={() => handleCopy(codeText, codeText)} className="absolute top-2 right-2 p-1.5 bg-white border border-gray-200 rounded shadow-sm text-gray-500 opacity-0 group-hover/code:opacity-100 transition-opacity hover:bg-gray-50 focus:opacity-100 outline-none" title="Copy code">
                                  {copiedId === codeText ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-green-600"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>}
                                </button>
                              </div>
                            );
                          }
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    )}

                    {/* Human Escalation Form (Shows when 'Talk to human' is clicked) */}
                    {msg.role === 'assistant' && msg.id !== 'init' && !isTyping && (escalatingId === msg.id || escalatedIds[msg.id]) && (
                      <div className="mt-3 border-t border-gray-100 pt-3">
                        {escalatedIds[msg.id] ? (
                          <div className="text-[11px] text-green-600 font-medium flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            Ticket created! A human will reach out shortly.
                          </div>
                        ) : (
                          <div className="flex gap-1.5 animate-in fade-in duration-200">
                            <input 
                              type="email" 
                              required
                              placeholder="Your email address" 
                              className="border border-gray-300 text-[11px] p-1.5 rounded-sm flex-1 focus:outline-none focus:border-gray-500 text-gray-800 disabled:opacity-50" 
                              value={escalationEmail} 
                              onChange={e => setEscalationEmail(e.target.value)} 
                              disabled={isSubmittingTicket}
                            />
                            <button 
                              onClick={() => submitTicket(msg.id, userPrompt)} 
                              disabled={!escalationEmail.includes('@') || isSubmittingTicket}
                              className="bg-black text-white text-[11px] px-3 font-medium rounded-sm disabled:opacity-50 hover:bg-gray-800 transition-colors"
                            >
                              {isSubmittingTicket ? 'Sending...' : 'Send'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {msg.role === 'assistant' && msg.id !== 'init' && !isTyping && (
                    <div className="flex items-center gap-1.5 mt-0.5 ml-1 text-gray-400">
                      <button onClick={() => handleCopy(msg.content, msg.id)} className="hover:text-gray-700 transition-colors p-1" title="Copy response">
                        {copiedId === msg.id ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-green-600"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>}
                      </button>
                      <button onClick={() => submitFeedback(msg.id, userPrompt, msg.content, 'up')} className={`hover:text-green-600 transition-colors p-1 ${feedback[msg.id] === 'up' ? 'text-green-600' : ''}`} title="Helpful">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>
                      </button>
                      <button onClick={() => submitFeedback(msg.id, userPrompt, msg.content, 'down')} className={`hover:text-red-600 transition-colors p-1 ${feedback[msg.id] === 'down' ? 'text-red-600' : ''}`} title="Not helpful">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/></svg>
                      </button>

                      {/* Explicit Escalate Trigger */}
                      {!escalatedIds[msg.id] && (
                        <>
                          <div className="w-px h-3 bg-gray-200 mx-1"></div>
                          <button onClick={() => setEscalatingId(msg.id)} className="text-[11px] font-medium hover:text-gray-700 transition-colors">
                            Talk to human
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && messages[messages.length - 1]?.role === 'user' && (
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
                Sorry, I encountered an error connecting to the knowledge base.
              </span>
            </div>
          )}
        </div>

        {messages.length === 1 && showPrompts && suggestedPrompts.length > 0 && (
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

      <div className="border-t border-gray-200 p-3 flex bg-white z-10 relative">
        <form onSubmit={handleSubmit} className="flex w-full">
          <input 
            type="text" 
            placeholder="Ask a question..."
            className="flex-1 p-2 border border-gray-300 rounded-sm focus:outline-none transition-colors text-gray-800"
            style={{ outlineColor: 'var(--primary-color)' }}
            value={input}
            onChange={handleInputChange}
            disabled={isLoading}
          />
          <button 
            type="submit"
            disabled={isLoading || !input.trim()}
            className="ml-2 text-white px-4 py-2 rounded-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow-sm"
            style={{ backgroundColor: 'var(--primary-color)' }}
          >
            Send
          </button>
        </form>
      </div>

      {!removeBranding && (
        <div className="py-2 text-center text-[10px] text-gray-400 bg-gray-50 border-t border-gray-100 flex justify-center items-center">
          Powered by <a href="#" target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-500 hover:text-gray-800 ml-1 transition-colors">Knowledge Bot</a>
        </div>
      )}
    </div>
  );
}
