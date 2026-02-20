'use client';
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

type Message = { role: 'user' | 'assistant'; text: string };

export default function Widget() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: 'How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Reference to auto-scroll to the bottom
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Load chat history from sessionStorage on initial load
  useEffect(() => {
    const savedChat = sessionStorage.getItem('widget_chat_history');
    if (savedChat) {
      try {
        setMessages(JSON.parse(savedChat));
      } catch (e) {
        console.error("Failed to parse chat history");
      }
    }
    setIsInitialized(true);
  }, []);

  // 2. Save chat history to sessionStorage whenever it updates
  useEffect(() => {
    if (isInitialized) {
      sessionStorage.setItem('widget_chat_history', JSON.stringify(messages));
    }
    scrollToBottom();
  }, [messages, isLoading, isInitialized]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = { role: 'user' as const, text: input };
    const updatedMessages = [...messages, userMessage];
    
    // Update UI immediately with user's message
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const spaceId = urlParams.get('spaceId');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: updatedMessages,
          spaceId: spaceId 
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');
      
      // Stop the explicit "typing" state, as stream begins now
      setIsLoading(false); 
      
      // Inject an empty assistant message to hold the streaming content
      setMessages(prev => [...prev, { role: 'assistant', text: '' }]);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let aiText = '';
      let buffer = ''; // Buffer to catch incomplete JSON text fragments

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          let boundary = buffer.indexOf('\n');
          
          // Process fully delimited lines
          while (boundary !== -1) {
            const line = buffer.slice(0, boundary).trim();
            buffer = buffer.slice(boundary + 1);
            
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const event = JSON.parse(line.slice(6));
                
                // Retrieve delta text. Check possible properties based on the response format
                const delta = event.delta || event.text || event.output_text_delta || '';
                aiText += delta;
                
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1].text = aiText;
                  return newMsgs;
                });
              } catch (e) {
                // Ignore incomplete JSON chunks naturally caught by the try/catch
              }
            }
            boundary = buffer.indexOf('\n');
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, I encountered an error connecting to the knowledge base.' }]);
      setIsLoading(false);
    }
  };

  // Prevent rendering mismatched UI until hydration is complete
  if (!isInitialized) return null;

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
            <div className={`max-w-[85%] p-3 rounded-sm leading-relaxed break-words ${
              msg.role === 'user' 
                ? 'bg-gray-100 text-black' 
                : 'border border-gray-200 bg-white text-gray-800'
            }`}>
              {msg.role === 'user' ? (
                msg.text
              ) : (
                <ReactMarkdown className="prose prose-sm max-w-none prose-p:my-1 prose-a:text-blue-600 prose-pre:overflow-x-auto">
                  {msg.text}
                </ReactMarkdown>
              )}
            </div>
          </div>
        ))}
        
        {/* Minimalist Loading State */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="p-4 border border-gray-200 bg-white rounded-sm flex space-x-1">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse delay-75" />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse delay-150" />
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
