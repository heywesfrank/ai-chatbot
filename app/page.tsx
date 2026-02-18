'use client';

export default function Dashboard() {
  const handleConnect = () => {
    // Redirects to your backend route that initiates the GitBook OAuth flow
    window.location.href = '/api/auth/gitbook';
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 p-10 font-sans flex flex-col items-center justify-center">
      <div className="max-w-xs w-full text-center">
        <h1 className="text-xl font-medium mb-1">Knowledge Base</h1>
        <p className="text-gray-500 mb-6 text-sm">Connect your GitBook to train the AI.</p>
        
        <button 
          onClick={handleConnect}
          className="w-full bg-black text-white p-3 rounded-sm hover:bg-gray-800 transition-colors text-sm font-medium"
        >
          Connect GitBook
        </button>
      </div>
    </div>
  );
}
