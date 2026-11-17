// Supabase Edge Function: finds people at a target account in Apollo and saves the ones the user picks.
//   action "search": free people search (no emails or phones) for a company, filtered by ICP titles.
//   action "reveal": reveals work email (1 Apollo credit each) and optionally mobile phone (about 9 credits,
//                    delivered later to action "phone_webhook"), then saves them as contacts.
//   action "phone_webhook": called by Apollo with phone numbers; updates the contact.
// icp.ts is copied next to this file from src/lib by the deploy workflow.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ICP_TITLES, ICP_SENIORITIES } from './icp.ts';

const APOLLO = 'https://api.apollo.io/api/v1';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const apiKey = () => Deno.env.get('APOLLO_API_KEY') ?? '';

async function apollo(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${APOLLO}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': apiKey() },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    const msg = String(data.error ?? data.message ?? text).slice(0, 300);
    if (res.status === 401) throw new Error('Apollo rejected the API key (APOLLO_API_KEY).');
    if (res.status === 403) throw new Error(`Apollo says this API key or plan cannot use ${path}: ${msg}`);
    if (res.status === 422 && /credit/i.test(msg)) throw new Error('The Apollo account is out of credits.');
    if (res.status === 429) throw new Error('Apollo rate limit reached. Try again in a minute.');
    throw new Error(`Apollo error ${res.status}: ${msg}`);
  }
  return data;
}

