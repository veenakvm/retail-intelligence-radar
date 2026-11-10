import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ErrorNote } from '../components/ui';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}radar.svg`} alt="" className="h-10 w-10" />
          <div>
            <div className="text-base font-bold leading-tight">Retail Intelligence Radar</div>
            <div className="text-[10px] uppercase tracking-widest text-gray-500">India + USA · Team workspace</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Login() {
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setError(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message);
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + import.meta.env.BASE_URL });
      if (error) setError(error.message); else setInfo('If that email belongs to a team member, a reset link is on its way.');
    }
    setBusy(false);
  };

  return (
    <Shell>
      <h1 className="text-xl font-bold">{mode === 'login' ? 'Sign in' : 'Reset password'}</h1>
      <p className="mt-1 mb-5 text-xs text-gray-500">
        {mode === 'login' ? 'Team access only. Ask an admin to invite you.' : 'We will email you a link to set a new password.'}
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label" htmlFor="email">Work email</label>
          <input id="email" type="email" required className="field" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></div>
        {mode === 'login' && (
          <div><label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" required className="field" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></div>
        )}
        {error && <ErrorNote message={error} />}
        {info && <div className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700">{info}</div>}
        <button className="btn-primary w-full py-2.5 text-sm" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Send reset link'}</button>
      </form>
      <button className="mt-4 text-xs text-brand-600 hover:underline" onClick={() => { setMode(mode === 'login' ? 'reset' : 'login'); setError(''); setInfo(''); }}>
        {mode === 'login' ? 'Forgot password?' : 'Back to sign in'}
      </button>
    </Shell>
  );
}

/** Shown after an invite or password-reset link: the user chooses their password. */
export function SetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setError(error.message); else onDone();
  };
  return (
    <Shell>
      <h1 className="text-xl font-bold">Choose your password</h1>
      <p className="mt-1 mb-5 text-xs text-gray-500">You will use it with your email to sign in from now on.</p>
      <form onSubmit={save} className="space-y-3">
        <input type="password" className="field" value={password} onChange={e => setPassword(e.target.value)} placeholder="New password (8+ characters)" autoComplete="new-password" />
        {error && <ErrorNote message={error} />}
        <button className="btn-primary w-full py-2.5 text-sm">Save password</button>
      </form>
    </Shell>
  );
}
