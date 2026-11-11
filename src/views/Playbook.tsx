import { useState } from 'react';
import { Check, Copy, Linkedin, Mail, Phone, ThumbsDown, ThumbsUp } from 'lucide-react';
import { CHANNELS, PRINCIPLES, SCENARIO, SEQUENCE, type Channel } from '../lib/playbook';
import { PageHeader, useToast } from '../components/ui';

const ICONS = { linkedin: Linkedin, email: Mail, call: Phone };

function CopyButton({ text }: { text: string }) {
  const toast = useToast();
  const [done, setDone] = useState(false);
  return (
    <button className="btn py-1" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); toast('Copied'); setTimeout(() => setDone(false), 1500); }
      catch { toast('Could not copy: select the text instead'); }
    }}>
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy
    </button>
  );
}

function RolePlay({ channel }: { channel: Channel }) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-bold">Role play</h3>
      <p className="mt-1 text-xs text-gray-500">{channel.roleplay.setting}</p>
      <div className="mt-3 space-y-2">
        {channel.roleplay.lines.map((l, i) => l.who === 'note' ? (
          <p key={i} className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-[11px] italic text-gray-600">{l.text}</p>
        ) : (
          <div key={i} className={`flex ${l.who === 'you' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-line ${
              l.who === 'you' ? 'rounded-br-md bg-brand-500 text-white' : 'rounded-bl-md bg-[#eef2f8] text-[#172338]'}`}>
              <div className={`mb-0.5 text-[10px] font-bold uppercase tracking-wide ${l.who === 'you' ? 'text-white/70' : 'text-gray-500'}`}>
                {l.who === 'you' ? 'You' : SCENARIO.prospect.split(',')[0]}
              </div>
              {l.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Playbook() {
  const [tab, setTab] = useState<Channel['id']>('linkedin');
  const channel = CHANNELS.find(c => c.id === tab)!;

  return (
    <>
      <PageHeader eyebrow="Sales enablement" title="Outreach Playbook"
        sub="How to turn a Radar signal into a conversation on LinkedIn, by email and by phone, with a worked role play for each. For a ready-made draft, use the Outreach button on any signal in the Intelligence Feed, or Draft outreach on an opportunity." />

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-4">
          <h2 className="text-sm font-bold">Principles for every channel</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] text-gray-700">{PRINCIPLES.map(p => <li key={p}>{p}</li>)}</ol>
        </div>
        <div className="card p-4">
          <h2 className="text-sm font-bold">Suggested sequence</h2>
          <ol className="mt-2 space-y-2">
            {SEQUENCE.map(s => (
              <li key={s.day} className="flex gap-3 text-[13px]">
                <span className="w-14 shrink-0 rounded-md bg-brand-50 px-2 py-0.5 text-center text-[11px] font-bold text-brand-600">{s.day}</span>
                <span className="text-gray-700">{s.step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="card mt-3 p-4">
        <h2 className="text-sm font-bold">The scenario used in the role plays</h2>
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
          <div><dt className="inline font-semibold">Signal: </dt><dd className="inline text-gray-700">{SCENARIO.signal}</dd></div>
          <div><dt className="inline font-semibold">Service line: </dt><dd className="inline text-gray-700">{SCENARIO.service}</dd></div>
          <div><dt className="inline font-semibold">Prospect: </dt><dd className="inline text-gray-700">{SCENARIO.prospect}</dd></div>
          <div><dt className="inline font-semibold">Caller: </dt><dd className="inline text-gray-700">{SCENARIO.you}</dd></div>
        </dl>
      </div>

      <div className="mt-5 flex gap-1 border-b border-line" role="tablist">
        {CHANNELS.map(c => {
          const Icon = ICONS[c.id];
          return (
            <button key={c.id} role="tab" aria-selected={tab === c.id} onClick={() => setTab(c.id)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === c.id ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              <Icon className="h-4 w-4" /> {c.name}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[13px] text-gray-600">{channel.when}</p>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-3">
          <div className="card p-4">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-teal-700"><ThumbsUp className="h-4 w-4" /> Do</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] text-gray-700">{channel.hints.do.map(h => <li key={h}>{h}</li>)}</ul>
            <h3 className="mt-4 flex items-center gap-1.5 text-sm font-bold text-red-700"><ThumbsDown className="h-4 w-4" /> Avoid</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] text-gray-700">{channel.hints.avoid.map(h => <li key={h}>{h}</li>)}</ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-bold">Handling objections</h3>
            <div className="mt-2 space-y-3">
              {channel.objections.map(o => (
                <div key={o.says} className="text-[13px]">
                  <div className="font-semibold text-gray-800">{o.says}</div>
                  <div className="mt-0.5 text-gray-700">{o.reply}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <RolePlay channel={channel} />
      </div>

      <div className="card mt-3 p-4">
        <h3 className="text-sm font-bold">Templates</h3>
        <p className="mt-1 text-xs text-gray-500">Replace the [brackets] with details from the signal: use its summary, "Why this score" and "To improve" lines.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {channel.templates.map(t => (
            <div key={t.title} className="flex flex-col rounded-xl border border-line p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[13px] font-semibold">{t.title}</div>
                <CopyButton text={t.body} />
              </div>
              <pre className="flex-1 whitespace-pre-wrap rounded-lg bg-[#f8fafc] p-3 font-sans text-[12px] leading-relaxed text-gray-700">{t.body}</pre>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
