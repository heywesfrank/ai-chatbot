// app/widget/components/LeadCaptureForm.tsx
import { useState } from 'react';
import { LeadIcon } from '@/components/icons';

interface LeadCaptureFormProps {
  onSubmit: (name: string, email: string) => void;
  isSubmitting: boolean;
}

export default function LeadCaptureForm({ onSubmit, isSubmitting }: LeadCaptureFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(name, email);
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center justify-center">
      <div className="w-12 h-12 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-4 border border-[var(--border-color)]">
        <LeadIcon className="w-5 h-5 text-[var(--text-secondary)]" />
      </div>
      <h3 className="text-base font-medium text-[var(--text-primary)] mb-1">Let's get started</h3>
      <p className="text-xs text-[var(--text-secondary)] text-center mb-6 max-w-[250px]">
        Please enter your details so we can assist you better and follow up if needed.
      </p>
      
      <form onSubmit={handleSubmit} className="w-full max-w-[280px] space-y-3">
        <div>
          <input 
            aria-label="Your Name" 
            type="text" 
            required 
            placeholder="Your Name" 
            className="w-full p-2.5 border border-[var(--border-strong)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-md focus:outline-none focus:ring-2 transition-all text-sm shadow-sm" 
            style={{ '--tw-ring-color': 'var(--primary-color)' } as any} 
            value={name} 
            onChange={e => setName(e.target.value)} 
          />
        </div>
        <div>
          <input 
            aria-label="Your Email" 
            type="email" 
            required 
            placeholder="Your Email" 
            className="w-full p-2.5 border border-[var(--border-strong)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-md focus:outline-none focus:ring-2 transition-all text-sm shadow-sm" 
            style={{ '--tw-ring-color': 'var(--primary-color)' } as any} 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
          />
        </div>
        <button 
          aria-label="Start Chat" 
          type="submit" 
          disabled={isSubmitting} 
          className="w-full py-3 rounded-md hover:opacity-90 transition-all font-medium shadow-sm mt-2 disabled:opacity-50 active:scale-95" 
          style={{ backgroundColor: 'var(--primary-color)', color: '#ffffff' }}
        >
          {isSubmitting ? 'Starting chat...' : 'Start Chat'}
        </button>
      </form>
    </div>
  );
}
