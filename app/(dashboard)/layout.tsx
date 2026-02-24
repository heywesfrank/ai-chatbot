// app/(dashboard)/layout.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { BotConfigProvider, useBotConfig } from './BotConfigProvider';
import { 
  DatabaseIcon, SettingsIcon, PaletteIcon, MessageSquareIcon, 
  CodeIcon, InboxIcon, BarChartIcon, LinkIcon, UsersIcon 
} from '@/components/icons';

const navGroups = [
  {
    title: 'Agent Builder',
    items: [
      { name: 'Knowledge Base', path: '/knowledge', icon: <DatabaseIcon className="w-[18px] h-[18px]" /> },
      { name: 'Behavior & Model', path: '/behavior', icon: <SettingsIcon className="w-[18px] h-[18px]" /> },
      { name: 'Appearance', path: '/appearance', icon: <PaletteIcon className="w-[18px] h-[18px]" /> },
      { name: 'Custom FAQs', path: '/faqs', icon: <MessageSquareIcon className="w-[18px] h-[18px]" /> },
      { name: 'Embed & Install', path: '/install', icon: <CodeIcon className="w-[18px] h-[18px]" /> },
    ]
  },
  {
    title: 'Operations',
    items: [
      { name: 'Inbox', path: '/inbox', icon: <InboxIcon className="w-[18px] h-[18px]" /> },
      { name: 'Analytics', path: '/analytics', icon: <BarChartIcon className="w-[18px] h-[18px]" /> },
    ]
  },
  {
    title: 'Workspace',
    items: [
      { name: 'Integrations', path: '/integrations', icon: <LinkIcon className="w-[18px] h-[18px]" /> },
      { name: 'Team Management', path: '/team', icon: <UsersIcon className="w-[18px] h-[18px]" /> },
    ]
  }
];

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading, activeSpaceId, config, isOwner, saveConfig, isSaving, refreshKey, userEmail } = useBotConfig();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openTickets, setOpenTickets] = useState<number>(0);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.refresh();
        router.push('/');
      }
    });
    return () => authListener.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    let ticketsChannel: any;
    if (activeSpaceId) {
      const fetchTicketCount = async () => {
        const { count } = await supabase
          .from('live_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('space_id', activeSpaceId)
          .eq('status', 'open');
        setOpenTickets(count || 0);
      };
      fetchTicketCount();

      ticketsChannel = supabase.channel('layout_tickets')
        .on('postgres_changes', { 
          event: '*', schema: 'public', table: 'live_sessions', filter: `space_id=eq.${activeSpaceId}` 
        }, () => { fetchTicketCount(); })
        .subscribe();
    }
    return () => { if (ticketsChannel) supabase.removeChannel(ticketsChannel); };
  }, [activeSpaceId]);

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

  const workspaceName = config.headerText || 'My Workspace';
  const isBuilderRoute = ['/knowledge', '/behavior', '/appearance', '/faqs', '/install'].includes(pathname);
  const previewUrl = `/widget?spaceId=${activeSpaceId}&color=${encodeURIComponent(config.primaryColor)}&header=${encodeURIComponent(config.headerText)}&showPrompts=${config.showPrompts}&prompts=${encodeURIComponent(JSON.stringify(config.suggestedPrompts))}&leadCapture=${config.leadCaptureEnabled}&theme=${config.theme}&position=${config.position}&preview=true`;

  return (
    <div className="flex h-screen w-full bg-white text-gray-900 font-sans overflow-hidden">
      
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/20 z-40 md:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[240px] border-r border-gray-200 bg-[#FAFAFA] flex flex-col justify-between transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        <div className="p-4 flex-1 overflow-y-auto no-scrollbar">
          <div className="flex items-center justify-between mb-8 mt-2 px-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center shadow-sm shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              </div>
              <span className="font-semibold text-sm tracking-tight text-gray-900 truncate pr-2" title={workspaceName}>{workspaceName}</span>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-1 text-gray-500 hover:text-gray-900">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="space-y-6">
            {navGroups.map((group, idx) => (
              <div key={idx}>
                <h3 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">{group.title}</h3>
                <nav className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = pathname === item.path;
                    return (
                      <Link 
                        key={item.name} 
                        href={item.path} 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-200 outline-none ${isActive ? 'bg-white text-gray-900 shadow-sm border border-gray-200/60 font-medium' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50 border border-transparent'}`}
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
            ))}
          </div>
        </div>
        
        <div className="p-4 border-t border-gray-200 space-y-3 bg-[#FAFAFA] shrink-0">
          {userEmail && (
            <div className="flex items-center gap-3 px-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold shrink-0 uppercase border border-gray-300/50">
                {userEmail.charAt(0)}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-gray-700 truncate">{userEmail}</span>
                <span className="text-[10px] text-gray-400 capitalize">{isOwner ? 'Workspace Owner' : 'Agent'}</span>
              </div>
            </div>
          )}
          <button onClick={handleSignOut} className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100/50 border border-transparent transition-all outline-none text-left">
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-white">
        
        <header className="md:hidden flex items-center justify-between bg-white border-b border-gray-200 p-4 shrink-0 shadow-sm z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center shadow-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <span className="font-semibold text-sm tracking-tight text-gray-900 truncate">{workspaceName}</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-1 -mr-1 text-gray-500 hover:text-gray-900 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </header>

        {isBuilderRoute && (
          <div className="h-[60px] px-8 border-b border-gray-200 bg-white/95 backdrop-blur-sm flex items-center justify-between shrink-0 z-20 sticky top-0">
            <div>
              <h1 className="text-sm font-semibold text-gray-900 hidden sm:block">Agent Builder</h1>
              {!isOwner && <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-1 rounded-sm border border-blue-100 mt-1 inline-block">Read-only view</span>}
            </div>
            <button 
              onClick={saveConfig} 
              disabled={isSaving || !isOwner} 
              className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-500 transition-colors text-xs font-medium shadow-sm active:scale-[0.98]"
            >
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        )}

        <main className="flex-1 flex overflow-hidden w-full h-full relative">
          <div className="flex-1 overflow-y-auto w-full h-full bg-[#FAFAFA]">
             {children}
          </div>
          
          {isBuilderRoute && activeSpaceId && (
            <div className="hidden lg:flex w-[380px] xl:w-[420px] border-l border-gray-200 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] flex-col items-center justify-center relative shadow-[inset_4px_0_24px_rgba(0,0,0,0.02)] z-0">
              <div className="w-[360px] h-[600px] bg-white rounded-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] overflow-hidden border border-gray-200/50 animate-in fade-in zoom-in-95 duration-500">
                <iframe key={refreshKey} src={previewUrl} className="w-full h-full border-none bg-transparent" title="Widget Preview" />
              </div>
            </div>
          )}
        </main>

      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <BotConfigProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </BotConfigProvider>
  );
}
