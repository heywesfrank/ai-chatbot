'use client';
import { useState } from 'react';

export default function Dashboard() {
  const [apiKey, setApiKey] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [embedCode, setEmbedCode] = useState('');

  const handleTrain = async () => {
    if (!apiKey || !spaceId) return alert('Please provide both an API Key and a Space ID.');
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, spaceId }),
      });

      if (response.ok) {
setEmbedCode(`<iframe src="https://ai-chatbot-alpha-orpin.vercel.app/widget?spaceId=${spaceId}" width="400" height="600" style="border: 1px solid #e5e7eb; border-radius: 4px;"></iframe>`);
      } else {
        alert('Failed to connect to GitBook. Please check your credentials.');
      }
    } catch (error) {
      console.error('Ingestion error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 p-10 font-sans flex flex-col items-center justify-center">
      <div className="max-w-sm w-full">
        <h1 className="text-xl font-medium mb-1">Knowledge Base</h1>
        <p className="text-gray-500 mb-6 text-sm">Sync your GitBook to train the AI.</p>
        
        <input 
          type="text" 
          placeholder="GitBook Personal Access Token"
          className="w-full p-3 mb-3 border border-gray-300 rounded-sm focus:outline-none focus:border-black text-sm"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />

        <input 
          type="text" 
          placeholder="GitBook Space ID"
          className="w-full p-3 mb-6 border border-gray-300 rounded-sm focus:outline-none focus:border-black text-sm"
          value={spaceId}
          onChange={(e) => setSpaceId(e.target.value)}
        />
        
        <button 
          onClick={handleTrain}
          disabled={isLoading}
          className="w-full bg-black text-white p-3 rounded-sm hover:bg-gray-800 disabled:bg-gray-300 transition-colors text-sm font-medium"
        >
          {isLoading ? 'Syncing...' : 'Train AI & Get Widget'}
        </button>

        {embedCode && (
          <div className="mt-8 animate-fade-in">
            <h2 className="text-sm font-medium mb-2">Your Embed Code:</h2>
            <textarea 
              readOnly 
              className="w-full p-3 border border-gray-300 rounded-sm bg-gray-50 text-xs font-mono h-24 focus:outline-none"
              value={embedCode}
              onClick={(e) => e.currentTarget.select()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
