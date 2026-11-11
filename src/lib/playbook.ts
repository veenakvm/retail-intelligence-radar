// Outreach playbook content: hints, role plays, templates and objection handling per channel.
// Placeholders in [square brackets] are filled in from the signal and contact.

export interface Line { who: 'you' | 'prospect' | 'note'; text: string }
export interface Template { title: string; body: string }
export interface Objection { says: string; reply: string }

export interface Channel {
  id: 'linkedin' | 'email' | 'call';
  name: string;
  when: string;
  hints: { do: string[]; avoid: string[] };
  roleplay: { setting: string; lines: Line[] };
  templates: Template[];
  objections: Objection[];
}

export const SCENARIO = {
  signal: 'A national jewellery chain announces 50 new stores across tier-2 cities this year.',
  service: 'Store systems & POS testing, with Omnichannel QA as the follow-on',
  prospect: 'Priya, Head of Retail Technology',
  you: 'You, from AlgoShack',
};

export const PRINCIPLES = [
  'Lead with their news, not your company. The signal is your reason to reach out; say it in the first line.',
  'Make one specific, believable point about what the event means for their systems. Use the "Why" and "To improve" lines on the signal.',
  'Ask for something small: a 15-minute conversation or a yes/no answer, not a demo or a meeting with the team.',
  'Offer something useful even if they say no: a checklist, a benchmark, a short point of view.',
  'Use one channel at a time and give each a few days. Connect on LinkedIn, then email, then call.',
  'Log every touch in the Radar: add the contact, set the next action, move the card when they reply.',
];

export const SEQUENCE = [
  { day: 'Day 1', step: 'LinkedIn connection request with a note about their news' },
  { day: 'Day 3', step: 'Email 1: the signal, one insight, a small ask' },
  { day: 'Day 6', step: 'Cold call (or call after they accept on LinkedIn)' },
  { day: 'Day 8', step: 'Email 2: share something useful (checklist or point of view)' },
  { day: 'Day 14', step: 'Final short email: ask if someone else owns this; close the loop' },
];

