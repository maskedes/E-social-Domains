#!/usr/bin/env node
/**
 * dns-check.mjs — Domain availability & DNS checker across ICANN RDAP + free-domain zones.
 * Usage:
 *   node scripts/dns-check.mjs myname another-name
 *   node scripts/dns-check.mjs --file words.txt
 *   node scripts/dns-check.mjs myname --tlds us.kg,pp.ua,dev
 *
 * Two check strategies:
 *  • RDAP (ICANN bootstrap via rdap.org) — authoritative registration status for
 *    ICANN-accredited TLDs (com/net/org/dev/app/io/me/…). 404 ⇒ available, 200 ⇒ registered.
 *  • DNS zone probe — for shared free-hosting zones (us.kg, pp.ua, dpdns.org, js.org, …)
 *    where RDAP doesn't cover 3rd-level names. NXDOMAIN ⇒ not delegated (available),
 *    NOERROR w/o NS ⇒ registered but parked, NS present ⇒ delegated/in use.
 * Needs Node 18+ (global fetch). No dependencies.
 */
import { Resolver } from 'node:dns/promises';
import { readFileSync } from 'node:fs';

/* ── CLI ───────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
let words = [];
let tldOverride = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--file') words.push(...readFileSync(argv[++i], 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean));
  else if (a === '--tlds') tldOverride = argv[++i].split(',').map(s => s.trim()).filter(Boolean);
  else if (!a.startsWith('--')) words.push(a.replace(/[^a-z0-9-]/gi, '').toLowerCase());
}
words = [...new Set(words)];
if (!words.length) {
  console.log('Usage: node scripts/dns-check.mjs <name...> [--file words.txt] [--tlds tld1,tld2]');
  process.exit(1);
}

/* ── Zone registry ─────────────────────────────────────────────── */
// Shared free-subdomain zones → availability is judged by DNS (NXDOMAIN).
const FREE_ZONES = [
  // DigitalPlat FreeDomain (dash.domain.digitalplat.org) — instant, Google-auth dashboard
  'us.kg', 'dpdns.org', 'qzz.io', 'xx.kg',
  // nic.ua — free .pp.ua
  'pp.ua',
  // community / GitHub-PR zones
  'eu.org', 'js.org', 'is-a.dev',
  // dynamic-DNS / freedns public zones
  'dynv6.net', 'duckdns.org',
  'mooo.com', 'chickenkiller.com', 'crabdance.com', 'strangled.net',
  'thinline.cc', 'qpoo.com', 'ftpserver.biz', 'myftp.biz', 'myftp.org', 'ooguy.com',
  'zapto.org', 'sytes.net', 'ddns.net', 'hopto.org',
  'cloudns.ph',
];
// ICANN-accredited TLDs → availability judged by RDAP.
const ICANN_TLDS = tldOverride ?? ['com', 'net', 'org', 'dev', 'app', 'io', 'me', 'xyz'];
const TLDS = ICANN_TLDS.map(t => t.replace(/^\./, ''));
const resolver = new Resolver({ timeout: 3000, tries: 2 });

const FREE_SET = new Set(FREE_ZONES);
const ICANN_SET = new Set(TLDS);

/* ── Checks ────────────────────────────────────────────────────── */
/** TLD → official RDAP base URL (IANA bootstrap, cached). Falls back to rdap.org. */
const rdapBase = new Map();
async function getRdapBase(tld) {
  if (!rdapBase.size) {
    try {
      const boot = await (await fetch('https://data.iana.org/rdap/dns.json', { signal: AbortSignal.timeout(10000) })).json();
      for (const s of boot.services ?? []) for (const t of s[0]) rdapBase.set(t, s[1][0]);
    } catch { /* offline → rdap.org fallback */ }
  }
  return rdapBase.get(tld) ?? null;
}

