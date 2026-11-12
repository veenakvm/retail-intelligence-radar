// One-off diagnostic: sends the same request shape as the outreach Edge Function and prints the API error.
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';

const src = readFileSync('supabase/functions/outreach/index.ts', 'utf8');
const schemaText = src.slice(src.indexOf('const OUTPUT_SCHEMA = ') + 'const OUTPUT_SCHEMA = '.length, src.indexOf('};\n\nDeno.serve') + 1);
const OUTPUT_SCHEMA = new Function(`return (${schemaText});`)();
const client = new Anthropic();
const variants: [string, Record<string, unknown>][] = [
  ['as deployed', { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', output_config: { effort: 'medium', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } } }],
  ['no fallbacks', { output_config: { effort: 'medium', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } } }],
];
for (const [name, extra] of variants) {
  try {
    const r = await client.beta.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-opus-5-5', max_tokens: 2000, system: 'Write short outreach.',
      messages: [{ role: 'user', content: 'Draft outreach for: Forevermark India expands stores.' }],
      ...extra,
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);
    console.log(`${name}: OK (${r.stop_reason})`);
  } catch (e) {
    console.log(`${name}: FAILED ${e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : (e as Error).message}`);
  }
}
