// app/widget/components/ChatInput.tsx
export default function ChatInput({ input, handleInputChange, handleFormSubmit, disabled, primaryColor }: any) {
  return (
    <div className="border-t border-[var(--border-strong)] p-3 flex bg-[var(--bg-primary)] z-10 relative shrink-0">
      <form onSubmit={handleFormSubmit} className="flex w-full relative">
        <input 
          type="text" 
          aria-label="Chat input"
          placeholder="Ask a question..."
          className="flex-1 p-3.5 border border-[var(--border-strong)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-full focus:outline-none focus:border-transparent focus:ring-2 transition-all shadow-sm"
          style={{ '--tw-ring-color': 'var(--primary-color)' } as any}
          value={input}
          onChange={handleInputChange}
          disabled={disabled}
        />
        <button 
          type="submit"
          aria-label="Send message"
          disabled={disabled || !input.trim()}
          className="absolute right-1.5 top-1.5 bottom-1.5 text-[var(--msg-user-text)] px-4 rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium active:scale-95"
          style={{ backgroundColor: 'var(--primary-color)' }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
