import { ReactNode } from 'react';

export default function PublicHelpCenterLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans text-gray-900 selection:bg-blue-100">
      {children}
      <div className="py-10 text-center text-xs text-gray-400">
        Powered by <a href="https://app.heyapoyo.com" className="font-medium text-gray-500 hover:text-gray-900 transition-colors">Apoyo</a>
      </div>
    </div>
  );
}
