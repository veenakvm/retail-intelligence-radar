import { ArrowRight, CalendarClock, CheckCircle2, CircleDashed, CircleDot, Radio, Terminal, Webhook } from 'lucide-react';
import type { View } from '../App';
import { PageHeader } from '../components/ui';

type Status = 'live' | 'partial' | 'planned';
type Trigger = 'Prompt' | 'Signal' | 'Webhook' | 'Schedule';

interface Workflow {
  n: string; name: string; status: Status; trigger: Trigger;
  what: string; how: string; go?: { view: View; label: string }; needs?: string;
}

const STAGES: { title: string; goal: string; items: Workflow[] }[] = [
  {
    title: 'Find', goal: 'Spot retailers with a reason to buy, before competitors do.',
    items: [
      { n: '01', name: 'New lead research', status: 'live', trigger: 'Signal',
        what: 'Collects retail news twice a day, scores each article for AlgoShack fit, and adds articles scoring 80+ to the pipeline automatically. Each opportunity has a one-click account brief.',
        how: 'Check the Intelligence Feed each morning. Open “Auto” cards in the pipeline and click Brief → Create brief.',
        go: { view: 'feed', label: 'Intelligence Feed' } },
      { n: '02', name: 'Visitor follow-up', status: 'planned', trigger: 'Webhook',
        what: 'When a target retailer visits the AlgoShack website, alert the account owner with the pages they read and a suggested message.',
        how: '', needs: 'A website-visitor tool on algoshack.com (for example Leadfeeder, Albacross or Clearbit Reveal) that can send alerts to the Radar.' },
      { n: '03', name: 'Job change alerts', status: 'planned', trigger: 'Schedule',
        what: 'When a contact or a target role (CTO, head of QA, retail IT) changes at a tracked account, flag it as a warm moment to reach out.',
        how: '', needs: 'A weekly re-check of saved contacts through Apollo (uses Apollo credits).' },
      { n: '04', name: 'Post engagement to DM', status: 'planned', trigger: 'Webhook',
        what: 'When someone from a target account likes or comments on an AlgoShack LinkedIn post, suggest a personal follow-up message.',
        how: '', needs: 'LinkedIn engagement data from a licensed tool (for example Sales Navigator or a LinkedIn-approved partner). We do not scrape LinkedIn.' },
    ],
  },
  {
    title: 'Engage and win', goal: 'Turn a signal into a meeting, a proposal and a decision.',
    items: [
      { n: '05', name: 'Meeting prep', status: 'live', trigger: 'Prompt',
        what: 'Agenda, discovery questions, likely objections with replies, and what a good outcome looks like, from the account’s news, contacts and call history.',
        how: 'Pipeline → open the opportunity → Brief → type the meeting goal → Create meeting prep.',
        go: { view: 'pipeline', label: 'Opportunity Pipeline' } },
      { n: '06', name: 'Call notes to CRM', status: 'live', trigger: 'Prompt',
        what: 'Paste rough notes; get a summary, pain points, commitments and risks, plus suggested stage, next action and new contacts to apply with one click.',
        how: 'Pipeline → open the opportunity → Call notes → paste → Summarise → Apply what is right.',
        go: { view: 'pipeline', label: 'Opportunity Pipeline' } },
      { n: '07', name: 'Proposal draft', status: 'live', trigger: 'Prompt',
        what: 'A first-draft proposal from the opportunity, service line, call notes and brief. Prices, timelines and team are left as [placeholders].',
        how: 'Pipeline → open the opportunity → Proposal → add guidance → Create draft → edit → Save or Copy.',
        go: { view: 'pipeline', label: 'Opportunity Pipeline' } },
      { n: '08', name: 'Lost deal review', status: 'live', trigger: 'Prompt',
        what: 'Closing a deal asks for won or lost and why; the reason is categorised and a lesson for next time is saved and fed into the weekly report.',
        how: 'Move an opportunity to Closed (drag on the board or change Stage) and fill in the box.',
        go: { view: 'pipeline', label: 'Opportunity Pipeline' } },
    ],
  },
  {
    title: 'Learn and market', goal: 'Keep the team, leadership and the market informed.',
    items: [
      { n: '09', name: 'Weekly pipeline report', status: 'live', trigger: 'Schedule',
        what: 'Every Monday 08:43 IST: pipeline counts, stage moves, stalled deals, wins and losses, the week’s best signals and recommended actions. Can also be emailed.',
        how: 'Open Weekly Report on Monday morning; use it in the team meeting.',
        go: { view: 'report', label: 'Weekly Report' } },
      { n: '10', name: 'Content from calls', status: 'partial', trigger: 'Schedule',
        what: 'Three LinkedIn post ideas each week, drawn from that week’s retail trends (no client names).',
        how: 'Weekly Report → LinkedIn post ideas → Copy → add your own view before posting.',
        go: { view: 'report', label: 'Weekly Report' },
        needs: 'Also draw anonymised themes from the week’s call notes.' },
      { n: '11', name: 'Competitor watch', status: 'live', trigger: 'Schedule',
        what: 'News on competing QA and testing firms, collected with every data run, filterable by competitor.',
        how: 'Check Competitor Watch weekly; use launches and price changes as talking points.',
        go: { view: 'competitors', label: 'Competitor Watch' } },
    ],
  },
  {
    title: 'Retain and grow', goal: 'Protect and expand existing clients.',
    items: [
      { n: '12', name: 'Renewal risk', status: 'planned', trigger: 'Schedule',
        what: 'Flag clients with renewals coming up and warning signs (leadership change, layoffs, new vendor news, quiet accounts).',
        how: '', needs: 'A list of current clients with contract or renewal dates, added to the Radar.' },
    ],
  },
];

