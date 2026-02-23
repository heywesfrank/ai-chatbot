// app/(dashboard)/inbox/page.tsx
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

  const channelRef = useRef<any>(null);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Agent Status & Canned Responses
  const [agentsOnline, setAgentsOnline] = useState(false);
  const [cannedResponses, setCannedResponses] = useState<string[]>([]);
  const [newCannedInput, setNewCannedInput] = useState('');
  const [spaceId, setSpaceId] = useState<string | null>(null);

  useEffect(() => {
    let channel: any;

    const fetchSessions = async () => {
      setIsLoading(true);
      const { data: { session: authSession } } = await supabase.auth.getSession();
      
      if (authSession) {
        const { data: config } = await supabase
          .from('bot_config')
          .select('space_id, agents_online, canned_responses')
          .eq('user_id', authSession.user.id)
          .maybeSingle();
        
        if (config?.space_id) {
          setSpaceId(config.space_id);
          setAgentsOnline(config.agents_online || false);
          setCannedResponses(config.canned_responses || []);

          const { data: rawSessions } = await supabase
            .from('live_sessions')
            .select('*')
            .eq('space_id', config.space_id)
            .order('created_at', { ascending: false });
            
          if (rawSessions) setSessions(rawSessions);

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
      setIsLoading(false);
    };

    fetchSessions();

    return () => { 
      if (channel) supabase.removeChannel(channel); 
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
    
    const channelName = `session_${activeSession.id}`;
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'live_messages', 
        filter: `session_id=eq.${activeSession.id}` 
      }, payload => {
        const newMsg = payload.new;
        if (newMsg.role === 'user') {
          setMessages(prev => [...prev, newMsg]);
          setIsUserTyping(false); 
        }
      })
      .on('broadcast', { event: 'typing' }, payload => {
        if (payload.payload?.role === 'user') {
          setIsUserTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsUserTyping(false), 3000);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') channelRef.current = channel;
      });

    return () => { 
      supabase.removeChannel(channel); 
      channelRef.current = null;
    };
  }, [activeSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, isUserTyping]);

  const toggleAgentStatus = async () => {
    const newVal = !agentsOnline;
    setAgentsOnline(newVal);
    if (spaceId) {
      await supabase.from('bot_config').update({ agents_online: newVal }).eq('space_id', spaceId);
    }
  };

  const handleAddCanned = async () => {
    const val = newCannedInput.trim();
    if (val && !cannedResponses.includes(val)) {
      const newArr = [...cannedResponses, val];
      setCannedResponses(newArr);
      setNewCannedInput('');
      if (spaceId) await supabase.from('bot_config').update({ canned_responses: newArr }).eq('space_id', spaceId);
    }
  };

  const handleRemoveCanned = async (text: string) => {
    const newArr = cannedResponses.filter(c => c !== text);
    setCannedResponses(newArr);
    if (spaceId) await supabase.from('bot_config').update({ canned_responses: newArr }).eq('space_id', spaceId);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { role: 'agent' }
      });
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeSession) return;
    
    const msg = input.trim();
    setInput('');
    const tempId = Date.now().toString();
    const timestamp = new Date().toISOString();
    
    setMessages(prev => [...prev, { id: tempId, role: 'agent', content: msg, created_at: timestamp }]);

    await fetch('/api/live-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: activeSession.id, role: 'agent', content: msg })
    });
  };

  const handleResolve = async () => {
    if (!activeSession) return;

    // Calculate resolution time dynamically
    const diffMs = Date.now() - new Date(activeSession.created_at).getTime();
    const resolutionTime = Math.round(diffMs / 60000); // converting to minutes

    await supabase.from('live_sessions').update({ 
      status: 'closed',
      resolution_time: resolutionTime
    }).eq('id', activeSession.id);
    
    setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, status: 'closed', resolution_time: resolutionTime } : s));
    setActiveSession({ ...activeSession, status: 'closed', resolution_time: resolutionTime });
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
      {/* Left Sidebar */}
      <div className="w-[320px] border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
        
        {/* Agent Status Toggle Header */}
        <div className="p-5 border-b border-gray-100 bg-[#FAFAFA]">
          <div className="flex items-center justify-between mb-1.5">
            <h1 className="text-sm font-semibold tracking-tight text-gray-900">Agent Status</h1>
            <button 
              onClick={toggleAgentStatus}
              className={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors focus:outline-none shadow-inner ${agentsOnline ? 'bg-green-500' : 'bg-gray-300'}`}
              title={`Status: ${agentsOnline ? 'Online' : 'Offline'}`}
            >
              <span className={`${agentsOnline ? 'translate-x-4' : 'translate-x-1'} inline-block w-3.5 h-3.5 transform bg-white rounded-full transition-transform shadow-sm`} />
            </button>
          </div>
          <p className="text-[11px] text-gray-500 leading-snug">Toggle whether agents are currently online to chat. When offline, users are routed to email.</p>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-3 border-b border-gray-50 bg-white">
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active Inquiries</h2>
          </div>
          {sessions.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-400">No active conversations.</div>
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

        {/* Canned Responses Manager */}
        <div className="p-5 border-t border-gray-100 bg-[#FAFAFA] flex flex-col max-h-[40%]">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Canned Responses</h2>
          <div className="flex gap-2 mb-3 shrink-0">
            <input 
              type="text" 
              value={newCannedInput}
              onChange={(e) => setNewCannedInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCanned()}
              placeholder="Add a quick reply..."
              className="flex-1 p-2 border border-gray-200 rounded-md text-xs outline-none focus:border-black transition-colors bg-white shadow-sm"
            />
            <button 
              onClick={handleAddCanned}
              disabled={!newCannedInput.trim()}
              className="px-3 bg-black text-white text-xs font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-sm"
            >
              Add
            </button>
          </div>
          <div className="flex flex-col gap-1.5 overflow-y-auto no-scrollbar pb-2">
            {cannedResponses.map((canned, idx) => (
              <div 
                key={idx} 
                onClick={() => setInput(canned)}
                className="flex items-center justify-between p-2 bg-white border border-gray-100 rounded-md text-[11px] text-gray-700 shadow-sm group cursor-pointer hover:border-gray-300 transition-colors"
                title="Click to use response"
              >
                <span className="truncate flex-1 pr-2">{canned}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleRemoveCanned(canned); }} 
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 outline-none p-1"
                  title="Remove response"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat View */}
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

            <div className="flex-1 overflow-y-auto p-6 flex flex-col relative">
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
                    <div className="flex items-center gap-1.5 mt-1 mx-1 text-[10px] text-gray-400">
                       <span className="capitalize font-medium">{msg.role}</span>
                       {msg.created_at && (
                         <>
                           <span className="w-px h-2 bg-gray-300 mx-0.5"></span>
                           <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                         </>
                       )}
                    </div>
                  </div>
                ))}
                
                {isUserTyping && (
                  <div className="flex items-center gap-2 mt-2 ml-2 animate-in fade-in duration-300">
                    <span className="text-[11px] italic text-gray-500 font-medium">User is typing...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-[#FAFAFA]">
              <form onSubmit={handleSend} className="flex gap-2">
                <input 
                  type="text" 
                  placeholder={activeSession.status === 'open' ? "Type a message..." : "Ticket is resolved."}
                  className="flex-1 p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:border-black transition-colors text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed shadow-sm"
                  value={input}
                  onChange={handleInputChange}
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
