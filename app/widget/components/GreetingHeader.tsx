// app/widget/components/GreetingHeader.tsx
import { getAvatarColor } from '../utils';

export default function GreetingHeader({
  agentsOnline,
  teamMembers,
  botAvatar,
  greetingTitle,
  greetingBody,
  startNewConversation,
  homeContent
}: any) {

  let homeConfig = { logoUrl: '', bgUrl: '', titleColor: '', bodyColor: '', blocks: [] };
  try {
    if (homeContent) {
      const parsed = JSON.parse(homeContent);
      if (!Array.isArray(parsed)) {
         homeConfig = { ...homeConfig, ...parsed };
      }
    }
  } catch (e) {}

  const hasBgImage = !!homeConfig.bgUrl;
  const overlayClass = hasBgImage ? 'bg-black/40' : ''; 

  return (
    <div className="p-6 shrink-0 relative overflow-hidden" style={{ 
      background: hasBgImage ? `url(${homeConfig.bgUrl}) center/cover no-repeat` : `linear-gradient(145deg, var(--primary-color) 0%, transparent 100%)` 
    }}>
      {hasBgImage && <div className={`absolute inset-0 ${overlayClass}`} />}
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-6">
          {/* Logo / Fallback Avatar */}
          {homeConfig.logoUrl ? (
            <img src={homeConfig.logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
          ) : botAvatar ? (
            <img src={botAvatar} alt="Logo" className="w-12 h-12 rounded-xl object-cover shadow-sm bg-white" />
          ) : (
            <div className="w-12 h-12" />
          )}

          {/* Avatars */}
          {agentsOnline && teamMembers?.length > 0 && (
            <div className="flex flex-row-reverse -space-x-reverse -space-x-2">
              {teamMembers.slice(0, 3).map((m: any, i: number) => {
                const initial = (m.name ? m.name.charAt(0) : m.email.charAt(0)).toUpperCase();
                return (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-[var(--bg-primary)] flex items-center justify-center text-[11px] font-bold text-white shadow-sm" style={{ backgroundColor: getAvatarColor(m.name || m.email), zIndex: i }}>
                    {initial}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <h1 className="text-[28px] font-bold mb-1 leading-tight" style={{ color: homeConfig.titleColor || 'var(--text-primary)' }}>
          {greetingTitle}
        </h1>
        <p className="text-base mb-6" style={{ color: homeConfig.bodyColor || 'var(--text-primary)', opacity: homeConfig.bodyColor ? 1 : 0.8 }}>
          {greetingBody}
        </p>

        {/* Send Message Card */}
        <button onClick={startNewConversation} className="w-full bg-[var(--bg-primary)] rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all border border-[var(--border-strong)] group active:scale-[0.98]">
          <span className="font-semibold text-[var(--text-primary)]">Send us a message</span>
          <svg className="w-5 h-5 text-[var(--primary-color)] group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );
}
