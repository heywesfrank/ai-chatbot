'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // If already logged in, send directly to the app
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/home');
    });
  }, [router]);

  const handleAuth = async (type: 'login' | 'signup') => {
    setIsLoading(true);
    const { error } = type === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (error) {
      toast.error(error.message);
      setIsLoading(false);
    } else {
      router.push('/home');
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#FAFAFA] font-sans">
      <Toaster position="top-center" />
      <div className="w-full max-w-sm p-8 bg-white border border-gray-200 rounded-sm shadow-[0_2px_10px_rgba(0,0,0,0.02)] animate-fade-in">
        <h2 className="text-lg font-medium mb-6 text-gray-900 text-center tracking-tight">Access Workspace</h2>
        <div className="space-y-4">
          <input 
            type="email" 
            placeholder="Email address"
            className="w-full p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:border-black transition-colors text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input 
            type="password" 
            placeholder="Password"
            className="w-full p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:border-black transition-colors text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex gap-3 pt-2">
            <button 
              onClick={() => handleAuth('login')}
              disabled={isLoading || !email || !password}
              className="flex-1 bg-black text-white p-2.5 rounded-sm hover:bg-gray-800 disabled:bg-gray-300 transition-colors text-sm font-medium"
            >
              {isLoading ? '...' : 'Sign In'}
            </button>
            <button 
              onClick={() => handleAuth('signup')}
              disabled={isLoading || !email || !password}
              className="flex-1 bg-white border border-gray-300 text-gray-900 p-2.5 rounded-sm hover:bg-gray-50 disabled:bg-gray-100 transition-colors text-sm font-medium"
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
