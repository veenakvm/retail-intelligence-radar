import { useState } from 'react';
import { Info } from 'lucide-react';
import { toServiceLine, type ServiceLine } from '../lib/serviceLines';
import { Dialog } from './overlay';

/** Explanation of one service line: what it covers, signals that point to it, an example and discovery questions. */
export function ServiceLineDetail({ line }: { line: ServiceLine }) {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-gray-700">{line.summary}</p>
      <section>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">What it covers</h3>
        <ul className="list-disc space-y-1 pl-5 text-gray-700">{line.covers.map(c => <li key={c}>{c}</li>)}</ul>
      </section>
      <section>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">News signals that point to it</h3>
        <ul className="list-disc space-y-1 pl-5 text-gray-700">{line.signals.map(c => <li key={c}>{c}</li>)}</ul>
      </section>
      <section className="rounded-lg bg-[#f4f7fb] p-3">
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Example</h3>
        <p className="text-gray-700">{line.example}</p>
      </section>
      <section>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Questions to ask the client</h3>
        <ol className="list-decimal space-y-1 pl-5 text-gray-700">{line.questions.map(c => <li key={c}>{c}</li>)}</ol>
      </section>
    </div>
  );
}

/** Service-line label that opens its explanation when clicked. Falls back to plain text for unknown labels. */
export function ServiceLineChip({ label }: { label: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const line = toServiceLine(label);
  if (!label) return null;
  if (!line) return <span className="font-semibold">{label}</span>;
  return (
    <>
      <button type="button" onClick={e => { e.stopPropagation(); setOpen(true); }}
        className="inline-flex items-center gap-1 font-semibold text-[#172338] underline decoration-dotted decoration-gray-400 underline-offset-2 hover:text-brand-600"
        title={`${line.summary} Click for details.`}>
        {line.name}<Info className="h-3 w-3 text-gray-400" />
      </button>
      {open && <Dialog title={line.name} onClose={() => setOpen(false)} wide><ServiceLineDetail line={line} /></Dialog>}
    </>
  );
}
