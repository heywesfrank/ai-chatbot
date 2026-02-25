// app/widget/components/ChatInput.tsx
import { useRef, useState } from 'react';
import { PaperclipIcon } from '@/components/icons';

export default function ChatInput({ 
  input, 
  handleInputChange, 
  handleFormSubmit, 
  disabled, 
  primaryColor, 
  isLiveChat, 
  onFileUpload,
  inputPlaceholder // Added prop
}: any) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    if (onFileUpload) {
      await onFileUpload(file);
    }
    setIsUploading(false);
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="border-t border-[var(--border-strong)] p-3 flex bg-[var(--bg-primary)] z-10 relative shrink-0">
      <form onSubmit={handleFormSubmit} className="flex w-full relative items-center gap-2">
        
        {isLiveChat && (
          <div className="shrink-0 flex items-center">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/*,.pdf,.doc,.docx"
            />
            <button
              type="button"
              disabled={disabled || isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-full transition-colors disabled:opacity-50 outline-none flex items-center justify-center"
              aria-label="Attach file"
              title="Attach screenshot or file"
            >
              {isUploading ? (
                <div className="w-5 h-5 border-2 border-t-transparent border-[var(--text-secondary)] rounded-full animate-spin" />
              ) : (
                <PaperclipIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        )}

        <div className="flex-1 relative flex">
          <input 
            type="text" 
            aria-label="Chat input"
            placeholder={inputPlaceholder || "Ask a question..."} 
            className="w-full p-3.5 border border-[var(--border-strong)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-full focus:outline-none focus:border-transparent focus:ring-2 transition-all shadow-sm pl-4 pr-20"
            style={{ '--tw-ring-color': 'var(--primary-color)' } as any}
            value={input}
            onChange={handleInputChange}
            disabled={disabled || isUploading}
          />
          <button 
            type="submit"
            aria-label="Send message"
            disabled={disabled || isUploading || !input.trim()}
            className="absolute right-1.5 top-1.5 bottom-1.5 text-[var(--msg-user-text)] px-4 rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium active:scale-95"
            style={{ backgroundColor: 'var(--primary-color)' }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
