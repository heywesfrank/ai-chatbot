// app/widget/components/ChatInput.tsx
export default function ChatInput({ input, handleInputChange, handleFormSubmit, disabled, primaryColor }: any) {
  return (
    <div className="border-t border-gray-200 p-3 flex bg-white z-10 relative">
      <form onSubmit={handleFormSubmit} className="flex w-full">
        <input 
          type="text" 
          aria-label="Chat input"
          placeholder="Ask a question..."
          className="flex-1 p-2 border border-gray-300 rounded-sm focus:outline-none transition-colors text-gray-800"
          style={{ outlineColor: 'var(--primary-color)' }}
          value={input}
          onChange={handleInputChange}
          disabled={disabled}
        />
        <button 
          type="submit"
          aria-label="Send message"
          disabled={disabled || !input.trim()}
          className="ml-2 text-white px-4 py-2 rounded-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow-sm"
          style={{ backgroundColor: 'var(--primary-color)' }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
