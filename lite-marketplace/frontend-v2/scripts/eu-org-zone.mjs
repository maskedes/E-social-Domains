#!/usr/bin/env node
/**
 * eu-org-zone.mjs — manages the E-Social platform zone: esocialzdomains.eu.org
 *
 * Once the eu.org request is approved and the zone is hosted on Cloudflare,
 * this script provisions user subdomains (DigitalPlat-style) directly via the
 * Cloudflare API:
 *
 *   node scripts/eu-org-zone.mjs status              → token/zone/delegation health check
 *   node scripts/eu-org-zone.mjs add <name> a 1.2.3.4     → create A record name.esocialzdomains.eu.org
 *   node scripts/eu-org-zone.mjs add <name> cname target.com  → create CNAME record
 *   node scripts/eu-org-zone.mjs list                → dump all DNS records
 *   node scripts/eu-org-zone.mjs del <record-id>     → delete one record
 *
 * Env (inline or in .env.cloudflare next to this script):
 *   CF_API_TOKEN=...  (Zone.DNS Edit permission on zone esocialzdomains.eu.org)
 *
 * Logging in check order:
 *  1. Delegation: are our NS records live under .eu.org?  (dig/nsquery resolveNs)
 *  2. Cloudflare token works and can see the zone
 */
import { readFileSync } from 'node:fs';
import { Resolver } from 'node:dns/promises';

const ZONE = 'esocialzdomains.eu.org';
const NS_SERVER = 'ns1.afraid.org'; // placeholder NS probe target — real check: any resolver

/* ── env ────────────────────────────────────────────────────────── */
let env = {};
try {
  env = Object.fromEntries(
    readFileSync(new URL('./.env.cloudflare', import.meta.url), 'utf8')
      .split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
} catch { /* no file yet */ }
const TOKEN = process.env.CF_API_TOKEN ?? env.CF_API_TOKEN;
const ZONE_ID = process.env.CF_ZONE_ID ?? env.CF_ZONE_ID; // optional; auto-discovered if absent

const cf = async (path, init = {}) => {
  let res;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${TOKEN}`,
          'content-type': 'application/json',
          ...(init.headers ?? {}),
        },
      });
      break;
    } catch (e) {
      if (attempt === 3) throw new Error(`Cloudflare API unreachable after 3 tries: ${e.cause?.code ?? e.message}`);
      await new Promise((ok) => setTimeout(ok, 800));
    }
  }
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && body.success !== false, status: res.status, body };
};

/* ── helpers ────────────────────────────────────────────────────── */
const resolver = new Resolver({ timeout: 4000, tries: 2 });

async function delegationStatus() {
  try {
    const ns = await resolver.resolveNs(ZONE);
    return ns.length ? `DELEGATED (NS: ${ns.slice(0, 2).join(', ')})` : 'PENDING (noerror, no NS)';
  } catch (e) {
    return e.code === 'ENOTFOUND' ? 'NOT REQUESTED YET (nxdomain)' : `unknown (${e.code})`;
  }
}

async function zoneId() {
  if (ZONE_ID) return ZONE_ID;
  const r = await cf(`/zones?name=${ZONE}`);
  return r.ok ? r.body.result?.[0]?.id : null;
}

/* ── commands ───────────────────────────────────────────────────── */
const [cmd, name, type, value] = process.argv.slice(2);

if (cmd === 'status') {
  console.log(`Zone: ${ZONE}`);
  console.log(`Delegation: ${await delegationStatus()}`);
  if (!TOKEN) {
    console.log('Cloudflare: NO TOKEN (set CF_API_TOKEN in .env.cloudflare)');
    console.log('\nNext steps:');
    console.log(' 1. dash.cloudflare.com → Add site → ' + ZONE + ' (Free plan)');
    console.log(' 2. Note the two ns*.cloudflare.com nameservers');
    console.log(' 3. Submit the request at nic.eu.org with those nameservers');
    console.log(' 4. After approval + zone active, create a Zone.DNS-Edit token and put it in .env.cloudflare');
    process.exit(0);
  }
  const v = await cf('/user/tokens/verify');
  console.log(`Token: ${v.ok ? 'VALID' : `INVALID (${v.status})`}`);
  const z = await cf(`/zones?name=${ZONE}`);
  const zone = z.body.result?.[0];
  console.log(`Zone on Cloudflare: ${zone ? `${zone.status} (id ${zone.id.slice(0, 8)}…)` : 'NOT FOUND'}`);
  process.exit(0);
}

if (!TOKEN) { console.error('Set CF_API_TOKEN first (scripts/.env.cloudflare or env).'); process.exit(1); }

if (cmd === 'list') {
  const id = await zoneId();
  const r = await cf(`/zones/${id}/dns_records?per_page=100`);
  for (const rec of r.body.result ?? []) console.log(`${rec.id.padEnd(34)} ${rec.type.padEnd(6)} ${rec.name.padEnd(34)} → ${rec.content}`);
  process.exit(0);
}

if (cmd === 'add') {
  if (!name || !type || !value) { console.error('usage: add <name> <A|CNAME|TXT|AAAA> <value>'); process.exit(1); }
  const fqdn = name.includes('.') ? name : `${name}.${ZONE}`;
  const id = await zoneId();
  const r = await cf(`/zones/${id}/dns_records`, {
    method: 'POST',
    body: JSON.stringify({ type: type.toUpperCase(), name: fqdn, content: value, ttl: 1, proxied: false }),
  });
  if (r.ok) console.log(`✅ ${type.toUpperCase()} ${fqdn} → ${value} (id ${r.body.result.id})`);
  else { console.error(`❌ HTTP ${r.status}`); console.error(JSON.stringify(r.body.errors ?? r.body, null, 2).slice(0, 500)); process.exit(1); }
  process.exit(0);
}

if (cmd === 'del') {
  const id = await zoneId();
  const r = await cf(`/zones/${id}/dns_records/${name}`, { method: 'DELETE' });
  console.log(r.ok ? `🗑  deleted ${name}` : `❌ HTTP ${r.status}`);
  process.exit(0);
}

console.log('usage: node scripts/eu-org-zone.mjs <status|list|add|del>');
process.exit(1);
