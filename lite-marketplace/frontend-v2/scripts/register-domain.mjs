#!/usr/bin/env node
/**
 * register-domain.mjs — registers a free domain for the signed-in user.
 *
 * Availability pre-checks (ICANN RDAP bootstrap + DNS) then writes the domain
 * document into Firestore `domains/{auto}` via the Firestore REST API using the
 * user's Firebase Auth ID token (no console clicking, no page interaction).
 *
 * Usage (PowerShell):
 *   $env:FIREBASE_ID_TOKEN="<token from the logged-in app>"
 *   node scripts/register-domain.mjs maskedes us.kg
 *   node scripts/register-domain.mjs maskedes uk.kg --skip-check
 */
import { readFileSync } from 'node:fs';
import { Resolver } from 'node:dns/promises';

/* ── args & config ─────────────────────────────────────────────── */
const args = process.argv.slice(2);
const skipCheck = args.includes('--skip-check');
const positional = args.filter(a => !a.startsWith('--'));
const [name, extension = 'us.kg'] = positional;

const token = process.env.FIREBASE_ID_TOKEN;
const uid = process.env.FIREBASE_UID;

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter(l => l.includes('='))
    .map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const PROJECT = env.VITE_FIREBASE_PROJECT_ID;
const API_KEY = env.VITE_FIREBASE_API_KEY;
const DB = 'default';
const FQDN = `${name}.${extension}`;

if (!token || !uid) {
  console.error('Missing FIREBASE_ID_TOKEN / FIREBASE_UID env vars.');
  console.error('Set them from the logged-in dashboard session, then re-run.');
  process.exit(1);
}

/* ── availability pre-check ────────────────────────────────────── */
const resolver = new Resolver({ timeout: 4000, tries: 2 });
let availability = 'UNCHECKED';
let how = '';
if (!skipCheck) {
  try {
    const boot = await (await fetch('https://data.iana.org/rdap/dns.json', { signal: AbortSignal.timeout(10000) })).json();
    const base = (boot.services ?? []).find(s => s[0].includes(extension))?.[1]?.[0];
    let rdap = 'none';
    if (base) {
      const res = await fetch(`${base.replace(/\/?$/, '/')}domain/${FQDN}`, {
        headers: { accept: 'application/rdap+json', 'user-agent': 'esocials-dns-check/1.0' },
        signal: AbortSignal.timeout(8000),
      });
      rdap = res.status === 404 ? 'AVAILABLE' : `rdap ${res.status}`;
    }
    // free 3-level zones (.us.kg etc.) are judged by DNS delegation
    let dns = '';
    try {
      const ns = await resolver.resolveNs(FQDN);
      dns = ns.length ? 'delegated' : 'no error, 0 ns';
    } catch (e) {
      const code = e.code ?? e.cause?.code;
      dns = code === 'ENOTFOUND' ? 'nxdomain' : (code === 'ENODATA' ? 'noerror, nodata' : `dns ${code}`);
    }
    availability = rdap !== 'none' ? rdap : (dns === 'nxdomain' ? 'AVAILABLE' : `dns: ${dns}`);
    how = `rdap=${rdap} dns=${dns}`;
    if (availability !== 'AVAILABLE') {
      // allow parked (noerror+nodata) as re-registrable free zones
      if (/noerror, nodata/.test(dns)) { availability = 'AVAILABLE (parked)'; }
      else {
        console.error(`❌ ${FQDN} is not available (${how}).`);
        process.exit(1);
      }
    }
  } catch (e) {
    console.log(`⚠️  Pre-check failed (${e.message}); continuing…`);
  }
}

/* ── register via Firestore REST ───────────────────────────────── */
const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DB}/documents/domains?key=${API_KEY}`;
const payload = {
  fields: {
    name: { stringValue: FQDN },
    userId: { stringValue: uid },
    status: { stringValue: 'permanent / free' },
    createdAt: { timestampValue: new Date().toISOString() },
  },
};
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(payload),
});
const body = await res.json().catch(() => ({}));

if (res.status === 200) {
  console.log(`✅ Registered ${FQDN}`);
  console.log(`   doc:      ${body.name}`);
  console.log(`   owner:    ${uid}`);
  console.log(`   status:   permanent / free`);
  console.log(`   precheck: ${availability} (${how})`);
} else {
  console.error(`❌ Registration failed with HTTP ${res.status}:`);
  console.error(JSON.stringify(body, null, 2).slice(0, 600));
  process.exit(1);
}
