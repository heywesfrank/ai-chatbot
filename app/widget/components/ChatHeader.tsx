// app/widget/components/ChatHeader.tsx
import { ClearIcon } from '@/components/icons';

export default function ChatHeader({
  tabsEnabled,
  setMessagesView,
  botAvatar,
  headerText,
  descriptionText,
  isLeadCaptured,
  handleClearChat,
  urlOverrides,
  setIsOpen
}: any) {
  return (
    <div className="p-3.5 flex items-center relative z-10 shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.05)]" style={{ backgroundColor: 'var(--primary-color)', color: '#ffffff' }}>
      {tabsEnabled && (
        <button onClick={() => setMessagesView('list')} className="p-1.5 rounded-md hover:bg-white/20 transition-colors mr-2 outline-none">
          <svg className="w-5 h-5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
        </button>
      )}
      <div className="flex items-center gap-2.5 flex-1">
        {botAvatar && <img src={botAvatar} alt="Avatar" className="w-7 h-7 rounded-full object-cover shadow-sm bg-white" />}
        <div className="flex flex-col">
          <span className="font-semibold text-sm leading-tight">{headerText}</span>
          {descriptionText && <span className="text-[10px] font-medium opacity-90">{descriptionText}</span>}
        </div>
      </div>
      
      {!tabsEnabled && isLeadCaptured && (
        <button aria-label="Clear Chat" onClick={handleClearChat} className="p-2 rounded-md hover:bg-black/10 transition-colors outline-none focus:ring-2" title="Clear Chat">
          <ClearIcon className="w-4 h-4" />
        </button>
      )}

      {!urlOverrides.preview && !tabsEnabled && (
        <button aria-label="Close Chat" onClick={() => setIsOpen(false)} className="p-2 rounded-md hover:bg-black/10 transition-colors outline-none focus:ring-2 ml-1" title="Close Chat">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );
}
