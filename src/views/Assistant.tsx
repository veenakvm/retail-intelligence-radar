import { useRef, useState } from 'react';
import { ExternalLink, Send, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/format';
import { PageHeader } from '../components/ui';

interface Source { n: number; title: string; url: string; publisher: string; published_at: string | null; company: string | null }
interface Message { role: 'user' | 'assistant'; content: string; sources?: Source[]; error?: boolean }

const SUGGESTIONS = [
  'Which jewellery retailers in India announced expansion recently?',
  'Which US retailers raised funding or were acquired this month?',
  'Which accounts look like the best AlgoShack prospects right now, and why?',
  'What should I ask a retail CIO at a company that is modernising store systems?',
];

export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const history = messages.filter(m => !m.error).map(m => ({ role: m.role, content: m.content }));
    setMessages(m => [...m, { role: 'user', content: q }]);
    setInput('');
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('ask', { body: { question: q, history } });
    let reply: Message;
    if (error) {
      let detail = error.message;
      try { detail = (await (error as { context?: Response }).context?.json())?.error ?? detail; } catch { /* keep default */ }
      reply = { role: 'assistant', content: `Could not get an answer: ${detail}`, error: true };
    } else {
      reply = { role: 'assistant', content: data.answer, sources: data.sources };
    }
    setMessages(m => [...m, reply]);
    setBusy(false);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  return (
    <>
      <PageHeader eyebrow="Conversational research" title="Ask the Retail Radar"
        sub="Answers come only from articles the radar has collected, with numbered links to each source." />
      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <div className="card flex h-[560px] flex-col p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold"><Sparkles className="h-4 w-4 text-brand-500" /> Retail Intelligence Assistant</h3>
          <div className="flex-1 overflow-y-auto py-3">
            {messages.length === 0 && (
              <div className="max-w-[85%] rounded-xl bg-[#f1f4f8] p-3 text-xs leading-relaxed">
                Ask which companies show expansion or funding signals, which accounts may fit AlgoShack, or what to ask a retail CIO. I answer from the collected articles and cite each one.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`my-2 max-w-[85%] rounded-xl p-3 text-xs leading-relaxed whitespace-pre-wrap ${
                m.role === 'user' ? 'ml-auto bg-brand-50' : m.error ? 'bg-red-50 text-red-700' : 'bg-[#f1f4f8]'}`}>
                {m.content}
                {m.sources && m.sources.length > 0 && (
                  <ol className="mt-3 space-y-1 border-t border-line pt-2">
                    {m.sources.map(s => (
                      <li key={s.n} className="text-[11px]">
                        <a href={s.url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                          [{s.n}] {s.title} <ExternalLink className="inline h-3 w-3" />
                        </a>
                        <span className="text-gray-500"> · {s.publisher} · {formatDate(s.published_at)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
            {busy && <div className="my-2 inline-block rounded-xl bg-[#f1f4f8] p-3 text-xs text-gray-500">Researching the collected articles…</div>}
            <div ref={endRef} />
          </div>
          <form className="flex gap-2 border-t border-line pt-3" onSubmit={e => { e.preventDefault(); ask(input); }}>
            <input className="field flex-1" value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about retail investments, expansion or opportunities…" />
            <button className="btn-primary" disabled={busy || !input.trim()}><Send className="h-3.5 w-3.5" /> Send</button>
          </form>
        </div>
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-bold">Try asking</h3>
          <div className="space-y-2">
            {SUGGESTIONS.map(s => (
              <button key={s} className="btn w-full justify-start text-left font-medium" disabled={busy} onClick={() => ask(s)}>{s}</button>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-[#6c788a]">
            The assistant separates what sources report from its own inferences. It has no access to the open web; if something is not in the collected articles, it says so.
          </p>
        </div>
      </div>
    </>
  );
}
