'use client';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from 'ai/react';

export default function Widget() {
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Initialize spaceId
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setSpaceId(urlParams.get('spaceId'));
  }, []);

  // 2. Vercel AI SDK handles all streaming, buffering, and state
  // We use initialMessages to set the welcome message.
  // Because there is no sessionStorage, hitting "refresh" naturally wipes this clean,
  // but navigating to a different browser tab preserves the React state.
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/api/chat',
    body: { spaceId }, 
    initialMessages: [
      { id: 'init', role: 'assistant', content: 'How can I help you today?' }
    ]
  });

  // 3. Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  return (
    <div className="flex flex-col h-screen bg-white font-sans text-sm">
      {/* Header */}
      <div className="border-b border-gray-200 p-4 font-medium text-center text-gray-900">
        Documentation Bot
      </div>

      {/* Chat Area */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4"
        aria-live="polite"
        aria-atomic="false"
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-sm leading-relaxed break-words ${
              msg.role === 'user' 
                ? 'bg-gray-100 text-black' 
                : 'border border-gray-200 bg-white text-gray-800'
            }`}>
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
            <div className="p-4 border border-gray-200 bg-white rounded-sm flex space-x-1" aria-label="AI is typing">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse delay-75" />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse delay-150" />
            </div>
          </div>
        )}

        {/* Inline Error Fallback */}
        {error && (
          <div className="flex justify-center my-2">
            <span className="bg-red-50 text-red-600 border border-red-100 px-3 py-2 rounded-sm text-xs">
              Sorry, I encountered an error connecting to the knowledge base.
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-3 flex bg-white">
        <form 
          onSubmit={handleSubmit} 
          className="flex w-full"
        >
          <input 
            type="text" 
            aria-label="Chat input"
            placeholder="Ask a question..."
            className="flex-1 p-2 border border-gray-300 rounded-sm focus:outline-none focus:border-black transition-colors"
            value={input}
            onChange={handleInputChange}
            disabled={isLoading}
          />
          <button 
            type="submit"
            disabled={isLoading || !input.trim()}
            className="ml-2 bg-black text-white px-4 py-2 rounded-sm hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
