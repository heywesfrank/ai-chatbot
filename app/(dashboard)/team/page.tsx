// app/(dashboard)/team/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';

export default function TeamDashboard() {
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTeam = async (spaceId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`/api/team?spaceId=${spaceId}`, { 
      headers: { Authorization: `Bearer ${session.access_token}` } 
    });
    if (res.ok) {
       const data = await res.json();
       setTeamMembers(data.members || []);
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if Owner
        const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', session.user.id).maybeSingle();
        if (config?.space_id) {
           setIsOwner(true);
           setActiveSpaceId(config.space_id);
           await fetchTeam(config.space_id);
        } else {
           // Check if Agent
           const { data: member } = await supabase.from('team_members').select('space_id').eq('email', session.user.email).maybeSingle();
           if (member?.space_id) {
             setIsOwner(false);
             setActiveSpaceId(member.space_id);
             await fetchTeam(member.space_id);
           }
        }
      }
      setIsLoading(false);
    };
    init();
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail.trim() || !isOwner || !activeSpaceId) return;
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ spaceId: activeSpaceId, email: newMemberEmail.trim() })
    });
    
    if (res.ok) {
      toast.success('Agent invited successfully!');
      setNewMemberEmail('');
      fetchTeam(activeSpaceId);
    } else {
      toast.error('Failed to invite agent.');
    }
  };

  const handleRemoveMember = async (id: string) => {
    if (!isOwner || !activeSpaceId) return;
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch('/api/team', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ spaceId: activeSpaceId, id })
    });

    if (res.ok) {
      toast.success('Agent removed.');
      fetchTeam(activeSpaceId);
    } else {
      toast.error('Failed to remove agent.');
    }
  };

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

  if (!activeSpaceId) {
    return (
      <div className="flex h-full items-center justify-center bg-[#FAFAFA] text-center p-6">
        <div className="max-w-sm">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">No Workspace Found</h2>
          <p className="text-sm text-gray-500">You must initialize a bot in the Workspace tab before managing a team.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#FAFAFA] text-gray-900 font-sans overflow-y-auto">
      <div className="max-w-[1200px] mx-auto w-full p-8 pb-20">
        
        <div className="mb-8">
          <h1 className="text-xl font-medium mb-1 tracking-tight">Team Management</h1>
          <p className="text-gray-500 text-sm leading-relaxed">Invite agents to handle tickets and review analytics. Only the workspace owner can modify bot configurations.</p>
        </div>

        {!isOwner && (
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-md text-sm text-blue-700 flex items-center gap-2 mb-6 font-medium shadow-sm">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             You are viewing this workspace as an Agent. Only the owner can invite or remove members.
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-sm">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Workspace Members</h2>
              <p className="text-xs text-gray-500 mt-0.5">Manage who has access to this bot's inbox.</p>
            </div>
            
            <form onSubmit={handleAddMember} className="flex gap-2 w-full sm:w-auto">
              <input
                type="email"
                required
                placeholder="agent@example.com"
                disabled={!isOwner}
                className="flex-1 sm:w-64 p-2.5 border border-gray-200 rounded-sm text-sm outline-none focus:border-black transition-colors disabled:bg-gray-50 disabled:text-gray-500 shadow-sm"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
              />
              <button
                type="submit"
                disabled={!newMemberEmail || !isOwner}
                className="px-5 bg-black text-white text-sm font-medium rounded-sm hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-sm"
              >
                Invite
              </button>
            </form>
          </div>

          <div className="divide-y divide-gray-100">
            {teamMembers.length > 0 ? (
              teamMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-6 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200 text-gray-500 font-medium">
                      {member.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{member.email}</p>
                      <p className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5 font-medium">{member.role}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={!isOwner}
                    className="text-sm text-red-500 hover:text-red-700 font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <div className="p-10 text-center text-sm text-gray-500">
                No team members invited yet. You are the only person in this workspace.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
