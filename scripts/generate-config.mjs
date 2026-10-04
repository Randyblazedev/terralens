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
const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_PUBLISHABLE_KEY || '';
const output = resolve('src/js/runtime-config.js');
mkdirSync(resolve('src/js'), { recursive: true });
writeFileSync(output, `// Generated at build time. Do not commit secrets.\nexport const SUPABASE_URL = ${JSON.stringify(url)};\nexport const SUPABASE_KEY = ${JSON.stringify(key)};\n`);
console.log(`Generated ${output} (${url ? 'Supabase URL configured' : 'Supabase URL missing'})`);
