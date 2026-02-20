'use client';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from 'ai/react';

export default function WidgetWrapper() {
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // 1. Initialize spaceId and fetch matching widget configuration
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sid = urlParams.get('spaceId');
    setSpaceId(sid);

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
  return <ChatWidget spaceId={spaceId} config={config} />;
}

function ChatWidget({ spaceId, config }: { spaceId: string | null, config: any }) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Custom Theming Mapping
  const primaryColor = config?.primary_color || '#000000';
  const headerText = config?.header_text || 'Documentation Bot';
  const welcomeMessage = config?.welcome_message || 'How can I help you today?';
  const botAvatar = config?.bot_avatar || null;
  const removeBranding = config?.remove_branding || false;

  // Initialize Vercel AI SDK with dynamically pulled Welcome Message
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/api/chat',
    body: { spaceId }, 
    initialMessages: [
      { id: 'init', role: 'assistant', content: welcomeMessage }
    ]
  });

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  return (
    <div 
      className="flex flex-col h-screen bg-white font-sans text-sm" 
      style={{ '--primary-color': primaryColor } as React.CSSProperties}
    >
      {/* Dynamic Header */}
      <div 
        className="p-4 font-medium text-center shadow-sm text-white flex justify-center items-center gap-2 relative z-10"
        style={{ backgroundColor: 'var(--primary-color)' }}
      >
        {botAvatar && (
          <img src={botAvatar} alt="Avatar" className="w-6 h-6 rounded-full object-cover border border-white/20" />
        )}
        <span>{headerText}</span>
      </div>

      {/* Chat Area */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4"
        aria-live="polite"
        aria-atomic="false"
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-2`}>
            {/* Assistant Bot Avatar (in-line logic) */}
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
