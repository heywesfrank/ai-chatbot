// app/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { supabaseClient as supabase } from '@/lib/supabase-client';

const GithubIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
  </svg>
);

const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.371-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

export default function AuthPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
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
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: { first_name: firstName, last_name: lastName }
        }
      });
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

  const handleOAuth = async (provider: 'github' | 'discord') => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}`
      }
    });
    if (error) {
      toast.error(error.message);
      setIsLoading(false);
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

  const isFormValid = mode === 'login' 
    ? email && password 
    : email && password && firstName && lastName;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] font-sans px-4 py-8">
      <div className="w-full max-w-[400px] p-8 bg-white border border-gray-200/60 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300">
        <div className="mb-8 text-center">
          <img src="/apoyo.png" alt="Apoyo" className="h-10 w-auto mx-auto mb-5 object-contain" />
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
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <div className="flex gap-3 mb-6">
              <button type="button" onClick={() => handleOAuth('github')} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <GithubIcon /> GitHub
              </button>
              <button type="button" onClick={() => handleOAuth('discord')} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#5865F2] border border-[#5865F2] rounded-lg text-sm font-medium text-white hover:bg-[#4752C4] transition-colors">
                <DiscordIcon /> Discord
              </button>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-gray-500 font-medium">Or continue with</span>
              </div>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-3">
                {mode === 'signup' && (
                  <div className="flex gap-3">
                    <input type="text" placeholder="First Name" required className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all text-sm placeholder:text-gray-400" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    <input type="text" placeholder="Last Name" required className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all text-sm placeholder:text-gray-400" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                )}
                <div>
                  <input id="email" type="email" placeholder="name@example.com" required className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all text-sm placeholder:text-gray-400" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <input id="password" type="password" placeholder="Password" required className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all text-sm placeholder:text-gray-400" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              <button type="submit" disabled={isLoading || !isFormValid} className="w-full bg-black text-white py-2.5 rounded-lg hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium shadow-sm active:scale-[0.98]">
                {isLoading ? 'Please wait...' : (mode === 'login' ? 'Sign In' : 'Sign Up')}
              </button>
              <div className="text-center pt-2">
                <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="text-sm text-gray-500 hover:text-black transition-colors">
                  {mode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>
              </div>
            </form>
          </div>
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

        <div className="mt-8 text-center text-[11px] text-gray-400">
          By continuing, you agree to our <br className="sm:hidden" />
          <a href="https://heyapoyo.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-800 transition-colors">Terms of Service</a> and <a href="https://heyapoyo.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-800 transition-colors">Privacy Policy</a>.
        </div>
      </div>
    </div>
  );
}
