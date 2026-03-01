// app/help/[spaceId]/layout.tsx
import { ReactNode } from 'react';

export default function PublicHelpCenterLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-blue-100 flex flex-col">
      <div className="flex-1">
        {children}
      </div>
      <div className="py-10 flex items-center justify-center text-xs text-gray-400 shrink-0 border-t border-gray-50">
        Powered by 
        <a href="https://app.heyapoyo.com" target="_blank" rel="noopener noreferrer" className="ml-1.5 flex items-center">
          <img src="/apoyo.png" alt="Apoyo" className="h-[18px] object-contain opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-200" />
        </a>
      </div>
    </div>
  );
}