// Signed token so only Apollo's callback for a given contact can update it.
async function sign(value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(apiKey()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const cleanDomain = (d: string) => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = new URL(req.url);

  // ---- Apollo phone callback (no user session; verified by signed token) ----
  if (url.searchParams.get('action') === 'phone_webhook') {
    const contactId = url.searchParams.get('contact_id') ?? '';
    if (!contactId || url.searchParams.get('token') !== await sign(contactId)) return json({ error: 'Bad token' }, 403);
    const serviceKey = Deno.env.get('RADAR_SERVICE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceKey) return json({ error: 'Service key unavailable' }, 500);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false } });
    const payload = await req.json().catch(() => ({}));
    // Collect every phone number in the payload, preferring mobile numbers.
    const numbers: { number: string; type: string }[] = [];
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        const n = o.sanitized_number ?? o.raw_number ?? o.number;
        if (typeof n === 'string' && /\d{6,}/.test(n)) numbers.push({ number: n, type: String(o.type_cd ?? o.type ?? '') });
        Object.values(o).forEach(walk);
      }
    };
    walk(payload);
    const best = numbers.find(n => /mobile/i.test(n.type)) ?? numbers[0];
    await admin.from('contacts').update(best ? { phone: best.number, phone_status: 'found' } : { phone_status: 'not_found' }).eq('id', contactId);
    return json({ ok: true });
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!apiKey()) return json({ error: 'Apollo is not connected yet: add APOLLO_API_KEY (see the README).' }, 500);

  // ---- Signed-in team member actions ----
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || req.headers.get('apikey') || '';
  const db = createClient(Deno.env.get('SUPABASE_URL')!, publicKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: userData } = await db.auth.getUser();
  if (!userData.user) return json({ error: 'Sign in first.' }, 401);
  const { data: member } = await db.from('team_members').select('user_id').eq('user_id', userData.user.id).maybeSingle();
  if (!member) return json({ error: 'Team access required.' }, 403);

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  try {
    if (body.action === 'search') {
      const company = String(body.company ?? '').trim();
      let domain = cleanDomain(String(body.domain ?? ''));
      let orgName = company;
      let orgId = '';
      // Find the company in Apollo when no domain is given.
      if (!domain) {
        const orgs = await apollo('/mixed_companies/search', { q_organization_name: company, page: 1, per_page: 5 });
        const list = ((orgs.organizations ?? orgs.accounts ?? []) as Record<string, unknown>[]);
        const pick = list[0];
        if (!pick) return json({ people: [], company: null, message: `Apollo has no company called "${company}". Add its website domain and search again.` });
        domain = cleanDomain(String(pick.primary_domain ?? pick.website_url ?? ''));
        orgName = String(pick.name ?? company);
        orgId = String(pick.id ?? '');
      }
      const titles = Array.isArray(body.titles) && body.titles.length ? (body.titles as string[]).slice(0, 25) : ICP_TITLES;
      const search: Record<string, unknown> = { person_titles: titles, person_seniorities: ICP_SENIORITIES, page: 1, per_page: 25 };
      if (domain) search.q_organization_domains_list = [domain];
      else if (orgId) search.organization_ids = [orgId];
      let res = await apollo('/mixed_people/api_search', search);
      let people = (res.people ?? []) as Record<string, unknown>[];
      // Titles are matched loosely; if seniority filtering found nobody, retry on titles alone.
      if (!people.length) {
        delete search.person_seniorities;
        res = await apollo('/mixed_people/api_search', search);
        people = (res.people ?? []) as Record<string, unknown>[];
      }
      return json({
        company: { name: orgName, domain },
        people: people.map(p => ({
          id: p.id,
          first_name: p.first_name ?? '',
          last_name: p.last_name ?? p.last_name_obfuscated ?? '',
          title: p.title ?? '',
          has_email: p.has_email ?? null,
          has_phone: p.has_direct_phone ?? null,
          city: p.city ?? (p.present_raw_address ?? ''),
          linkedin_url: p.linkedin_url ?? '',
        })),
      });
    }

    if (body.action === 'reveal') {
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(String).slice(0, 10);
      if (!ids.length) return json({ error: 'Pick at least one person.' }, 400);
      const company = String(body.company ?? '').trim();
      const opportunityId = body.opportunity_id ? String(body.opportunity_id) : null;
      const wantPhone = body.reveal_phone === true;
      const saved: Record<string, unknown>[] = [];
      const problems: string[] = [];

      for (const id of ids) {
        // Already saved? Do not spend credits twice.
        const { data: existing } = await db.from('contacts').select('id, full_name').eq('apollo_id', id).maybeSingle();
        if (existing) { problems.push(`${existing.full_name} is already in Contacts`); continue; }

        const match = await apollo('/people/match', { id, reveal_personal_emails: false });
        const p = (match.person ?? {}) as Record<string, unknown>;
        const org = (p.organization ?? {}) as Record<string, unknown>;
        const name = String(p.name ?? `${p.first_name ?? ''} ${p.last_name ?? ''}`).trim();
        const email = typeof p.email === 'string' && !/email_not_unlocked|domain\.com$/i.test(p.email) ? p.email : '';
        const { data: contact, error } = await db.from('contacts').insert({
          company: company || String(org.name ?? ''),
          opportunity_id: opportunityId,
          full_name: name || 'Unknown',
          role: String(p.title ?? ''),
          email,
          linkedin_url: String(p.linkedin_url ?? ''),
          source: `Apollo, ${new Date().toISOString().slice(0, 10)}${p.email_status ? ` (email ${p.email_status})` : ''}`,
          apollo_id: id,
          phone_status: wantPhone ? 'requested' : '',
        }).select().single();
        if (error) { problems.push(`${name}: ${error.message}`); continue; }
        saved.push(contact);

        if (wantPhone) {
          const hook = `${Deno.env.get('SUPABASE_URL')}/functions/v1/apollo?action=phone_webhook&contact_id=${contact.id}&token=${await sign(contact.id)}`;
          try { await apollo('/people/match', { id, reveal_phone_number: true, webhook_url: hook }); }
          catch (e) {
            problems.push(`${name}: phone not requested (${(e as Error).message})`);
            await db.from('contacts').update({ phone_status: '' }).eq('id', contact.id);
          }
        }
      }

      // First saved contact becomes the opportunity's point of contact if it has none.
      if (opportunityId && saved.length) {
        const { data: opp } = await db.from('opportunities').select('primary_contact_id').eq('id', opportunityId).maybeSingle();
        if (opp && !opp.primary_contact_id) await db.from('opportunities').update({ primary_contact_id: saved[0].id }).eq('id', opportunityId);
      }
      return json({ saved, problems });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});
