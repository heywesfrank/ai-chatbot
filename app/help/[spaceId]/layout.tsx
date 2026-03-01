// app/help/[spaceId]/layout.tsx
import { ReactNode } from 'react';

export default function PublicHelpCenterLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans text-gray-900 selection:bg-blue-100 flex flex-col">
      <div className="flex-1">
        {children}
      </div>
      <div className="py-10 flex items-center justify-center text-xs text-gray-400 shrink-0">
        Powered by 
        <a href="https://app.heyapoyo.com" target="_blank" rel="noopener noreferrer" className="ml-1.5 hover:opacity-80 transition-opacity flex items-center">
          <img src="/apoyo.png" alt="Apoyo" className="h-[18px] object-contain" />
        </a>
      </div>
    </div>
  );
}
