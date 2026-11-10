import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

const BADGE: Record<string, string> = {
  Investment: 'bg-[#e9f7f2] text-[#14765e]',
  Expansion: 'bg-[#fff4df] text-[#956317]',
  Technology: 'bg-[#edf1ff] text-[#425db1]',
  Acquisition: 'bg-[#f6ecfb] text-[#7a3f9a]',
};

export function SignalBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-gray-400 text-[11px]">Unclassified</span>;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE[type] ?? 'bg-gray-100 text-gray-600'}`}>
      {type}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="inline-block rounded-full bg-[#eef2f8] px-2 py-0.5 text-[10px] text-[#56657a]">{children}</span>;
}

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow: string; title: string; sub: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-brand-500">{eyebrow}</div>
        <h1 className="mt-1 text-2xl font-bold text-[#172338]">{title}</h1>
        <p className="mt-1 text-xs text-[#6c788a]">{sub}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-[#56657a]">{label}</div>
      <div className="mt-2 text-2xl font-bold text-[#172338]">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-[#6c788a]">{sub}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-gray-500">{children}</div>;
}

export function ErrorNote({ message }: { message: string }) {
  return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div>;
}

const ToastContext = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(cur => (cur === m ? null : cur)), 2500);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg && (
        <div role="status" className="fixed bottom-5 right-5 z-50 rounded-lg bg-navy px-4 py-3 text-sm text-white shadow-lg">
          {msg}
        </div>
      )}
    </ToastContext.Provider>
  );
}
