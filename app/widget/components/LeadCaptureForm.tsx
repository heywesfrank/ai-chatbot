// app/widget/components/LeadCaptureForm.tsx
import { useState } from 'react';
import { LeadIcon } from '@/components/icons';

export default function LeadCaptureForm({ primaryColor, botAvatar, headerText, removeBranding, handleLeadSubmit, isSubmittingLead }: any) {
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLeadSubmit(leadName, leadEmail);
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans text-sm" style={{ '--primary-color': primaryColor } as React.CSSProperties}>
      <div className="p-4 font-medium text-center shadow-sm text-white flex justify-center items-center" style={{ backgroundColor: 'var(--primary-color)' }}>
        <div className="flex items-center gap-2">
          {botAvatar && <img src={botAvatar} alt="Avatar" className="w-6 h-6 rounded-full object-cover border border-white/20 shadow-sm" />}
          <span>{headerText}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-300">
        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
          <LeadIcon className="w-5 h-5 text-gray-400" />
        </div>
        <h3 className="text-base font-medium text-gray-900 mb-1">Let's get started</h3>
        <p className="text-xs text-gray-500 text-center mb-6 max-w-[250px]">Please enter your details so we can assist you better and follow up if needed.</p>
        
        <form onSubmit={onSubmit} className="w-full max-w-[280px] space-y-3">
          <div>
            <input aria-label="Your Name" type="text" required placeholder="Your Name" className="w-full p-2.5 border border-gray-200 rounded-sm focus:outline-none transition-colors text-sm bg-gray-50/50 text-gray-800" value={leadName} onChange={e => setLeadName(e.target.value)} />
          </div>
          <div>
            <input aria-label="Your Email" type="email" required placeholder="Your Email" className="w-full p-2.5 border border-gray-200 rounded-sm focus:outline-none transition-colors text-sm bg-gray-50/50 text-gray-800" value={leadEmail} onChange={e => setLeadEmail(e.target.value)} />
          </div>
          <button aria-label="Start Chat" type="submit" disabled={isSubmittingLead} className="w-full text-white py-2.5 rounded-sm hover:opacity-90 transition-opacity font-medium shadow-sm mt-2 disabled:opacity-50" style={{ backgroundColor: 'var(--primary-color)' }}>
            {isSubmittingLead ? 'Starting chat...' : 'Start Chat'}
          </button>
        </form>
      </div>
      {!removeBranding && (
        <div className="py-2 text-center text-[10px] text-gray-400 bg-gray-50 border-t border-gray-100 flex justify-center items-center">
          Powered by <a href="#" target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-500 hover:text-gray-800 ml-1 transition-colors">Knowledge Bot</a>
        </div>
      )}
    </div>
  );
}
