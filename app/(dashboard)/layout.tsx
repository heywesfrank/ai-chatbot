// app/(dashboard)/layout.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabaseClient as supabase } from '@/lib/supabase-client';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string>('Dashboard');
  const [openTickets, setOpenTickets] = useState<number>(0);

  useEffect(() => {
    let ticketsChannel: any;

    const initData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoading(!session);
      
      if (session?.user?.email) {
        setUserEmail(session.user.email);
        let spaceId = null;

        // 1. Fetch Workspace Name
        const { data: config } = await supabase
          .from('bot_config')
          .select('space_id, header_text')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (config?.space_id) {
          setWorkspaceName(config.header_text || 'My Workspace');
          spaceId = config.space_id;
        } else {
          // Fallback if they are an agent
          const { data: member } = await supabase
            .from('team_members')
            .select('space_id')
            .eq('email', session.user.email)
            .maybeSingle();

          if (member?.space_id) {
            const { data: teamConfig } = await supabase
              .from('bot_config')
              .select('space_id, header_text')
              .eq('space_id', member.space_id)
              .maybeSingle();
              
            if (teamConfig?.space_id) {
              setWorkspaceName(teamConfig.header_text || 'Workspace');
              spaceId = teamConfig.space_id;
            }
          }
        }

        // 2. Fetch Initial Inbox Badge Count & Subscribe to updates
        if (spaceId) {
          const fetchTicketCount = async () => {
            const { count } = await supabase
              .from('live_sessions')
              .select('*', { count: 'exact', head: true })
              .eq('space_id', spaceId)
              .eq('status', 'open');
            setOpenTickets(count || 0);
          };

          await fetchTicketCount();

          ticketsChannel = supabase.channel('layout_tickets')
            .on('postgres_changes', { 
              event: '*', 
              schema: 'public', 
              table: 'live_sessions', 
              filter: `space_id=eq.${spaceId}` 
            }, () => {
               fetchTicketCount();
            })
            .subscribe();
        }
      }
    };

    initData();

    // Setup Auth Listener
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.refresh();
        router.push('/');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
      if (ticketsChannel) supabase.removeChannel(ticketsChannel);
    };
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push('/');
  };

  if (isLoading) {
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

  const navItems = [
    { name: 'Workspace', path: '/home', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
    { name: 'Knowledge Base', path: '/knowledge', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
    { name: 'Custom FAQs', path: '/faqs', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { name: 'Inbox', path: '/inbox', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg> },
    { name: 'Integrations', path: '/integrations', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg> },
    { name: 'Analytics', path: '/analytics', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 20V10M12 20V4M6 20V14" /></svg> },
    { name: 'Team', path: '/team', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
  ];

  return (
    <div className="flex h-screen w-full bg-white text-gray-900 font-sans overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden transition-opacity" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      {/* Sidebar Content */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[240px] border-r border-gray-200 bg-[#FAFAFA] flex flex-col justify-between transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        <div className="p-4 flex-1 overflow-y-auto">
          {/* Active Workspace Header */}
          <div className="flex items-center justify-between mb-8 mt-2 px-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center shadow-sm shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              </div>
              <span className="font-semibold text-sm tracking-tight text-gray-900 truncate pr-2" title={workspaceName}>
                {workspaceName}
              </span>
            </div>
            
            {/* Mobile close button */}
            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-1 text-gray-500 hover:text-gray-900">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link 
                  key={item.name} 
                  href={item.path} 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200 outline-none ${isActive ? 'bg-white text-gray-900 shadow-sm border border-gray-200/60 font-medium' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50 border border-transparent'}`}
                >
                  {item.icon}
                  {item.name}
                  {item.name === 'Inbox' && openTickets > 0 && (
                    <span className="ml-auto bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                      {openTickets > 99 ? '99+' : openTickets}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        
        {/* User Profile & Sign Out Footer */}
        <div className="p-4 border-t border-gray-200 space-y-3 bg-[#FAFAFA] shrink-0">
          {userEmail && (
            <div className="flex items-center gap-3 px-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold shrink-0 uppercase border border-gray-300/50">
                {userEmail.charAt(0)}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-gray-700 truncate">{userEmail}</span>
                <span className="text-[10px] text-gray-400 capitalize">Logged in</span>
              </div>
            </div>
          )}
          <button onClick={handleSignOut} className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100/50 border border-transparent transition-all outline-none text-left">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-[#FAFAFA]">
        
        {/* Mobile Header Top Bar */}
        <header className="md:hidden flex items-center justify-between bg-white border-b border-gray-200 p-4 shrink-0 shadow-sm z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center shadow-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <span className="font-semibold text-sm tracking-tight text-gray-900 truncate">
              {workspaceName}
            </span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(true)} 
            className="p-1 -mr-1 text-gray-500 hover:text-gray-900 focus:outline-none transition-colors"
            aria-label="Open Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </header>

        {/* Page Children */}
        <main className="flex-1 overflow-y-auto relative w-full h-full">
          {children}
        </main>
      </div>
    </div>
  );
}
