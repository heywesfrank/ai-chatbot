// app/(dashboard)/inbox/page.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { supabaseClient as supabase } from '@/lib/supabase-client';

export default function InboxDashboard() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isNote, setIsNote] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const channelRef = useRef<any>(null);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        let configData = null;
        
        const { data: ownConfig } = await supabase
          .from('bot_config')
          .select('space_id, agents_online, canned_responses')
          .eq('user_id', authSession.user.id)
          .maybeSingle();

        if (ownConfig?.space_id) {
          configData = ownConfig;
        } else {
          const { data: member } = await supabase.from('team_members').select('space_id').eq('email', authSession.user.email).maybeSingle();
          if (member?.space_id) {
            const { data: teamConfig } = await supabase.from('bot_config').select('space_id, agents_online, canned_responses').eq('space_id', member.space_id).maybeSingle();
            configData = teamConfig;
          }
        }
        
        if (configData?.space_id) {
          setSpaceId(configData.space_id);
          setAgentsOnline(configData.agents_online || false);
          setCannedResponses(configData.canned_responses || []);

          const { data: rawSessions } = await supabase
            .from('live_sessions')
            .select('*')
            .eq('space_id', configData.space_id)
            .order('created_at', { ascending: false });
            
          if (rawSessions) setSessions(rawSessions);

          channel = supabase.channel('dashboard_sessions')
            .on('postgres_changes', { 
              event: 'INSERT', 
              schema: 'public', 
              table: 'live_sessions', 
              filter: `space_id=eq.${configData.space_id}` 
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
        // Include 'user' naturally, and capture other 'agent' or 'note' broadcasts across devices
        if (newMsg.role === 'user' || newMsg.role === 'agent' || newMsg.role === 'note') {
          setMessages(prev => {
            if (prev.find(p => p.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (newMsg.role === 'user') setIsUserTyping(false); 
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
    const sendRole = isNote ? 'note' : 'agent';
    
    setMessages(prev => [...prev, { id: tempId, role: sendRole, content: msg, created_at: timestamp }]);

    await fetch('/api/live-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: activeSession.id, role: sendRole, content: msg })
    });
    
    setIsNote(false); // Reset toggle to reply publicly after sending note
  };

  const handleResolve = async () => {
    if (!activeSession) return;

    const diffMs = Date.now() - new Date(activeSession.created_at).getTime();
    const resolutionTime = Math.round(diffMs / 60000); 

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
      <div className="w-[320px] border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
        
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

      <div className="flex-1 flex flex-col bg-white">
        {!activeSession ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500 bg-[#FAFAFA]">
            <svg className="w-10 h-10 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            <p className="text-sm">Select a conversation to start messaging.</p>
          </div>
        ) : (
          <>
            <div className="p-5 border-b border-gray-100 flex items-start justify-between bg-[#FAFAFA]/50">
              <div>
                <h2 className="text-sm font-semibold">{activeSession.email}</h2>
                <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5 mb-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${activeSession.status === 'open' ? 'bg-green-500' : 'bg-gray-400'}`} />
                  {activeSession.status === 'open' ? 'Requires Attention' : 'Resolved'}
                </p>
                {activeSession.metadata && Object.keys(activeSession.metadata).length > 0 && (
                  <div className="flex flex-wrap gap-4 text-[11px] text-gray-500 bg-white p-2.5 rounded-sm border border-gray-200 shadow-sm mt-1">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      {activeSession.metadata.browser} / {activeSession.metadata.os}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      {activeSession.metadata.location}
                    </span>
                    <span className="flex items-center gap-1 max-w-[200px] truncate" title={activeSession.metadata.url}>
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                      <a href={activeSession.metadata.url} target="_blank" rel="noreferrer" className="hover:underline truncate">{activeSession.metadata.url}</a>
                    </span>
                  </div>
                )}
              </div>
              {activeSession.status === 'open' && (
                <button 
                  onClick={handleResolve}
                  className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-50 transition-colors shadow-sm shrink-0"
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
                  <div key={idx} className={`flex flex-col max-w-[80%] ${msg.role === 'agent' || msg.role === 'note' ? 'self-end items-end' : 'self-start items-start'}`}>
                    <div className={`px-4 py-2.5 rounded-sm text-[13px] leading-relaxed break-words shadow-sm ${msg.role === 'agent' ? 'bg-black text-white' : msg.role === 'note' ? 'bg-yellow-100 text-yellow-900 border border-yellow-200' : 'bg-gray-100 text-gray-800 border border-gray-200'}`}>
                      {msg.role === 'note' && <span className="block text-[10px] font-bold uppercase tracking-wider text-yellow-700 mb-1">Internal Note</span>}
                      {msg.content}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 mx-1 text-[10px] text-gray-400">
                       <span className="capitalize font-medium">{msg.role === 'note' ? 'Agent (Note)' : msg.role}</span>
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
              <form onSubmit={handleSend} className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder={activeSession.status === 'open' ? (isNote ? "Type an internal note..." : "Type a message...") : "Ticket is resolved."}
                    className="flex-1 p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:border-black transition-colors text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed shadow-sm"
                    value={input}
                    onChange={handleInputChange}
                    disabled={activeSession.status === 'closed'}
                  />
                  <button 
                    type="submit"
                    disabled={!input.trim() || activeSession.status === 'closed'}
                    className={`px-5 py-2.5 text-sm font-medium rounded-sm disabled:opacity-50 transition-colors shadow-sm ${isNote ? 'bg-yellow-500 text-yellow-950 hover:bg-yellow-400' : 'bg-black text-white hover:bg-gray-800'}`}
                  >
                    {isNote ? 'Add Note' : 'Send'}
                  </button>
                </div>
                <div className="flex items-center gap-2 px-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="accent-black w-3.5 h-3.5"
                      checked={isNote}
                      onChange={(e) => setIsNote(e.target.checked)}
                      disabled={activeSession.status === 'closed'}
                    />
                    <span className="text-[11px] text-gray-600 font-medium">Internal Note (Hidden from user)</span>
                  </label>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
