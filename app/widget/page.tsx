'use client';
import { useState } from 'react';

export default function Widget() {
  const [messages, setMessages] = useState([{ role: 'bot', text: 'How can I help you today?' }]);
  const [input, setInput] = useState('');

  const sendMessage = async () => {
    if (!input) return;
    
    // Optimistically add user message
    setMessages(prev => [...prev, { role: 'user', text: input }]);
    setInput('');

    // In the future, this will call /api/chat to get the AI response
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'bot', text: 'This is a placeholder answer based on the Gitbook.' }]);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans text-sm">
      {/* Header */}
      <div className="border-b border-gray-200 p-4 font-medium text-center">
        Documentation Bot
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-sm ${msg.role === 'user' ? 'bg-gray-100 text-black' : 'border border-gray-200 bg-white text-gray-800'}`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-3 flex">
        <input 
          type="text" 
          placeholder="Ask a question..."
          className="flex-1 p-2 border border-gray-300 rounded-sm focus:outline-none focus:border-black"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button 
          onClick={sendMessage}
          className="ml-2 bg-black text-white px-4 py-2 rounded-sm hover:bg-gray-800"
        >
          Send
        </button>
      </div>
    </div>
  );
}
