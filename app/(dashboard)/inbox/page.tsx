'use client';
import { useState, useEffect, useRef } from 'react';
import { supabaseClient as supabase } from '@/lib/supabase-client';

export default function InboxDashboard() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let channel: any;

    const fetchSessions = async () => {
      setIsLoading(true);
      const { data: { session: authSession } } = await supabase.auth.getSession();
      
      if (authSession) {
        const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', authSession.user.id).maybeSingle();
        
        if (config?.space_id) {
          // Fetch existing sessions
          const { data: rawSessions } = await supabase
            .from('live_sessions')
            .select('*')
            .eq('space_id', config.space_id)
            .order('created_at', { ascending: false });
            
          if (rawSessions) setSessions(rawSessions);

          // Listen for new sessions needing help
          channel = supabase.channel('dashboard_sessions')
            .on('postgres_changes', { 
              event: 'INSERT', 
              schema: 'public', 
              table: 'live_sessions', 
              filter: `space_id=eq.${config.space_id}` 
            }, payload => {
              setSessions(prev => [payload.new, ...prev]);
            })
            .subscribe();
        }
      }
      
      // We moved this outside the return statement so it actually runs!
      setIsLoading(false);
    };

    fetchSessions();

    // Properly return the cleanup function to React
    return () => { 
      if (channel) {
        supabase.removeChannel(channel); 
      }
    };
  }, []);

  const loadSession = async (session: any) => {
    setActiveSession(session);
    const { data } = await supabase
      .from('live_messages')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true });
      
    setMessages(data || []);
  };

  useEffect(() => {
    if (!activeSession) return;
    
    const channel = supabase.channel(`dashboard_messages_${activeSession.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'live_messages', 
        filter: `session_id=eq.${activeSession.id}` 
      }, payload => {
        const newMsg = payload.new;
        // Only append messages from the user (we optimistic update our own)
        if (newMsg.role === 'user') {
          setMessages(prev => [...prev, newMsg]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeSession) return;
    
    const msg = input.trim();
    setInput('');
    const tempId = Date.now().toString();
    setMessages(prev => [...prev, { id: tempId, role: 'agent', content: msg }]);

    await supabase.from('live_messages').insert({
      session_id: activeSession.id,
      role: 'agent',
      content: msg
    });
  };

  const handleResolve = async () => {
    if (!activeSession) return;
    await supabase.from('live_sessions').update({ status: 'closed' }).eq('id', activeSession.id);
    setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, status: 'closed' } : s));
    setActiveSession({ ...activeSession, status: 'closed' });
  };

  const parsedHistory = activeSession?.history ? JSON.parse(activeSession.history) : [];

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#FAFAFA]">
        <div className="flex space-x-1">
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse" />
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse delay-75" />
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse delay-150" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-[#FAFAFA] text-gray-900 font-sans">
      {/* Session List */}
      <div className="w-[300px] border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-gray-100">
          <h1 className="text-base font-medium tracking-tight">Active Inquiries</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">No active conversations.</div>
          ) : (
            sessions.map(session => (
              <button
                key={session.id}
                onClick={() => loadSession(session)}
                className={`w-full text-left p-4 border-b border-gray-50 transition-colors flex items-center justify-between outline-none ${activeSession?.id === session.id ? 'bg-gray-50' : 'hover:bg-gray-50/50'}`}
              >
                <div className="flex flex-col truncate">
                  <span className="text-sm font-medium truncate pr-2">{session.email}</span>
                  <span className="text-xs text-gray-400 mt-0.5">
                    {new Date(session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${session.status === 'open' ? 'bg-green-500' : 'bg-gray-300'}`} />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {!activeSession ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500 bg-[#FAFAFA]">
            <svg className="w-10 h-10 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            <p className="text-sm">Select a conversation to start messaging.</p>
          </div>
        ) : (
          <>
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-[#FAFAFA]/50">
              <div>
                <h2 className="text-sm font-semibold">{activeSession.email}</h2>
                <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${activeSession.status === 'open' ? 'bg-green-500' : 'bg-gray-400'}`} />
                  {activeSession.status === 'open' ? 'Requires Attention' : 'Resolved'}
                </p>
              </div>
              {activeSession.status === 'open' && (
                <button 
                  onClick={handleResolve}
                  className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Mark as Resolved
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col">
              {parsedHistory.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-sm p-4 mb-6 text-xs text-gray-500">
                  <h3 className="font-semibold mb-2 text-gray-700 border-b border-gray-200 pb-2">Previous AI Context</h3>
                  <div className="space-y-3 mt-3">
                    {parsedHistory.map((m: any, i: number) => (
                      <div key={i} className="leading-relaxed">
                        <strong className={m.role === 'user' ? 'text-gray-800' : 'text-blue-600'}>{m.role === 'user' ? 'User' : 'Bot'}:</strong> {m.content}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex flex-col max-w-[80%] ${msg.role === 'agent' ? 'self-end items-end' : 'self-start items-start'}`}>
                    <div className={`px-4 py-2.5 rounded-sm text-[13px] leading-relaxed break-words shadow-sm ${msg.role === 'agent' ? 'bg-black text-white' : 'bg-gray-100 text-gray-800 border border-gray-200'}`}>
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1 mx-1 capitalize font-medium">{msg.role}</span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-[#FAFAFA]">
              <form onSubmit={handleSend} className="flex gap-2">
                <input 
                  type="text" 
                  placeholder={activeSession.status === 'open' ? "Type a message..." : "Ticket is resolved."}
                  className="flex-1 p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:border-black transition-colors text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={activeSession.status === 'closed'}
                />
                <button 
                  type="submit"
                  disabled={!input.trim() || activeSession.status === 'closed'}
                  className="bg-black text-white px-5 py-2.5 text-sm font-medium rounded-sm disabled:opacity-50 hover:bg-gray-800 transition-colors shadow-sm"
                >
                  Send
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
