// app/widget/components/ConversationsList.tsx
import GreetingHeader from './GreetingHeader';
import { formatTimeAgo } from '../utils';

export default function ConversationsList({
  homeTabEnabled,
  startNewConversation,
  conversations,
  loadConversation,
  greetingProps
}: any) {
  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {homeTabEnabled ? (
        <div className="p-5 pb-3 shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-strong)] sticky top-0 z-10 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Messages</h2>
          <button onClick={startNewConversation} className="text-[11px] font-medium text-[var(--primary-color)] bg-[var(--primary-color)]/10 hover:bg-[var(--primary-color)]/20 px-3 py-1.5 rounded-full transition-colors">
            New Chat
          </button>
        </div>
      ) : (
        <GreetingHeader {...greetingProps} />
      )}

      <div className="flex-1 overflow-y-auto p-5 bg-[var(--bg-secondary)]">
        {conversations.length > 0 ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {homeTabEnabled && <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 px-1">Recent History</div>}
            <div className="flex flex-col gap-2.5">
              {conversations.sort((a: any, b: any) => b.updatedAt - a.updatedAt).map((conv: any) => {
                const lastUserMsg = conv.messages.slice().reverse().find((m: any) => m.role === 'user')?.content || 'New Conversation';
                return (
                  <button key={conv.id} onClick={() => loadConversation(conv.id)} className="flex flex-col p-4 bg-[var(--bg-primary)] border border-[var(--border-strong)] rounded-xl transition-colors text-left shadow-sm group hover:border-[var(--primary-color)]">
                     <div className="flex items-center justify-between mb-1.5">
                       <span className="text-[10px] text-[var(--text-secondary)] font-medium group-hover:text-[var(--text-primary)] transition-colors">{formatTimeAgo(conv.updatedAt)}</span>
                       <svg className="w-3.5 h-3.5 text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity group-hover:text-[var(--primary-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                     </div>
                     <span className="text-sm font-medium text-[var(--text-primary)] line-clamp-2 leading-snug">{lastUserMsg}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          homeTabEnabled && (
            <div className="text-center mt-10">
              <p className="text-[var(--text-secondary)] text-sm">No recent messages.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