export const CHANNELS: Channel[] = [
  {
    id: 'linkedin',
    name: 'LinkedIn',
    when: 'Best first touch: low pressure, and they can see who you are before replying.',
    hints: {
      do: [
        'Read their profile and recent posts first; mention one specific thing.',
        'Keep the connection note under 300 characters: their news, one line of relevance, no pitch.',
        'After they accept, wait a day, then send a short message with one question.',
        'Like or comment thoughtfully on their posts about the expansion or technology.',
      ],
      avoid: [
        'Pitching in the connection request ("We are a leading QA company…").',
        'Sending a calendar link before they have replied.',
        'Long messages: if it needs scrolling on a phone, it is too long.',
      ],
    },
    roleplay: {
      setting: 'Priya accepted your connection request yesterday. You send a follow-up message.',
      lines: [
        { who: 'note', text: 'Connection note (sent 2 days ago): "Hi Priya, congratulations on the 50-store announcement. I work with retail tech teams on store and POS rollouts; would be glad to connect."' },
        { who: 'you', text: 'Thanks for connecting, Priya. Quick question: with 50 stores opening this year, is the POS and inventory set-up the same for every store, or are the tier-2 formats different?' },
        { who: 'prospect', text: 'Mostly the same POS, but the smaller stores have a lighter set-up and some franchise stores run their own billing.' },
        { who: 'you', text: 'That mix is usually where rollouts get painful: one POS update behaving differently across store types. How do you test a release today before it reaches all stores?' },
        { who: 'prospect', text: 'Honestly, a pilot store and then we push it. We find issues when stores call in.' },
        { who: 'you', text: 'That is very common. We help retail teams automate the store-release checks so each update is tested on every store configuration before rollout. Would a 15-minute call next week be useful to compare notes? No slides, just how others handle it.' },
        { who: 'prospect', text: 'Maybe. Send me something to read first.' },
        { who: 'you', text: 'Will do: I will email you a one-page checklist we use for multi-format POS rollouts. What is the best email for you?' },
        { who: 'note', text: 'Outcome: permission to email, and a real pain point (issues found by stores). Add Priya as point of contact, log the pain point in notes, move the card to "To validate".' },
      ],
    },
    templates: [
      {
        title: 'Connection request (under 300 characters)',
        body: 'Hi [First name], congratulations on [the signal, e.g. the 50-store expansion]. I work with retail technology teams on [service area, e.g. store and POS rollouts]. Would be glad to connect.',
      },
      {
        title: 'First message after they accept',
        body: 'Thanks for connecting, [First name]. Quick question on [the signal]: [one specific question about their systems, e.g. is the POS set-up the same for every store format?]',
      },
      {
        title: 'Follow-up if no reply after a week',
        body: 'Hi [First name], no worries if now is busy with [the signal]. I put together a short checklist on [topic, e.g. testing POS releases across store formats]; happy to share it if useful.',
      },
    ],
    objections: [
      { says: '"I don\'t respond to sales messages here."', reply: 'Understood, and thanks for saying so. If it is useful later, the checklist is yours to keep. I will leave it there.' },
      { says: '"Talk to our vendor/IT partner, they handle testing."', reply: 'Makes sense. Who is the best person there to speak to? We often work alongside the main IT partner on the store-release checks.' },
    ],
  },
  {
    id: 'email',
    name: 'Email',
    when: 'Best for a clear, forwardable message once you know who owns the area.',
    hints: {
      do: [
        'Subject line about them, 3 to 6 words: "Your 50-store rollout", not "AlgoShack QA services".',
        'Four short parts: their news, what it usually means, one sentence on how you help, a small ask.',
        'Keep it under 120 words, written in plain text, readable on a phone.',
        'Follow up twice at most, each time adding something new (a checklist, an example).',
      ],
      avoid: [
        'Attachments in the first email; they often land in spam.',
        'Lists of every service you offer. Pick the one that matches the signal.',
        '"Just checking in" follow-ups with nothing new in them.',
      ],
    },
    roleplay: {
      setting: 'Priya asked you on LinkedIn to send something to read. You email her, then she replies.',
      lines: [
        { who: 'you', text: 'Subject: Your 50-store rollout\n\nHi Priya,\n\nThanks for the chat on LinkedIn. As promised, here is the checklist: [link]\n\nWhen retailers open 50 stores in a year with mixed formats, the problem we see most is a POS update that works in the pilot store but breaks billing or stock sync in another format.\n\nWe automate the release checks across every store configuration, so each update is tested before rollout. [Add one real client result here, only if you can stand behind it.]\n\nWorth a 15-minute call next Tuesday or Wednesday?\n\n[Your name]' },
        { who: 'prospect', text: 'Thanks. The checklist is useful. We are mid-way through choosing a new POS, so timing is tricky. Maybe in a few months.' },
        { who: 'you', text: 'That is actually the best time to plan testing: before the new POS goes live in 50 stores. Could we do 15 minutes to understand your go-live plan? If it is too early, I will follow up when you have picked the POS.' },
        { who: 'prospect', text: 'OK, Thursday 4 pm works.' },
        { who: 'note', text: 'Outcome: meeting booked, and a strong new signal (POS replacement). Update the opportunity: trigger "POS replacement before 50-store rollout", next action "Discovery call Thursday 4 pm", priority High, stage "Engaged".' },
      ],
    },
    templates: [
      {
        title: 'First email',
        body: 'Subject: [Their news in 3-6 words]\n\nHi [First name],\n\nI saw [the signal, with source].\n\nWhen [companies like theirs] [do this], [the problem it usually creates, from "Why this score"].\n\nWe help [type of team] with [service line, one sentence]. [One short proof point, only if true.]\n\nWorth a 15-minute call [two specific days]?\n\n[Your name]',
      },
      {
        title: 'Follow-up 1 (add value)',
        body: 'Subject: Re: [same subject]\n\nHi [First name], one more thought on [the signal]: [a specific, useful idea or checklist link]. Happy to walk through it in 15 minutes if helpful.',
      },
      {
        title: 'Final follow-up (close the loop)',
        body: 'Subject: Re: [same subject]\n\nHi [First name], I will not keep filling your inbox. Is [topic] something you own, or is there a better person I should speak to?\n\nThanks either way.',
      },
    ],
    objections: [
      { says: '"Send me more information."', reply: 'Happy to. So I send the right thing: is the bigger concern the store rollout itself, or what happens after go-live with frequent updates?' },
      { says: '"We have no budget this year."', reply: 'Understood. Many teams start with a small paid pilot on one release, or plan it into next year\'s rollout budget. Would it help to see what a pilot looks like for when budgets open?' },
      { says: '"We do testing in-house."', reply: 'Most retailers we work with do too. We usually add automation so the in-house team is not re-testing the same billing and stock flows on every release. How long does a full regression take your team today?' },
    ],
  },
  {
    id: 'call',
    name: 'Cold call',
    when: 'Fastest way to learn if there is a real need, and to find the right person.',
    hints: {
      do: [
        'Know the signal and one question before dialling; have the Radar card open.',
        'Open with your name, a reason for the call based on their news, and permission: "Have you got 30 seconds?"',
        'Ask questions and listen more than you talk. Aim for them to talk 60% of the time.',
        'Close on a specific next step: a 15-minute call with a date, or the name of the right person.',
        'Best times: 9:30-11:00 am and 4:00-5:30 pm on Tuesdays to Thursdays.',
      ],
      avoid: [
        '"How are you today?" openers and long company introductions.',
        'Arguing with an objection. Acknowledge it, then ask a question.',
        'Ending the call without a clear next step.',
      ],
    },
    roleplay: {
      setting: 'You call Priya directly after two emails without a reply.',
      lines: [
        { who: 'you', text: 'Hi Priya, this is [Your name] from AlgoShack. I am calling about your 50-store expansion. I emailed last week. Have you got 30 seconds for me to explain why, and then you can tell me if it is relevant?' },
        { who: 'prospect', text: 'I am between meetings, go on.' },
        { who: 'you', text: 'When retailers open stores in mixed formats, POS updates often work in the pilot store and then break billing or stock sync somewhere else. We automate those checks across every store set-up. Is that something you see?' },
        { who: 'prospect', text: 'Sometimes. But our IT partner handles testing.' },
        { who: 'you', text: 'That makes sense; most retailers do. Out of interest, when a store reports a billing issue after a release, how long does it usually take to find and fix?' },
        { who: 'prospect', text: 'A couple of days, sometimes more. The franchise stores are the worst.' },
        { who: 'you', text: 'That is exactly the gap we close, and we work alongside the IT partner, not instead of them. Could we take 15 minutes on Thursday to look at how your releases reach the franchise stores? If it is not useful, I will say so.' },
        { who: 'prospect', text: 'Thursday is busy. Friday morning.' },
        { who: 'you', text: 'Friday 10:30 then. I will send an invite, and could you tell me who at your IT partner owns testing, so I can understand how they work?' },
        { who: 'note', text: 'Outcome: meeting booked, pain confirmed (days to fix franchise billing issues), and a second contact to add (IT partner test lead). Log it in the Radar the same day.' },
      ],
    },
    templates: [
      {
        title: 'Opening (15 seconds)',
        body: 'Hi [First name], this is [Your name] from AlgoShack. I am calling about [the signal]. Have you got 30 seconds for me to explain why, and then you can tell me if it is relevant?',
      },
      {
        title: 'Reason and question',
        body: 'When [companies like theirs] [do this], we often see [problem]. We help with [service line, one sentence]. Is that something you see?',
      },
      {
        title: 'Voicemail (under 20 seconds)',
        body: 'Hi [First name], [Your name] from AlgoShack, about [the signal]. I have one idea on [problem] that might be useful. I will send a short email today; my number is [number]. Thanks.',
      },
      {
        title: 'Gatekeeper',
        body: 'Hi, I am trying to reach whoever looks after [store systems / e-commerce testing] for the [signal] programme. Could you tell me who that is, or put me through?',
      },
    ],
    objections: [
      { says: '"Not interested."', reply: 'Fair enough. Before I go: is it that testing for the rollout is already covered, or just not a priority right now? (Then respect the answer.)' },
      { says: '"Call me next quarter."', reply: 'Will do. So the next call is useful: what will have changed by then, the POS decision or the rollout start?' },
      { says: '"Who gave you my number?"', reply: 'It is on [public source]. I called because of your 50-store announcement. If you prefer email, I am happy to switch.' },
    ],
  },
];
