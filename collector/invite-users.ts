// Invites team members to the Radar. Each person gets an email with a link to set their password.
// INVITES = "Full Name <email>, Other Name <email>" (from the "Invite team members" workflow).
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const site = process.env.SITE_URL!;
const role = process.env.ROLE === 'admin' ? 'admin' : 'member';

const people = (process.env.INVITES ?? '').split(',').map(s => s.trim()).filter(Boolean).map(s => {
  const m = s.match(/^(.*?)\s*<\s*([^<>\s]+@[^<>\s]+\.[^<>\s]+)\s*>$/) ?? s.match(/^()([^<>\s]+@[^<>\s]+\.[^<>\s]+)$/);
  if (!m) throw new Error(`Not understood: "${s}". Use: Full Name <name@company.com>`);
  return { name: m[1].trim(), email: m[2].toLowerCase() };
});
if (!people.length) throw new Error('No one to invite.');

let failed = 0;
for (const p of people) {
  const { data, error } = await db.auth.admin.inviteUserByEmail(p.email, { data: { full_name: p.name }, redirectTo: site });
  if (error) { failed++; console.log(`✗ ${p.email}: ${error.message}`); continue; }
  // The sign-up trigger adds them to the team; make sure the name and role are set.
  await db.from('team_members').upsert({ user_id: data.user.id, email: p.email, full_name: p.name, role }, { onConflict: 'user_id' });
  console.log(`✓ Invited ${p.name || p.email} <${p.email}> as ${role}`);
}
if (failed) process.exit(1);