const TRIGGERS: { name: Trigger; icon: typeof Terminal; text: string }[] = [
  { name: 'Prompt', icon: Terminal, text: 'A team member clicks a button (brief, prep, notes, proposal).' },
  { name: 'Signal', icon: Radio, text: 'A news event at a target retailer.' },
  { name: 'Webhook', icon: Webhook, text: 'An outside tool sends an event (website visit, LinkedIn engagement).' },
  { name: 'Schedule', icon: CalendarClock, text: 'Runs on a timetable (daily collection, Monday report).' },
];

const STATUS: Record<Status, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  live: { label: 'Live', cls: 'bg-teal-50 text-teal-700', icon: CheckCircle2 },
  partial: { label: 'Partly live', cls: 'bg-amber-50 text-amber-700', icon: CircleDot },
  planned: { label: 'Phase 2', cls: 'bg-gray-100 text-gray-600', icon: CircleDashed },
};

const RHYTHM = [
  { when: 'Every morning (10 min)', what: 'Scan the Intelligence Feed and new “Auto” pipeline cards; assign owners; create briefs for the best two or three.' },
  { when: 'Before each meeting', what: 'Brief → Meeting prep, with the meeting goal.' },
  { when: 'After each call', what: 'Call notes → Summarise → Apply the stage, next action and new contacts.' },
  { when: 'After a good discovery call', what: 'Proposal → Create draft → edit the placeholders → send.' },
  { when: 'When a deal ends', what: 'Move it to Closed and record won or lost and why.' },
  { when: 'Monday', what: 'Review the Weekly Report as a team: stalled deals, actions for the week, one LinkedIn post. Glance at Competitor Watch.' },
];

export default function GtmWorkflows({ go }: { go: (v: View) => void }) {
  const all = STAGES.flatMap(s => s.items);
  const count = (s: Status) => all.filter(w => w.status === s).length;

  return (
    <>
      <PageHeader eyebrow="Go-to-market" title="GTM Workflows"
        sub="Twelve sales workflows, from finding a lead to keeping a client, and where each one runs in the Radar." />

      <div className="mb-4 grid grid-cols-3 gap-3">
        {(['live', 'partial', 'planned'] as const).map(s => {
          const S = STATUS[s];
          return (
            <div key={s} className="card flex items-center gap-3 p-4">
              <S.icon className={`h-5 w-5 ${s === 'live' ? 'text-teal-600' : s === 'partial' ? 'text-amber-500' : 'text-gray-400'}`} />
              <div><div className="text-xl font-bold text-[#172338]">{count(s)}</div><div className="text-[11px] text-gray-500">{S.label}</div></div>
            </div>
          );
        })}
      </div>

      <div className="card mb-4 p-4">
        <h2 className="text-sm font-bold">How workflows start</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TRIGGERS.map(t => (
            <div key={t.name} className="flex gap-2.5 rounded-lg bg-[#f4f7fb] p-3">
              <t.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              <div><div className="text-xs font-bold">{t.name}</div><div className="text-[11px] text-gray-600">{t.text}</div></div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        {STAGES.map((stage, i) => (
          <section key={stage.title}>
            <div className="mb-2 flex flex-wrap items-baseline gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white">{i + 1}</span>
              <h2 className="text-base font-bold text-[#172338]">{stage.title}</h2>
              <span className="text-xs text-gray-500">{stage.goal}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {stage.items.map(w => {
                const S = STATUS[w.status];
                return (
                  <article key={w.n} className={`card flex flex-col p-4 ${w.status === 'planned' ? 'border-dashed' : ''}`}>
                    <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                      <span className="font-mono text-xs font-bold text-gray-400">{w.n}</span>
                      <h3 className="min-w-[140px] flex-1 text-sm font-bold">{w.name}</h3>
                      <span className="rounded-full bg-[#eef2f8] px-2 py-0.5 text-[10px] font-semibold text-gray-600">{w.trigger}</span>
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${S.cls}`}><S.icon className="h-3 w-3" />{S.label}</span>
                    </div>
                    <p className="mt-2 text-[13px] text-gray-700">{w.what}</p>
                    {w.how && <p className="mt-2 text-xs text-gray-600"><b>How to use:</b> {w.how}</p>}
                    {w.needs && <p className="mt-2 rounded-md bg-[#f8fafc] p-2 text-xs text-gray-600"><b>{w.status === 'planned' ? 'Needs:' : 'Next:'}</b> {w.needs}</p>}
                    {w.go && (
                      <button className="btn mt-3 self-start" onClick={() => go(w.go!.view)}>
                        Open {w.go.label} <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="card mt-5 p-4">
        <h2 className="text-sm font-bold">The team’s weekly rhythm</h2>
        <ol className="mt-3 divide-y divide-line">
          {RHYTHM.map(r => (
            <li key={r.when} className="grid gap-1 py-2.5 text-[13px] sm:grid-cols-[220px_1fr]">
              <span className="font-semibold text-[#172338]">{r.when}</span>
              <span className="text-gray-700">{r.what}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[11px] text-gray-500">AI output is a first draft. Check facts, prices and names before anything goes to a client.</p>
      </div>
    </>
  );
}
