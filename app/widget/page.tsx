'use client';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from 'ai/react';

export default function WidgetWrapper() {
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [urlOverrides, setUrlOverrides] = useState({ color: '', header: '' });

  // 1. Initialize spaceId and fetch matching widget configuration
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sid = urlParams.get('spaceId');
    
    setSpaceId(sid);
    setUrlOverrides({
      color: urlParams.get('color') || '',
      header: urlParams.get('header') || ''
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

  // 2. Loading State matching minimalistic design
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

  // 3. Render fully loaded and custom themed ChatWidget
  return <ChatWidget spaceId={spaceId} config={config} urlOverrides={urlOverrides} />;
}

function ChatWidget({ spaceId, config, urlOverrides }: { spaceId: string | null, config: any, urlOverrides: any }) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Custom Theming Mapping with URL override support for live preview
  const primaryColor = urlOverrides.color || config?.primary_color || '#000000';
  const headerText = urlOverrides.header || config?.header_text || 'Documentation Bot';
  
  const welcomeMessage = config?.welcome_message || 'How can I help you today?';
  const botAvatar = config?.bot_avatar || null;
  const removeBranding = config?.remove_branding || false;

  // --- Feature 1: Session Persistence Setup ---
  const storageKey = `chat_session_${spaceId}`;
  const initMsg = { id: 'init', role: 'assistant', content: welcomeMessage } as const;

  const getInitialMessages = () => {
    // Only attempt to read storage on the client
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {
          console.error('Failed to parse chat session', e);
        }
      }
    }
    return [initMsg];
  };

  // Initialize Vercel AI SDK
  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages, append } = useChat({
    api: '/api/chat',
    body: { spaceId }, 
    initialMessages: getInitialMessages(),
  });

  // Save to sessionStorage whenever messages change
  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  // --- Feature 2: Suggested Prompts ---
  const suggestedPrompts = [
    "How do I reset my password?",
    "Where can I find the documentation?",
    "How do I contact support?"
  ];

  // --- Feature 3: Clear Chat Handler ---
  const handleClearChat = () => {
    setMessages([initMsg]);
    sessionStorage.removeItem(storageKey);
  };

  return (
    <div 
      className="flex flex-col h-screen bg-white font-sans text-sm" 
      style={{ '--primary-color': primaryColor } as React.CSSProperties}
    >
      {/* Dynamic Header */}
      <div 
        className="p-4 font-medium text-center shadow-sm text-white flex justify-center items-center relative z-10"
        style={{ backgroundColor: 'var(--primary-color)' }}
      >
        <div className="flex items-center gap-2">
          {botAvatar && (
            <img src={botAvatar} alt="Avatar" className="w-6 h-6 rounded-full object-cover border border-white/20 shadow-sm" />
          )}
          <span>{headerText}</span>
        </div>

        {/* Clear Chat Button */}
        <button
          onClick={handleClearChat}
          className="absolute right-3 p-2 rounded-md hover:bg-white/20 text-white/90 hover:text-white transition-colors outline-none focus:ring-2 focus:ring-white/50"
          title="Clear Chat"
          aria-label="Clear Chat"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Chat Area */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4"
        aria-live="polite"
        aria-atomic="false"
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-2`}>
            {/* Assistant Bot Avatar */}
            {msg.role === 'assistant' && botAvatar && (
              <img src={botAvatar} alt="Bot" className="w-7 h-7 rounded-full mr-2.5 object-cover flex-shrink-0 mt-0.5 border border-gray-100" />
            )}
            
            {/* Themed Chat Bubble */}
            <div 
              className={`max-w-[85%] p-3 rounded-md leading-relaxed break-words shadow-sm ${
                msg.role === 'user' 
                  ? 'text-white' 
                  : 'border border-gray-200 bg-white text-gray-800'
              }`}
              style={msg.role === 'user' ? { backgroundColor: 'var(--primary-color)' } : {}}
            >
              {msg.role === 'user' ? (
                msg.content
              ) : (
                <ReactMarkdown className="prose prose-sm max-w-none prose-p:my-1 prose-a:text-blue-600 prose-pre:overflow-x-auto">
                  {msg.content}
                </ReactMarkdown>
              )}
            </div>
          </div>
        ))}

        {/* Suggested Prompts (Only visible if the welcome message is the only message) */}
        {messages.length === 1 && (
          <div className={`flex flex-wrap gap-2 mt-3 justify-start transition-opacity ${botAvatar ? 'ml-[38px]' : ''}`}>
            {suggestedPrompts.map((prompt, index) => (
              <button
                key={index}
                onClick={() => append({ role: 'user', content: prompt })}
                className="text-[13px] px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm text-left leading-tight"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Minimalist Loading State */}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
             {botAvatar && (
              <img src={botAvatar} alt="Bot Loading" className="w-7 h-7 rounded-full mr-2.5 object-cover flex-shrink-0 mt-0.5 border border-gray-100" />
            )}
            <div className="p-4 border border-gray-200 bg-white shadow-sm rounded-md flex space-x-1" aria-label="AI is typing">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse delay-75" />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse delay-150" />
            </div>
          </div>
        )}

        {/* Inline Error Fallback */}
        {error && (
          <div className="flex justify-center my-2">
            <span className="bg-red-50 text-red-600 border border-red-100 px-3 py-2 rounded-sm text-xs shadow-sm">
              Sorry, I encountered an error connecting to the knowledge base.
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-3 flex bg-white z-10 relative">
        <form 
          onSubmit={handleSubmit} 
          className="flex w-full"
        >
          <input 
            type="text" 
            aria-label="Chat input"
            placeholder="Ask a question..."
            className="flex-1 p-2 border border-gray-300 rounded-sm focus:outline-none transition-colors"
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

      {/* "Powered By" Watermark Footer */}
      {!removeBranding && (
        <div className="py-2 text-center text-[10px] text-gray-400 bg-gray-50 border-t border-gray-100 flex justify-center items-center">
          Powered by <a href="#" target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-500 hover:text-gray-800 ml-1 transition-colors">Knowledge Bot</a>
        </div>
      )}
    </div>
  );
}
