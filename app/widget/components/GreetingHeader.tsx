// app/widget/components/GreetingHeader.tsx
import { getAvatarColor } from '../utils';

export default function GreetingHeader({
  agentsOnline,
  teamMembers,
  botAvatar,
  greetingTitle,
  greetingBody,
  startNewConversation
}: any) {
  return (
    <div className="p-6 shrink-0 relative overflow-hidden" style={{ background: `linear-gradient(145deg, var(--primary-color) 0%, transparent 100%)` }}>
      {/* Avatars */}
      {agentsOnline && teamMembers?.length > 0 && (
        <div className="absolute top-5 right-5 flex flex-row-reverse -space-x-reverse -space-x-2">
          {teamMembers.slice(0, 3).map((m: any, i: number) => (
            <div key={i} className="w-8 h-8 rounded-full border-2 border-[var(--bg-primary)] flex items-center justify-center text-[11px] font-bold text-white shadow-sm" style={{ backgroundColor: getAvatarColor(m.email), zIndex: i }}>
              {m.email.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      )}
      
      {/* Bot Logo / Fallback */}
      {botAvatar && <img src={botAvatar} alt="Logo" className="w-12 h-12 rounded-xl mb-6 object-cover shadow-sm bg-white" />}
      
      <h1 className="text-[28px] font-bold text-[var(--text-primary)] mb-1 leading-tight">{greetingTitle}</h1>
      <p className="text-base text-[var(--text-primary)] opacity-80 mb-6">{greetingBody}</p>

      {/* Send Message Card */}
      <button onClick={startNewConversation} className="w-full bg-[var(--bg-primary)] rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all border border-[var(--border-strong)] group active:scale-[0.98]">
        <span className="font-semibold text-[var(--text-primary)]">Send us a message</span>
        <svg className="w-5 h-5 text-[var(--primary-color)] group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  );
}
