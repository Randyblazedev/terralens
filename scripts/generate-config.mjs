import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function loadLocalEnv() {
  const files = ['.env.local', '.env'];
  for (const file of files) {
    try {
      const text = readFileSync(resolve(file), 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const i = trimmed.indexOf('=');
        if (i < 1) continue;
        const key = trimmed.slice(0, i).trim();
        let value = trimmed.slice(i + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        if (!process.env[key]) process.env[key] = value;
      }
      break;
    } catch {}
  }
}

loadLocalEnv();
const tidy = v => String(v || '').trim().replace(/^["'`]+|["'`]+$/g, '').trim();
const url = tidy(process.env.SUPABASE_URL).replace(/\/+$/, '');
const key = tidy(process.env.SUPABASE_PUBLISHABLE_KEY);
const requireLogin = (process.env.REQUIRE_LOGIN || 'true').toLowerCase() !== 'false';
// Affiliate tracking. These are public identifiers, not secrets: they end up in the links on
// the page. Leaving them empty simply hides the booking button everywhere.
const affiliateAid = tidy(process.env.AFFILIATE_BOOKING_AID);
const affiliateLabel = tidy(process.env.AFFILIATE_BOOKING_LABEL) || 'Find a place to stay';
const output = resolve('src/js/runtime-config.js');
mkdirSync(resolve('src/js'), { recursive: true });
writeFileSync(output, `// Generated at build time. Do not commit secrets.\nexport const SUPABASE_URL = ${JSON.stringify(url)};\nexport const SUPABASE_KEY = ${JSON.stringify(key)};\nexport const REQUIRE_LOGIN = ${requireLogin};\nexport const AFFILIATE_BOOKING_AID = ${JSON.stringify(affiliateAid)};\nexport const AFFILIATE_BOOKING_LABEL = ${JSON.stringify(affiliateLabel)};\n`);
console.log(`Generated ${output} (${url ? 'Supabase URL configured' : 'Supabase URL missing'}, login ${requireLogin ? 'required' : 'optional'}, booking affiliate ${affiliateAid ? 'on' : 'off'})`);
