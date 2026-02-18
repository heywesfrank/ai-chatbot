'use client';
import { useState } from 'react';

export default function Dashboard() {
  const [gitbookUrl, setGitbookUrl] = useState('');
  const [embedCode, setEmbedCode] = useState('');

  const handleTrain = async () => {
    // In the future, this will call /api/ingest
    alert(`Training started for: ${gitbookUrl}`);
    setEmbedCode(`<iframe src="https://your-vercel-url.vercel.app/widget" width="400" height="500" style="border: 1px solid #e5e7eb;"></iframe>`);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 p-10 font-sans">
      <div className="max-w-md mx-auto mt-20">
        <h1 className="text-2xl font-medium mb-2">Create your Chatbot</h1>
        <p className="text-gray-500 mb-8 text-sm">Enter a Gitbook URL to act as your knowledge base.</p>
        
        <input 
          type="url" 
          placeholder="https://docs.example.com"
          className="w-full p-3 mb-4 border border-gray-300 rounded-sm focus:outline-none focus:border-black transition-colors"
          value={gitbookUrl}
          onChange={(e) => setGitbookUrl(e.target.value)}
        />
        
        <button 
          onClick={handleTrain}
          className="w-full bg-black text-white p-3 rounded-sm hover:bg-gray-800 transition-colors"
        >
          Train & Get Embed Code
        </button>

        {embedCode && (
          <div className="mt-8">
            <h2 className="text-sm font-medium mb-2">Embed Code:</h2>
            <textarea 
              readOnly 
              className="w-full p-3 border border-gray-300 rounded-sm bg-gray-50 text-xs font-mono h-24 focus:outline-none"
              value={embedCode}
            />
          </div>
        )}
      </div>
    </div>
  );
}
