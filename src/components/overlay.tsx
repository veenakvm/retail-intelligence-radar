import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

/** Centered dialog for short forms. */
export function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/40 p-4 sm:items-center" onMouseDown={onClose}>
      <div className={`card w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} p-5 shadow-xl`} onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Right-hand panel for viewing and editing one record without leaving the list. */
export function SidePanel({ title, subtitle, onClose, children }: { title: string; subtitle?: ReactNode; onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-40" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-navy/30" />
      <aside
        className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-2xl"
        onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold">{title}</h2>
            {subtitle && <div className="mt-0.5 text-xs text-gray-500">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}
