'use client';
import { useState, useRef, useEffect } from 'react';

type Message = { role: 'user' | 'assistant'; text: string };

export default function Widget() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: 'How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Reference to auto-scroll to the bottom
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = { role: 'user' as const, text: input };
    const updatedMessages = [...messages, userMessage];
    
    // Update UI immediately with user's message
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

try {
      // Get the spaceId from the iframe URL query
      const urlParams = new URLSearchParams(window.location.search);
      const spaceId = urlParams.get('spaceId');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: updatedMessages,
          spaceId: spaceId // <--- Pass user identity to the backend
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');
      
      const data = await response.json();
      
      // Append the AI's response to the chat
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, I encountered an error connecting to the knowledge base.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans text-sm">
      {/* Header */}
      <div className="border-b border-gray-200 p-4 font-medium text-center text-gray-900">
        Documentation Bot
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-sm leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-gray-100 text-black' 
                : 'border border-gray-200 bg-white text-gray-800'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        
        {/* Minimalist Loading State */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] p-3 border border-gray-200 bg-white text-gray-400 rounded-sm italic">
              Typing...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-3 flex bg-white">
        <input 
          type="text" 
          placeholder="Ask a question..."
          className="flex-1 p-2 border border-gray-300 rounded-sm focus:outline-none focus:border-black transition-colors"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          disabled={isLoading}
        />
        <button 
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          className="ml-2 bg-black text-white px-4 py-2 rounded-sm hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
