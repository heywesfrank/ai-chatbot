// app/(dashboard)/layout.tsx
'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { BotConfigProvider, useBotConfig } from './BotConfigProvider';
import { 
  DatabaseIcon, SettingsIcon, PaletteIcon, MessageSquareIcon, 
  CodeIcon, InboxIcon, BarChartIcon, LinkIcon, UsersIcon, CpuIcon, ZapIcon, FileTextIcon, LayoutTemplateIcon, StarIcon 
} from '@/components/icons';

const navGroups = [
  {
    title: 'Agent Builder',
    items: [
      { name: 'Knowledge Base', path: '/knowledge', icon: <DatabaseIcon className="w-[18px] h-[18px]" /> },
      { name: 'Behavior', path: '/behavior', icon: <SettingsIcon className="w-[18px] h-[18px]" /> },
      { name: 'Model', path: '/model', icon: <CpuIcon className="w-[18px] h-[18px]" /> },
      { name: 'Context & Routing', path: '/context-routing', icon: <LinkIcon className="w-[18px] h-[18px]" /> },
      { name: 'Appearance', path: '/appearance', icon: <PaletteIcon className="w-[18px] h-[18px]" /> },
      { name: 'Pages', path: '/pages', icon: <LayoutTemplateIcon className="w-[18px] h-[18px]" /> },
      { name: 'Custom FAQs', path: '/faqs', icon: <MessageSquareIcon className="w-[18px] h-[18px]" /> },
      { name: 'Triggers', path: '/triggers', icon: <ZapIcon className="w-[18px] h-[18px]" /> },
      { name: 'Embed & Install', path: '/install', icon: <CodeIcon className="w-[18px] h-[18px]" /> },
    ]
  },
  {
    title: 'Operations',
    items: [
      { name: 'Inbox', path: '/inbox', icon: <InboxIcon className="w-[18px] h-[18px]" /> },
      { name: 'Help Center', path: '/help-center', icon: <FileTextIcon className="w-[18px] h-[18px]" /> },
      { name: 'Analytics', path: '/analytics', icon: <BarChartIcon className="w-[18px] h-[18px]" /> },
    ]
  },
  {
    title: 'Workspace',
    items: [
      { name: 'Integrations', path: '/integrations', icon: <LinkIcon className="w-[18px] h-[18px]" /> },
      { name: 'Team Management', path: '/team', icon: <UsersIcon className="w-[18px] h-[18px]" /> },
      { name: 'Premium', path: '/premium', icon: <StarIcon className="w-[18px] h-[18px]" /> },
      { name: 'Settings', path: '/settings', icon: <SettingsIcon className="w-[18px] h-[18px]" /> },
    ]
  }
];

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading, activeSpaceId, config, isOwner, saveConfig, isSaving, hasUnsavedChanges, userEmail } = useBotConfig();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [openTickets, setOpenTickets] = useState<number>(0);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  useEffect(() => {
    // Send postMessage to any rendered preview iframe (mobile or desktop)
    const iframes = document.querySelectorAll('.preview-iframe');
    iframes.forEach((iframe: any) => {
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          { type: 'kb-config-update', config },
          '*'
        );
      }
    });
  }, [config]);

  // Dynamically update the browser tab title based on the active route
  useEffect(() => {
    let pageName = '';
    
    // Find the current page name from your existing navGroups array
    for (const group of navGroups) {
      const item = group.items.find((i) => i.path === pathname);
      if (item) {
        pageName = item.name;
        break;
      }
    }

    // Update the browser tab title
    if (pageName) {
      document.title = `${pageName} | Apoyo`;
    } else {
      document.title = 'Apoyo';
    }
  }, [pathname]);

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

  const isBuilderRoute = ['/knowledge', '/behavior', '/model', '/context-routing', '/appearance', '/pages', '/faqs', '/triggers', '/install'].includes(pathname);
  
  const previewUrl = `/widget?spaceId=${activeSpaceId}&preview=true`;

  return (
    <div className="flex h-screen w-full bg-white text-gray-900 font-sans overflow-hidden">
      
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/20 z-40 md:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[240px] border-r border-gray-200 bg-[#FAFAFA] flex flex-col justify-between transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        <div className="p-4 flex-1 overflow-y-auto no-scrollbar">
          <div className="flex items-center justify-between md:justify-center mb-8 mt-2 px-2 relative gap-2">
            {/* Desktop Logos (Hidden on Mobile) */}
            <div className="hidden md:flex items-center gap-2">
              <img src="/icon.png" alt="App Icon" className="h-8 w-auto object-contain" />
              <img src="/apoyo.png" alt="Apoyo Logo" className="h-9 w-auto object-contain" />
            </div>
            
            {/* Mobile Menu Title (Hidden on Desktop) */}
            <span className="md:hidden font-semibold text-gray-900 px-2 text-sm">
              Menu
            </span>

            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-1 text-gray-500 hover:text-gray-900 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="space-y-5">
            {navGroups.map((group, idx) => (
              <div key={idx}>
                <h3 className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">{group.title}</h3>
                <nav className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = pathname === item.path;
                    return (
                      <Link 
                        key={item.name} 
                        href={item.path} 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-all duration-200 outline-none ${isActive ? 'bg-gray-200/70 text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/40'}`}
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
        
        <div className="p-3 border-t border-gray-200 bg-[#FAFAFA] shrink-0 relative">
          {userEmail ? (
            <>
              <button 
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center justify-between w-full p-2 rounded-md hover:bg-gray-200/50 transition-colors outline-none text-left group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold shrink-0 uppercase border border-gray-300/50">
                    {userEmail.charAt(0)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-gray-700 truncate leading-tight">{userEmail}</span>
                    <span className="text-[10px] text-gray-400 capitalize leading-tight mt-0.5">{isOwner ? 'Workspace Owner' : 'Agent'}</span>
                  </div>
                </div>
                <svg className={`w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>

              {isProfileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)} />
                  <div className="absolute bottom-[calc(100%+8px)] left-3 right-3 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <button 
                      onClick={handleSignOut} 
                      className="flex items-center gap-2 px-3 py-2 w-full text-xs font-medium text-red-600 hover:bg-red-50 transition-colors text-left"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <button onClick={handleSignOut} className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100/50 border border-transparent transition-all outline-none text-left">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Sign out
            </button>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-white">
        
        <header className="md:hidden flex items-center justify-between bg-white border-b border-gray-200 p-4 shrink-0 shadow-sm z-30">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-1 -ml-1 text-gray-500 hover:text-gray-900 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex items-center gap-2.5">
             <img src="/apoyo.png" alt="Apoyo Logo" className="h-8 w-auto object-contain" />
          </div>
        </header>

        {isBuilderRoute && (
          <div className="h-[60px] px-8 border-b border-gray-200 bg-white/95 backdrop-blur-sm flex items-center justify-between shrink-0 z-20 sticky top-0">
            <div>
              <h1 className="text-sm font-semibold text-gray-900 hidden sm:block">Agent Builder</h1>
              {!isOwner && <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-1 rounded-sm border border-blue-100 mt-1 inline-block">Read-only view</span>}
            </div>
            
            <button 
              onClick={saveConfig} 
              disabled={isSaving || !isOwner || !hasUnsavedChanges} 
              className={`
                relative flex items-center justify-center min-w-[144px] h-[36px] px-4 rounded-md text-xs font-medium transition-all duration-200
                ${(hasUnsavedChanges || isSaving) && isOwner
                  ? 'bg-black text-white shadow-sm disabled:opacity-80' + (!isSaving ? ' hover:bg-gray-800 active:scale-[0.98]' : '')
                  : 'bg-gray-100 text-gray-400 cursor-default'
                }
              `}
            >
              {isSaving ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : hasUnsavedChanges ? (
                'Save Configuration'
              ) : (
                'Saved'
              )}
            </button>
          </div>
        )}

        <main className="flex-1 flex overflow-hidden w-full h-full relative">
          <div className="flex-1 overflow-y-auto w-full h-full bg-[#FAFAFA] flex flex-col">
             <div className="flex-1 shrink-0">
               {children}
             </div>

             {/* Mobile Preview Widget at the Bottom */}
             {isBuilderRoute && activeSpaceId && (
               <div className="lg:hidden w-full border-t border-gray-200 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] pt-12 pb-12 flex justify-center shrink-0">
                 <div className="w-full max-w-[460px] h-[700px] max-h-[80vh] animate-in fade-in zoom-in-95 duration-500 px-2 sm:px-4">
                   <div className="w-full h-full relative">
                     <iframe 
                       src={previewUrl} 
                       className="w-full h-full border-none bg-transparent preview-iframe" 
                       title="Widget Preview Mobile" 
                     />
                   </div>
                 </div>
               </div>
             )}
          </div>
          
          {/* Desktop Preview Widget on the Right */}
          {isBuilderRoute && activeSpaceId && (
            <div className="hidden lg:flex w-[480px] xl:w-[520px] border-l border-gray-200 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] flex-col relative shadow-[inset_4px_0_24px_rgba(0,0,0,0.02)] z-0 shrink-0">
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[468px] h-[824px] max-h-[100vh] animate-in fade-in zoom-in-95 duration-500">
                <iframe 
                  src={previewUrl} 
                  className="w-full h-full border-none bg-transparent preview-iframe" 
                  title="Widget Preview Desktop" 
                />
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