async function rdapStatus(domain, tld) {
  try {
    const base = await getRdapBase(tld);
    if (!base) {
      // No RDAP server for this TLD (many ccTLDs) — fall back to DNS delegation heuristics
      const d = await dnsStatus(domain);
      const status = d.status === 'AVAILABLE' ? 'AVAILABLE' : d.status === 'DNS_ERR' ? 'CHECK_DNS' : 'TAKEN/IN-USE';
      return { status, how: `no rdap for .${tld}; dns ${d.how}` };
    }
    const url = `${base.replace(/\/?$/, '/')}domain/${domain}`;
    const res = await fetch(url, {
      headers: { accept: 'application/rdap+json', 'user-agent': 'esocials-dns-check/1.0 (domain availability probe)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return { status: 'AVAILABLE', how: 'rdap 404' };
    if (res.status === 200) {
      let extra = '';
      try {
        const j = await res.json();
        const reg = (j.events ?? []).find(e => e.eventAction === 'registration')?.eventDate;
        const registrar = (j.entities ?? []).find(e => e.roles?.includes('registrar'))?.handle;
        extra = [registrar ? `registrar ${registrar}` : null, reg ? `reg ${reg.slice(0, 10)}` : null].filter(Boolean).join(', ');
      } catch { /* body not rdap-json */ }
      return { status: 'REGISTERED', how: 'rdap 200' + (extra ? ` (${extra})` : '') };
    }
    return { status: 'RDAP_ERR', how: `rdap ${res.status}` };
  } catch (e) {
    return { status: 'RDAP_ERR', how: e.cause?.code ?? e.message };
  }
}

async function dnsStatus(fqdn) {
  try {
    const ns = await resolver.resolveNs(fqdn);
    return ns.length
      ? { status: 'DELEGATED', how: `ns: ${ns.slice(0, 2).join(', ')}` }
      : { status: 'REGISTERED_NO_NS', how: 'noerror, 0 ns' };
  } catch (e) {
    const code = e.code ?? e.cause?.code;
    if (code === 'ENOTFOUND') return { status: 'AVAILABLE', how: 'nxdomain' };
    if (code === 'ENODATA') return { status: 'REGISTERED_NO_NS', how: 'noerror, nodata' };
    return { status: 'DNS_ERR', how: code ?? 'unknown' };
  }
}

/* ── Run ───────────────────────────────────────────────────────── */
const rows = [];
console.log(`Checking ${words.length} name(s) × ${TLDS.length} ICANN TLDs + ${FREE_ZONES.length} free zones…\n`);

for (const word of words) {
  for (const tld of TLDS) {
    if (FREE_SET.has(tld)) {
      const fqdn = `${word}.${tld}`;
      const r = await dnsStatus(fqdn);
      rows.push({ fqdn, ...r });
      console.log(`${fqdn.padEnd(28)} ${r.status.padEnd(17)} ${r.how}`);
    } else if (ICANN_SET.has(tld)) {
      const fqdn = `${word}.${tld}`;
      const r = await rdapStatus(fqdn, tld);
      rows.push({ fqdn, ...r });
      console.log(`${fqdn.padEnd(28)} ${r.status.padEnd(17)} ${r.how}`);
    }
  }
  // always also probe free zones unless overridden exclusively with ICANN TLDs
  if (tldOverride) continue;
  for (const zone of FREE_ZONES) {
    const fqdn = `${word}.${zone}`;
    const r = await dnsStatus(fqdn);
    rows.push({ fqdn, ...r });
    console.log(`${fqdn.padEnd(28)} ${r.status.padEnd(17)} ${r.how}`);
  }
  console.log('');
}

const n = (s) => rows.filter(r => r.status === s).length;
console.log(`🏁 Summary: ${n('AVAILABLE')} available · ${n('REGISTERED')} registered · ${n('DELEGATED')} delegated · ${n('REGISTERED_NO_NS')} parked · ${n('RDAP_ERR') + n('DNS_ERR')} errors`);
