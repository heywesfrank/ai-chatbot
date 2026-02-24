// app/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { supabaseClient as supabase } from '@/lib/supabase-client';

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [step, setStep] = useState<'form' | 'otp'>('form');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.refresh();
        router.push('/knowledge');
      }
    });
  }, [router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        setIsLoading(false);
      } else {
        router.refresh();
        router.push('/knowledge');
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        toast.error(error.message);
        setIsLoading(false);
      } else {
        toast.success('Check your email for the verification code.');
        setStep('otp');
        setIsLoading(false);
      }
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'signup' });
    if (error) {
      toast.error(error.message);
      setIsLoading(false);
    } else {
      toast.success('Email confirmed successfully!');
      router.refresh();
      router.push('/knowledge');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] font-sans px-4">
      <div className="w-full max-w-[360px] p-8 bg-white border border-gray-200/60 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300">
        <div className="mb-8 text-center">
          <div className="mx-auto w-10 h-10 bg-black rounded-lg mb-4 flex items-center justify-center shadow-sm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 tracking-tight">
            {step === 'otp' ? 'Check your email' : (mode === 'login' ? 'Welcome back' : 'Create an account')}
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            {step === 'otp' 
              ? `We sent a 6-digit code to ${email}` 
              : (mode === 'login' ? 'Enter your details to sign in.' : 'Enter your details to get started.')}
          </p>
        </div>

        {step === 'form' ? (
          <form onSubmit={handleAuth} className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-3">
              <div>
                <input id="email" type="email" placeholder="name@example.com" required className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all text-sm placeholder:text-gray-400" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <input id="password" type="password" placeholder="Password" required className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all text-sm placeholder:text-gray-400" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
            <button type="submit" disabled={isLoading || !email || !password} className="w-full bg-black text-white py-2.5 rounded-lg hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium shadow-sm active:scale-[0.98]">
              {isLoading ? 'Please wait...' : (mode === 'login' ? 'Sign In' : 'Sign Up')}
            </button>
            <div className="text-center pt-2">
              <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="text-sm text-gray-500 hover:text-black transition-colors">
                {mode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <input id="otp" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={6} placeholder="000000" required className="w-full px-3 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all text-center text-2xl tracking-[0.5em] font-mono placeholder:text-gray-300" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
            </div>
            <button type="submit" disabled={isLoading || otp.length !== 6} className="w-full bg-black text-white py-2.5 rounded-lg hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium shadow-sm active:scale-[0.98]">
              {isLoading ? 'Verifying...' : 'Verify Email'}
            </button>
            <div className="text-center pt-2">
              <button type="button" onClick={() => setStep('form')} className="text-sm text-gray-500 hover:text-black transition-colors">
                Back to sign in
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
