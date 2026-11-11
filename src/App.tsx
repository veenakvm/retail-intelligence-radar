import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Activity, BarChart3, BookOpen, ChevronDown, Contact as ContactIcon, Database, LayoutDashboard, LogOut, Menu, Plus, Sparkles, Target, TrendingUp, X, type LucideIcon } from 'lucide-react';
import { isConfigured, supabase } from './lib/supabase';
import { ToastProvider, Spinner } from './components/ui';
import Login, { SetPassword } from './views/Login';
import Overview from './views/Overview';
import Feed from './views/Feed';
import Investments from './views/Investments';
import Pipeline from './views/Pipeline';
import Assistant from './views/Assistant';
import Sources from './views/Sources';
import Contacts from './views/Contacts';
import ServiceLines from './views/ServiceLines';

export type View = 'home' | 'feed' | 'invest' | 'pipeline' | 'contacts' | 'services' | 'assistant' | 'sources';

const NAV: { id: View; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Overview', icon: LayoutDashboard },
  { id: 'feed', label: 'Intelligence Feed', icon: Activity },
  { id: 'invest', label: 'Investment Radar', icon: TrendingUp },
  { id: 'pipeline', label: 'Opportunity Pipeline', icon: Target },
  { id: 'contacts', label: 'Contacts', icon: ContactIcon },
  { id: 'services', label: 'Service Lines', icon: BookOpen },
  { id: 'assistant', label: 'AI Research Assistant', icon: Sparkles },
  { id: 'sources', label: 'Data Sources & Health', icon: Database },
];

// Invite and password-reset links land here with type=invite / type=recovery in the URL hash.
const arrivedToSetPassword = /type=(invite|recovery)/.test(window.location.hash);

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState<boolean | null>(null);
  const [needsPassword, setNeedsPassword] = useState(arrivedToSetPassword);
  const [view, setView] = useState<View>('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [newMenu, setNewMenu] = useState(false);
  const [pendingNew, setPendingNew] = useState<'pipeline' | 'contacts' | null>(null);
  const [feedServiceLine, setFeedServiceLine] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setNeedsPassword(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) { setIsMember(null); return; }
    supabase.from('team_members').select('user_id').eq('user_id', userId).maybeSingle()
      .then(({ data }) => setIsMember(!!data));
  }, [userId]);

  if (!isConfigured) {
    return <div className="p-8 text-sm">Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</div>;
  }
  if (loading) return <Spinner />;
  if (!session) return <Login />;
  if (needsPassword) {
    return <SetPassword onDone={() => { setNeedsPassword(false); history.replaceState(null, '', window.location.pathname); }} />;
  }
  if (isMember === null) return <Spinner />;
  if (!isMember) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="card max-w-sm p-6">
          <h1 className="text-lg font-bold">No team access</h1>
          <p className="mt-2 text-sm text-gray-600">{session.user.email} is not on the team list. Ask an admin to invite you.</p>
          <button className="btn mt-4" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>
    );
  }

  const clearPending = () => setPendingNew(null);
  const clearFeedFilter = () => setFeedServiceLine(undefined);
  const go = (v: View) => { setView(v); setMenuOpen(false); window.scrollTo({ top: 0 }); };
  const active = NAV.find(n => n.id === view)!;

  const sidebar = (
    <div className="flex h-full flex-col bg-navy p-4 text-white">
      <div className="mb-6 flex items-center gap-2.5 px-1">
        <img src={`${import.meta.env.BASE_URL}radar.svg`} alt="" className="h-8 w-8" />
        <div>
          <div className="text-[15px] font-bold leading-tight">Retail Intelligence</div>
          <div className="text-[10px] uppercase tracking-widest text-navy-300">Radar · India + USA</div>
        </div>
        <button className="ml-auto rounded p-1 text-navy-200 hover:bg-navy-600 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
      </div>
      <nav className="flex-1 space-y-1" aria-label="Main">
        {NAV.map(n => {
          const Icon = n.icon;
          const on = n.id === view;
          return (
            <button key={n.id} onClick={() => go(n.id)} aria-current={on ? 'page' : undefined}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm ${on ? 'bg-navy-600 text-white' : 'text-navy-200 hover:bg-navy-600 hover:text-white'}`}>
              <Icon className="h-4 w-4 shrink-0" /> {n.label}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-white/10 pt-3 text-xs">
        <div className="truncate text-navy-200">{session.user.email}</div>
        <button className="mt-2 flex items-center gap-1.5 text-navy-300 hover:text-white" onClick={() => supabase.auth.signOut()}>
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-navy-300"><BarChart3 className="h-3 w-3" /> Live public-source data, updated daily</p>
      </div>
    </div>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen lg:grid lg:grid-cols-[230px_1fr]">
        <aside className="hidden lg:block lg:sticky lg:top-0 lg:h-screen">{sidebar}</aside>
        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-navy/50" onClick={() => setMenuOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
          </div>
        )}
        <main className="min-w-0">
          <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-white px-4 py-3.5 text-sm sm:px-6">
            <button className="-ml-1 rounded p-1.5 text-gray-600 hover:bg-gray-100 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            <span className="text-gray-500">Workspace /</span> <b className="truncate">{active.label}</b>
            <div className="relative ml-auto">
              <button className="btn-primary" onClick={() => setNewMenu(m => !m)} aria-expanded={newMenu} aria-haspopup="menu">
                <Plus className="h-3.5 w-3.5" /> New <ChevronDown className="h-3 w-3" />
              </button>
              {newMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setNewMenu(false)} />
                  <div role="menu" className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-lg">
                    <button role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                      onClick={() => { setNewMenu(false); setPendingNew('pipeline'); go('pipeline'); }}>
                      <Target className="h-4 w-4 text-gray-500" /> Opportunity
                    </button>
                    <button role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                      onClick={() => { setNewMenu(false); setPendingNew('contacts'); go('contacts'); }}>
                      <ContactIcon className="h-4 w-4 text-gray-500" /> Contact
                    </button>
                  </div>
                </>
              )}
            </div>
          </header>
          <div className="mx-auto max-w-[1400px] p-4 sm:p-6">
            {view === 'home' && <Overview go={go} />}
            {view === 'feed' && <Feed initialServiceLine={feedServiceLine} onFilterApplied={clearFeedFilter} />}
            {view === 'services' && <ServiceLines openFeed={l => { setFeedServiceLine(l); go('feed'); }} />}
            {view === 'invest' && <Investments />}
            {view === 'pipeline' && <Pipeline openNew={pendingNew === 'pipeline'} onNewHandled={clearPending} />}
            {view === 'contacts' && <Contacts openNew={pendingNew === 'contacts'} onNewHandled={clearPending} />}
            {view === 'assistant' && <Assistant />}
            {view === 'sources' && <Sources />}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
