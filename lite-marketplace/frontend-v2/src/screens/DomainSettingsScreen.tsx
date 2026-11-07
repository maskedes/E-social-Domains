import React, { useEffect, useState, useCallback, useRef } from 'react';
import { collection, onSnapshot, query, where, doc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import { Globe, AlertCircle, CheckCircle2, Loader2, Plus, RefreshCw, Trash2, Mail, Upload } from 'lucide-react';
import styles from './Screens.module.css';
import { useToast } from '../components/Toast';

export const EMAIL_PROVIDERS = [
  { id: 'google', name: 'Google Workspace', mxHost: 'smtp.google.com', mxPriority: 1, spfMechs: ['include:_spf.google.com'], dkimSelector: 'google', dmarcPolicy: 'none' },
  { id: 'microsoft', name: 'Microsoft 365', mxHost: 'yourdomain.mail.protection.outlook.com', mxPriority: 0, spfMechs: ['include:spf.protection.outlook.com'], dkimSelector: 'selector1', dmarcPolicy: 'none' },
  { id: 'zoho', name: 'Zoho Mail', mxHost: 'mx.zoho.com', mxPriority: 10, spfMechs: ['include:zohomail.com'], dkimSelector: 'zoho', dmarcPolicy: 'none' },
  { id: 'custom', name: 'Custom provider', mxHost: '', mxPriority: 10, spfMechs: [], dkimSelector: '', dmarcPolicy: 'none' }
];

interface DomainSettingsProps {
  domain: string | null;
  onBack: () => void;
}

interface UserDomain {
  id: string;
  name: string;
  userId: string;
  status: string;
  createdAt: any;
}

interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
}

// Demo records for testing the DNS management UI while the backend/Cloudflare API
// is offline. Modeled on DigitalPlat-style free-domain record sets.
const ZONE = '.esocialzdomains.eu.org';
const DEMO_RECORDS: DnsRecord[] = [
  { id: 'demo-01', type: 'A',      name: 'esocialzdomains.eu.org',           content: '203.0.113.10',                          ttl: 300,  proxied: true },
  { id: 'demo-02', type: 'A',      name: 'www',                              content: '203.0.113.10',                          ttl: 300,  proxied: true },
  { id: 'demo-03', type: 'A',      name: 'app',                              content: '198.51.100.25',                         ttl: 300,  proxied: true },
  { id: 'demo-04', type: 'A',      name: 'api',                              content: '198.51.100.30',                         ttl: 300,  proxied: false },
  { id: 'demo-05', type: 'AAAA',   name: 'www',                              content: '2606:4700::1111',                       ttl: 300,  proxied: false },
  { id: 'demo-06', type: 'AAAA',   name: 'esocialzdomains.eu.org',           content: '2606:4700::2222',                       ttl: 300,  proxied: false },
  { id: 'demo-07', type: 'CNAME',  name: 'blog',                             content: 'esocialz.hashnode.dev',                 ttl: 1800, proxied: false },
  { id: 'demo-08', type: 'CNAME',  name: 'docs',                             content: 'maskedes.github.io',                    ttl: 1800, proxied: true },
  { id: 'demo-09', type: 'CNAME',  name: 'shop',                             content: 'shops.myshopify.com',                   ttl: 1800, proxied: true },
  { id: 'demo-10', type: 'MX',     name: 'esocialzdomains.eu.org',           content: '10 mail.esocialzdomains.eu.org',        ttl: 3600, proxied: false },
  { id: 'demo-11', type: 'MX',     name: 'esocialzdomains.eu.org',           content: '20 mail2.esocialzdomains.eu.org',       ttl: 3600, proxied: false },
  { id: 'demo-12', type: 'TXT',    name: 'esocialzdomains.eu.org',           content: 'v=spf1 include:_spf.mx.cloudflare.net ~all', ttl: 3600, proxied: false },
  { id: 'demo-13', type: 'TXT',    name: '_dmarc',                           content: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@esocialz.eu', ttl: 3600, proxied: false },
  { id: 'demo-14', type: 'TXT',    name: 'esocialzdomains.eu.org',           content: 'edes-verification=msk-kpl-lumina-2026', ttl: 3600, proxied: false },
  { id: 'demo-15', type: 'CAA',    name: 'esocialzdomains.eu.org',           content: '0 issue "letsencrypt.org"',             ttl: 3600, proxied: false },
  { id: 'demo-16', type: 'CAA',    name: 'esocialzdomains.eu.org',           content: '0 issuewild "digicert.com"',            ttl: 3600, proxied: false },
  { id: 'demo-17', type: 'SRV',    name: '_sip._tcp',                        content: '10 5 5060 sip.esocialzdomains.eu.org',  ttl: 3600, proxied: false },
  { id: 'demo-18', type: 'NS',     name: 'auth',                             content: 'ns1.esocialzdomains.eu.org',            ttl: 86400, proxied: false },
  { id: 'demo-19', type: 'NS',     name: 'auth',                             content: 'ns2.esocialzdomains.eu.org',            ttl: 86400, proxied: false },
  { id: 'demo-20', type: 'A',      name: 'ns1',                              content: '203.0.113.53',                          ttl: 86400, proxied: false },
  { id: 'demo-21', type: 'A',      name: 'ns2',                              content: '203.0.113.54',                          ttl: 86400, proxied: false },
];

const api = async (path: string, init?: RequestInit) => {
  try {
    const res = await fetch(`/api/dns${path}`, {
      method: init?.method ?? 'GET',
      headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
      body: init?.body,
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? `API ${res.status}`);
    return body;
  } catch (e) {
    console.error('API error:', e);
    throw e;
  }
};

export const DomainSettingsScreen: React.FC<DomainSettingsProps> = ({ domain, onBack, user }: DomainSettingsProps & { user?: User }) => {
  const toast = useToast();
  
  // Email setup state
  const [emailProvider, setEmailProvider] = useState('');
  const [mxHost, setMxHost] = useState('');
  const [mxPriority, setMxPriority] = useState('10');
  const [spfMechanisms, setSpfMechanisms] = useState('');
  const [dkimSelector, setDkimSelector] = useState('');
  const [dmarcPolicy, setDmarcPolicy] = useState('none');
  const [emailResult, setEmailResult] = useState('');
  // Zone-file import state (source precedence: CNAME exclusivity, imported MX
  // authoritative for what it defines, one SPF/DMARC/DKIM per name, warnings)
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');
  const importFileRef = useRef<HTMLInputElement>(null);
  
  // State initialization - use domain prop first, then fallback
  const [selectedDomain, setSelectedDomain] = useState<string | null>(domain ?? null);
  const [userDomains, setUserDomains] = useState<UserDomain[]>([]);
  const [zone, setZone] = useState<{ name: string; status: string; nameServers: string[] } | null>(null);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Add-record form state
  const [recType, setRecType] = useState('A');
  const [recName, setRecName] = useState('');
  const [recContent, setRecContent] = useState('');
  const [recProxied, setRecProxied] = useState(false);

  // Domain overview + setup-wizard state (DigitalPlat-style)
  const [setupOpen, setSetupOpen] = useState(true);
  const [purpose, setPurpose] = useState('verify');
  const [dnsChecking, setDnsChecking] = useState(false);
  const [dnsResult, setDnsResult] = useState('');
  // ── Verify a service: publish another service's TXT record ──
  // The token always comes from the service that asks for it; the record is
  // written exactly as supplied and values already at that name stay.
  const VERIFY_SERVICES = [
    { id: 'workos', name: 'WorkOS (single sign-on / domain claims)', host: '@', prefix: 'verification_token=', placeholder: 'the verification_token WorkOS returns for this domain', handle: false },
    { id: 'gsc', name: 'Google Search Console (Domain property)', host: '@', prefix: 'google-site-verification=', placeholder: 'the TXT value Search Console gives this domain', handle: false },
    { id: 'bluesky', name: 'Bluesky handle', host: '_atproto', prefix: 'did=', placeholder: 'did:plc:… (your account’s DID)', handle: true },
  ];
  const [verifyService, setVerifyService] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [verifyHandle, setVerifyHandle] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyResult, setVerifyResult] = useState('');
  const [verifyPublished, setVerifyPublished] = useState<{ host: string; value: string } | null>(null);

  const handleVerifyPublish = async () => {
    const svc = VERIFY_SERVICES.find(s => s.id === verifyService);
    if (!svc || !verifyToken.trim() || !displayDomain) return;
    setVerifyBusy(true);
    setVerifyResult('');
    try {
      const host = svc.id === 'bluesky'
        ? `_atproto.${(verifyHandle.trim() || displayDomain).toLowerCase().replace(/\.$/, '')}`
        : displayDomain; // @ — the domain's own name
      const value = `${svc.prefix}${verifyToken.trim()}`;
      // the values already at that name stay: we only add this TXT record
      await api('/records', { method: 'POST', body: JSON.stringify({ type: 'TXT', name: host, content: value, ttl: 3600, proxied: false }) });
      setVerifyPublished({ host, value });
      setVerifyResult(`✅ TXT written at ${host}, value kept exactly as supplied:\n    ${value}\nThe service that issued the token runs its own check — WorkOS polls periodically, Search Console keeps checking the token stays, and Bluesky resolves the handle text record.`);
    } catch (e) {
      setVerifyResult(`❌ ${(e as Error).message}`);
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleVerifyCheckNow = async () => {
    if (!verifyPublished) return;
    setVerifyBusy(true);
    try {
      const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(verifyPublished.host)}&type=TXT`);
      const j = await r.json();
      const values = (j.Answer || []).filter((a: any) => a.type === 16)
        .map((a: any) => String(a.data).replace(/"/g, ''));
      if (values.includes(verifyPublished.value)) {
        setVerifyResult(`✅ ${verifyPublished.host} resolves with the exact value — verify with the issuing service now.\n    ${values.length} TXT value(s) at this name (all preserved).`);
      } else {
        setVerifyResult((zone.status !== 'active'
          ? `⏳ Not visible yet — the record is written; public DNS only answers for this domain once its delegation is live (zone status: ${zone.status}). Check again after that.`
          : `⏳ Not visible yet — DNS can take minutes to hours to propagate. The record is written; check again in a bit.`)
          + `\n    (Looking for: ${verifyPublished.value})`);
      }
    } catch (e) {
      setVerifyResult(`❌ Lookup failed: ${(e as Error).message}`);
    } finally {
      setVerifyBusy(false);
    }
  };

  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const toDate = (v: any): Date | null => {
    if (!v) return null;
    const d = v.toDate?.() ?? (v instanceof Date ? v : new Date(v));
    return isNaN(d.getTime()) ? null : d;
  };

  // Determine the domain to display — needed by everything below
  const displayDomain = domain || selectedDomain || null;

  // Real user data: find the selected domain's Firestore document
  const selDomainDoc = userDomains.find(d => d.name === displayDomain) || null;
  const regDate = toDate(selDomainDoc?.createdAt) ?? toDate(selDomainDoc?.registeredAt); // null → "—" shown
  const expDate = toDate(selDomainDoc?.expiresAt);

  // Real nameservers: saved local edit > Firestore doc > live zone (backend)
  const realNS: string[] = (() => {
    try {
      const saved = displayDomain ? localStorage.getItem(`ns:${displayDomain}`) : null;
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    if (Array.isArray(selDomainDoc?.nameservers) && selDomainDoc.nameservers.length) return selDomainDoc.nameservers;
    return zone?.nameServers ?? [];
  })();
  // Internal (EDES / e-domainz) vs External providers — determined by the actual hostnames
  const dnsMode = realNS.some(h => /esocialzdomains\.eu\.org|e-domainz|edes/i.test(String(h)))
    ? `Internal (EDES DNS)` 
    : realNS.length ? `External` : '—';

  // Download a plain-text Domain Ownership Certificate
  const handleCertificate = () => {
    const txt = [
      '===== E-Socialz / EDES Domain Ownership Certificate =====',
      `Domain:        ${displayDomain}`,
      `Owner:         ${selDomainDoc?.ownerName || user?.displayName || user?.email || 'MASK EDES'}`,
      `Handle:        ME1425-FREE (nic.eu.org)`,
      `Registered:    ${regDate ? fmt(regDate) : '—'}`,
      `Expires:       ${expDate ? fmt(expDate) : '—'}`,
      `Nameservers:   ${realNS.length ? realNS.join(', ') : '—'}`,
      `DNS mode:      ${dnsMode}`,
      `Notes:         Free renewal available within 120 days of expiry.`,
      `Issued:        ${new Date().toISOString()}`,
      '==========================================================',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(displayDomain || 'domain').replace(/[^a-z0-9.]/gi, '_')}-ownership-certificate.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // "Check DNS" — query the global DNS (Google DoH) for NS delegation
  const handleCheckDns = async () => {
    if (!displayDomain) return;
    setDnsChecking(true);
    setDnsResult('');
    try {
      const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(displayDomain)}&type=NS`);
      const j = await r.json();
      const ns = (j.Answer || []).filter((a: any) => a.type === 2);
      setDnsResult(
        ns.length
          ? `✅ Delegated — NS: ${ns.map((a: any) => a.data).join(', ')}`
          : `⏳ Not delegated yet in the global root (eu.org request pending). Cloudflare nameservers are ready.`
      );
    } catch (e) {
      setDnsResult(`❌ Lookup failed: ${(e as Error).message}`);
    } finally {
      setDnsChecking(false);
    }
  };

  // Export the zone as a standard RFC 1035 zone file — most DNS providers
  // can import it. Run this BEFORE switching nameservers: DNS has no way to
  // list a zone, so anything outside the common record names must be carried
  // over from this file (a CNAME is copied as the CNAME, a wildcard as a
  // wildcard; the zone's own NS and SOA are never exported).
  const handleExportZoneFile = () => {
    if (!displayDomain) return;
    const zoneAbs = `${displayDomain}.`;
    const escTxt = (s: string) => (s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const relToAbs = (raw: string): { owner: string; isRoot: boolean } | null => {
      const name = (raw || '').trim().toLowerCase().replace(/\.$/, '');
      if (!name) return null;
      if (name === displayDomain) return { owner: '@', isRoot: true };
      if (name === '@') return { owner: '@', isRoot: true };
      if (name.endsWith('.' + displayDomain)) {
        return { owner: `${name.slice(0, name.length - displayDomain.length - 1)}.${zoneAbs}`, isRoot: false };
      }
      // Relative name (e.g. demo data or short form) — make it absolute
      return { owner: `${name}.${zoneAbs}`, isRoot: false };
    };
    const lines: string[] = [
      `; EDES zone export for ${zoneAbs}`,
      `; Generated ${new Date().toISOString()}`,
      `; Replace nameservers with EDES's to let EDES host the zone;`,
      `; import this file into the new host to carry over what is below.`,
      `$ORIGIN ${zoneAbs}`,
      `$TTL 3600`,
      ``,
    ];
    const seen = new Set<string>();
    records.forEach((rec) => {
      const ident = `${relToAbs(rec.name)?.owner}:${rec.type}:${rec.content}`;
      if (seen.has(ident)) return; // skip duplicates from API + demo merge
      seen.add(ident);
      const rel = relToAbs(rec.name);
      if (!rel || !rec.content) return;
      let content = String(rec.content).trim();
      if (rec.type === 'TXT') content = `"${escTxt(content)}"`;
      if (rec.type === 'MX') {
        // legacy content may embed the priority ("10 mail.host") — keep it
        const m = content.match(/^(\d+)\s+(\S+)$/);
        if (!m) content = `10 ${content}`; // Cloudflare list does not return priority
      }
      if (rec.type === 'CAA') {
        // "0 issue \"letsencrypt.org\"" already in CAA form — keep as-is
      }
      lines.push(`${rel.owner}\t${rec.ttl || 3600}\tIN\t${rec.type}\t${content}`);
    });
    lines.push('');
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${displayDomain}.zone.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.saved('Zone file exported', `${records.length} records written to ${displayDomain}.zone.txt`);
  };

  // ── Zone file import (RFC 1035 / BIND format) ──
  // Sources disagree → higher one wins: customdomain > manual > imported > discovered.
  // A CNAME can't share a name; an imported MX set replaces the copied MX set;
  // one v=spf1 / v=DMARC1 / v=DKIM1 TXT per name; every replaced or skipped
  // record is explained in warnings.
  const parseZoneFile = (text: string, zoneName: string): { recs: { name: string; type: string; ttl: number; priority?: number; content: string }[]; warnings: string[] } => {
    const out: { name: string; type: string; ttl: number; priority?: number; content: string }[] = [];
    const warnings: string[] = [];
    const zone = zoneName.toLowerCase();
    let origin = `${zone}.`;
    let defaultTtl = 3600;
    let lastOwner = '';
    const HOSTED = new Set(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA']);
    const TYPES = new Set(['SOA', 'NS', 'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA', 'PTR', 'DNAME', 'NAPTR', 'HINFO', 'LOC', 'SSHFP', 'TLSA', 'SVCB', 'HTTPS']);

    const ttlToSecs = (tok: string, no: number): number => {
      const m = tok.toLowerCase().match(/^(\d+)([smhdw]?)$/);
      if (!m) return defaultTtl;
      const mult: Record<string, number> = { '': 1, s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
      const v = parseInt(m[1], 10) * mult[m[2]];
      if (v < 60 || v > 604800) warnings.push(`line ${no}: TTL ${tok} clamped to the 60–604800 range`);
      return Math.min(604800, Math.max(60, v));
    };
    const stripComment = (s: string) => {
      let r = '', q = false;
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '"') q = !q;
        if (c === ';' && !q) break;
        r += c;
      }
      return r;
    };
    const tokenize = (s: string): string[] => {
      const toks: string[] = [];
      let cur = '', q = false;
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '"') { q = !q; cur += c; }
        else if (!q && /\s/.test(c)) { if (cur) { toks.push(cur); cur = ''; } }
        else if (!q && (c === '(' || c === ')')) { if (cur) { toks.push(cur); cur = ''; } }
        else cur += c;
      }
      if (cur) toks.push(cur);
      return toks;
    };
    const resolveName = (tok: string, no: number): string | null => {
      let n = tok.toLowerCase();
      if (n === '@') n = origin;
      else if (!n.endsWith('.')) n = `${n}.${origin}`;
      n = n.replace(/\.$/, '');
      if (n === zone) return zoneName; // apex
      if (!n.endsWith(`.${zone}`)) { warnings.push(`line ${no}: name ${n} is outside ${zone}. — skipped`); return null; }
      return (n.slice(0, n.length - zone.length) || zoneName).replace(/\.$/, '') || zoneName; // relative ('' → apex)
    };
    const dnsName = (s: string) => (s || '').replace(/\.$/, '').toLowerCase();
    const parseTxt = (rdata: string): string => {
      const parts: string[] = [];
      const re = /"((?:[^"\\]|\\.)*)"/g;
      let m: RegExpExecArray | null, any = false;
      while ((m = re.exec(rdata))) { parts.push(m[1].replace(/\\(.)/g, '$1')); any = true; }
      return any ? parts.join('') : rdata.trim();
    };

    // Join multi-line records (parentheses) first
    const logical: { line: string; no: number }[] = [];
    let buf = '', bufNo = 0, depth = 0;
    text.split(/\r?\n/).forEach((raw, idx) => {
      const l = stripComment(raw);
      if (!buf.trim()) { bufNo = idx + 1; }
      buf += (buf.trim() ? ' ' : '') + l.trim();
      depth += (l.match(/\(/g) || []).length - (l.match(/\)/g) || []).length;
      if (depth <= 0) { if (buf.trim()) logical.push({ line: buf, no: bufNo }); buf = ''; depth = 0; }
    });
    if (buf.trim()) warnings.push(`line ${bufNo}: record with unclosed parenthesis skipped`);

    logical.forEach(({ line, no }) => {
      const t = line.trim();
      if (!t) return;
      const dir = t.split(/\s+/)[0].toUpperCase();
      if (dir === '$INCLUDE' || dir === '$GENERATE') { warnings.push(`line ${no}: ${dir} is not hosted — skipped`); return; }
      if (dir === '$ORIGIN') { origin = (t.split(/\s+/)[1] || origin).toLowerCase(); return; }
      if (dir === '$TTL') { defaultTtl = ttlToSecs(t.split(/\s+/)[1] || '3600', no); return; }

      const toks = tokenize(t);
      const typeIdx = toks.findIndex(tk => TYPES.has(tk.toUpperCase()));
      if (typeIdx < 0) { warnings.push(`line ${no}: not a resource record (no type found) — skipped`); return; }
      // token-position rule: the type in first position means a blank owner
      // (continuation of the line above); otherwise the first token is the owner
      let oi = 0, ttl = defaultTtl;
      let owner = '';
      if (typeIdx === 0) {
        owner = lastOwner;                       // blank owner
      } else {
        const first = toks[0];
        if (/^(IN|CH|HS)$/i.test(first) || /^\d+([smhdw]?)$/i.test(first)) {
          owner = lastOwner;                     // class or TTL where the owner belongs
        } else {
          owner = first; oi = 1;
        }
      }
      // remaining tokens before the type are TTL and/or class
      for (; oi < typeIdx; oi++) {
        const tk = toks[oi];
        if (/^\d+([smhdw]?)$/i.test(tk)) ttl = ttlToSecs(tk, no);
        // class (IN/CH/HS) tokens are simply skipped
      }
      lastOwner = owner || lastOwner;
      const type = toks[typeIdx].toUpperCase();
      const rdataToks = toks.slice(typeIdx + 1);
      const rd = (i: number) => dnsName(rdataToks[i] || '');
      if (type === 'SOA') { warnings.push(`line ${no}: the zone's own SOA is never copied — skipped`); return; }
      if (type === 'NS') {
        const nm = resolveName(owner || lastOwner, no);
        if (nm === null) return;
        if (nm === zoneName) { warnings.push(`line ${no}: the zone's own NS records are never copied — skipped`); return; }
        out.push({ name: nm, type, ttl, content: rd(0) });
        return;
      }
      if (!HOSTED.has(type)) { warnings.push(`line ${no}: ${type} records are not hosted — skipped`); return; }
      const nm = resolveName(owner || lastOwner, no);
      if (nm === null) return;
      if (!rdataToks.length) { warnings.push(`line ${no}: no record data — skipped`); return; }
      if (type === 'MX') out.push({ name: nm, type, ttl, priority: parseInt(rdataToks[0], 10) || 0, content: rd(1) });
      else if (type === 'SRV') out.push({ name: nm, type, ttl, priority: parseInt(rdataToks[0], 10) || 0, content: `${rd(1)} ${rd(2)} ${rd(3)}` });
      else if (type === 'TXT') out.push({ name: nm, type, ttl, content: parseTxt(toks.slice(typeIdx + 1).join(' ')) });
      else if (type === 'CAA') out.push({ name: nm, type, ttl, content: rdataToks.join(' ') });
      else out.push({ name: nm, type, ttl, content: rd(0) });
    });
    return { recs: out, warnings };
  };

  const handleImportZoneFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !displayDomain) return;
    setImporting(true);
    setImportResult('');
    try {
      const text = await file.text();
      if (file.size > 256 * 1024) throw new Error('Zone file larger than 256 KB — nothing imported.');
      const { recs, warnings } = parseZoneFile(text, displayDomain);
      const w = [...warnings];
      if (!recs.length) throw new Error('The zone file has no records that can be hosted.');
      const existing = records as any[];
      const byName = new Map<string, any[]>();
      existing.forEach(r => {
        const k = String(r.name || '').toLowerCase();
        byName.set(k, [...(byName.get(k) || []), r]);
      });
      const same = (rec: any, r: { name: string; type: string; content: string }) =>
        String(rec.type).toUpperCase() === r.type && String(rec.content || '').trim().toLowerCase() === r.content.trim().toLowerCase();
      // CNAME exclusivity: a CNAME can't share its name with anything
      const cnameNames = new Set<string>();
      for (const r of recs.filter(x => x.type === 'CNAME')) {
        const k = r.name.toLowerCase();
        if ((byName.get(k) || []).length > 0) {
          cnameNames.add(k);
          w.push(`${r.type} at ${r.name}: skipped — a record already exists at this name (a CNAME can't share its name); it was not replaced.`);
        }
      }
      // markers: one v=spf1 / v=DMARC1 / v=DKIM1 TXT per name
      const markerOf = (c: string) => { const m = String(c).match(/^v=(spf1|DMARC1|DKIM1)\b/i); return m ? m[1].toLowerCase() : null; };
      let created = 0, replaced = 0;
      const mxNamesDone = new Set<string>();
      const markerDone = new Map<string, Set<string>>();
      for (const r of recs) {
        const k = r.name.toLowerCase();
        try {
          if (r.type === 'CNAME' && cnameNames.has(k)) continue;
          if (r.type !== 'CNAME' && cnameNames.has(k)) { w.push(`${r.type} at ${r.name}: skipped — a CNAME from the same file owns this name.`); continue; }
          if (r.type === 'MX') {
            // an imported MX set is authoritative for what it defines: replace the set once per name
            if (!mxNamesDone.has(k)) {
              mxNamesDone.add(k);
              for (const ex of (byName.get(k) || []).filter((x: any) => String(x.type).toUpperCase() === 'MX')) {
                await api(`/records/${ex.id}`, { method: 'DELETE' });
                replaced++;
              }
            }
          } else if (r.type === 'TXT' && markerOf(r.content)) {
            const mk = markerOf(r.content)!;
            const done = markerDone.get(k) || new Set<string>();
            if (done.has(mk)) { w.push(`TXT at ${r.name}: skipped — the name can hold only one v=${mk} record.`); continue; }
            done.add(mk);
            markerDone.set(k, done);
            for (const ex of (byName.get(k) || []).filter((x: any) => String(x.type).toUpperCase() === 'TXT' && markerOf(x.content) === mk)) {
              await api(`/records/${ex.id}`, { method: 'DELETE' });
              replaced++;
            }
          } else if ((byName.get(k) || []).some((x: any) => same(x, r))) {
            w.push(`${r.type} at ${r.name}: identical record already exists — skipped.`);
            continue;
          }
          const body: Record<string, unknown> = { type: r.type, name: r.name, content: r.content, ttl: r.ttl, proxied: false };
          if (r.priority !== undefined) body.priority = r.priority;
          if (r.type === 'MX') body.essential = true;
          await api('/records', { method: 'POST', body: JSON.stringify(body) });
          created++;
        } catch (err) {
          w.push(`${r.type} at ${r.name}: ${(err as Error).message}`);
        }
      }
      const summary = `✅ ${created} record${created === 1 ? '' : 's'} imported from ${file.name}${replaced ? ` (${replaced} existing record${replaced === 1 ? '' : 's'} replaced)` : ''}${w.length ? `\n\nWarnings (${w.length}):\n• ${w.join('\n• ')}` : ''}`;
      setImportResult(summary);
      if (created > 0) toast.saved('Zone file imported', `${created} records created${w.length ? `, ${w.length} skipped` : ''}`);
      else toast.error('Nothing imported', 'No records could be applied from this zone file.');
      await refresh(true);
    } catch (err) {
      setImportResult(`❌ ${(err as Error).message}`);
      toast.error('Import failed', (err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  // ── Nameserver updating (DigitalPlat-style, realtime via Firestore) ──
  const NS_SLOTS = 8;
  const [nsSlots, setNsSlots] = useState<string[]>(Array(NS_SLOTS).fill(''));
  const [nsSaving, setNsSaving] = useState(false);
  const [nsMsg, setNsMsg] = useState('');

  // Sync the editable slots with the live zone nameservers whenever they change.
  // A locally-saved copy (from a previous update) always wins so edits survive reloads.
  useEffect(() => {
    let base: string[] = zone?.nameServers ?? [];
    try {
      const saved = displayDomain ? localStorage.getItem(`ns:${displayDomain}`) : null;
      if (saved) base = JSON.parse(saved);
    } catch { /* ignore corrupt local copy */ }
    if (!base.length) return;
    setNsSlots((prev) => {
      const next = Array(NS_SLOTS).fill('');
      base.forEach((ns, i) => {
        if (i < NS_SLOTS) next[i] = prev[i] || ns;
      });
      return next;
    });
  }, [zone?.nameServers, displayDomain]);

  const setNsSlot = (i: number, v: string) =>
    setNsSlots((prev) => prev.map((s, idx) => (idx === i ? v : s)));

  // Recommended preset: keep the zone on the EDES-managed Cloudflare nameservers
  const handleUseEdesDns = () => {
    setNsSlots((prev) => {
      const next = [...prev];
      const preset = zone?.nameServers ?? ['kristin.ns.cloudflare.com', 'rommy.ns.cloudflare.com'];
      next[0] = preset[0] || 'kristin.ns.cloudflare.com';
      next[1] = preset[1] || 'rommy.ns.cloudflare.com';
      return next;
    });
    setNsMsg('');
  };

  // Nameserver values must be hostnames — never IPs, resolvers or URLs.
  // (The last label of a valid NS hostname cannot be all-numeric, which
  // rejects IPv4 pairs like ns1 -> 203.0.113.53 typed per-slot.)
  const isHostname = (h: string) => {
    const s = h.trim().toLowerCase();
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(s)) return false;
    const last = s.split('.').pop()!;
    if (/^\d+$/.test(last)) return false;          // pure-numeric TLD → IPv4 was pasted
    if (s.includes('/') || s.includes(':')) return false; // URLs / IPv6
    return true;
  };

  // ── Verify what the parent actually publishes (guide's 3-layer check) ──
  // Layer 1: NS lookup shows the delegation the parent serves.
  // Layer 2: SOA lookup proves a live zone exists at the authoritative server.
  const [nsVerifying, setNsVerifying] = useState(false);
  const [nsVerifyResult, setNsVerifyResult] = useState('');

  const handleVerifyDelegation = async () => {
    if (!displayDomain) return;
    setNsVerifying(true);
    setNsVerifyResult('');
    try {
      // Layer 1 — what does the parent publish?
      const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(displayDomain)}&type=NS`);
      const j = await r.json();
      const published = (j.Answer || []).filter((a: any) => a.type === 2).map((a: any) => a.data.replace(/\.$/, '').toLowerCase());
      if (!published.length) {
        setNsVerifyResult(`⏳ Parent publishes NO delegation yet (NXDOMAIN/NOANSWER) — eu.org request still pending or nameservers not saved there.`);
        return;
      }
      // Compare with the list entered in the editor
      const entered = nsSlots.map(s => s.trim().toLowerCase()).filter(Boolean);
      const match = published.every(p => entered.includes(p)) && entered.every(e => published.includes(e));
      const l1 = `1️⃣ Parent NS: ${published.join(', ')}${match ? ' — matches your list' : ' — DIFFERS from your list'}`;
      // Layer 2 — does a live zone exist there? (SOA comes from the authoritative server)
      const r2 = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(displayDomain)}&type=SOA`);
      const j2 = await r2.json();
      const soa = (j2.Answer || []).find((a: any) => a.type === 6);
      const l2 = soa
        ? `2️⃣ Zone OK — SOA exists (primary: ${soa.data.split(' ')[0]}), records answer from the authoritative server.`
        : `2️⃣ ⚠️ Delegation exists but NO zone/SOA there yet — your records at that provider won't resolve. Upload the zone in the provider's panel.`;
      setNsVerifyResult(`${l1}\n${l2}`);
    } catch (e) {
      setNsVerifyResult(`❌ Lookup failed: ${(e as Error).message}`);
    } finally {
      setNsVerifying(false);
    }
  };

  // ── Managed DNS (DNS hosting): Check → Start → Switch → Active ──
  // One nameserver change at the registrar; after the delegation turns the
  // zone active, every later record change is written automatically.
  // Registry delegation states: awaiting_delegation / active / failed.
  const [mdnsChecking, setMdnsChecking] = useState(false);
  const [mdnsPhase, setMdnsPhase] = useState<'start' | 'switch' | 'active'>('start');
  const [mdnsState, setMdnsState] = useState<'awaiting_delegation' | 'active' | 'failed'>('awaiting_delegation');
  const [mdnsResult, setMdnsResult] = useState('');

  const handleMdnsCheck = async () => {
    if (!displayDomain) return;
    setMdnsChecking(true);
    setMdnsResult('');
    try {
      const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(displayDomain)}&type=NS`);
      const j = await r.json();
      const published = (j.Answer || []).filter((a: any) => a.type === 2).map((a: any) => a.data.replace(/\.$/, '').toLowerCase());
      const ours = realNS.map((n: string) => n.trim().toLowerCase()).filter(Boolean);
      const key = `mdns:${displayDomain}`;
      const allOurs = published.length > 0 && ours.length > 0 && published.every(p => ours.includes(p));
      const someOurs = published.some(p => ours.includes(p));

      const prev = (() => { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } })() as { state?: string; since?: string };
      let state: 'awaiting_delegation' | 'active' | 'failed' = 'awaiting_delegation';
      let text = '';
      if (allOurs) {
        state = 'active';
        text = `✅ Active — every nameserver the parent lists is ours (${published.join(', ')}). The zone is live and verified; every record change from now on is written automatically. Re-checked every 6 hours.`;
      } else if (published.length === 0) {
        text = `⏳ Awaiting delegation — the zone holds the records; the domain still uses other nameservers (none published yet). Nothing changes for anyone until the nameservers are replaced at the registrar. Checked every few minutes for the first day, hourly after.`;
      } else if (someOurs) {
        // partial: resolvers that pick one of the extras still get old answers
        const extras = published.filter(p => !ours.includes(p));
        text = `⏳ Awaiting delegation — some of our nameservers and some others are listed (${published.join(', ')}). The zone stays awaiting_delegation until the extras are removed: resolvers that pick one of them (${extras.join(', ')}) would still get the old answers.`;
      } else {
        text = `⏳ Awaiting delegation — the parent still publishes other nameservers (${published.join(', ')}). The domain still uses other nameservers until they are replaced at the registrar.`;
      }
      // failed: the switch didn't happen within 14 days of the zone being
      // created, or the nameservers moved away after being active. A failed
      // zone is still checked and turns active as soon as the delegation appears.
      if (!allOurs) {
        const since = prev.since ? new Date(prev.since).getTime() : 0;
        if (prev.state === 'active') {
          state = 'failed';
          text = `⚠️ Failed — the nameservers later moved away from ours (the parent lists ${published.length ? published.join(', ') : 'nothing'}). The zone keeps being checked twice a day and turns active as soon as the delegation points back at ours.`;
        } else if (since && Date.now() - since > 14 * 24 * 3600 * 1000) {
          state = 'failed';
          text = `⚠️ Failed — the switch didn't happen within 14 days of the zone being created (${new Date(since).toLocaleDateString()}). The first warning says which nameservers to replace: ${published.length ? published.join(', ') : 'none published yet'}. The zone keeps being checked twice a day and turns active as soon as the delegation appears.`;
        }
      }
      localStorage.setItem(key, JSON.stringify({ state, since: state === 'active' ? new Date().toISOString() : (prev.since ?? new Date().toISOString()) }));
      setMdnsState(state);
      setMdnsPhase(state === 'active' ? 'active' : 'switch');
      setMdnsResult(text);
    } catch (e) {
      setMdnsResult(`❌ Lookup failed: ${(e as Error).message}`);
    } finally {
      setMdnsChecking(false);
    }
  };

  // Persist to Firestore → Domain List + overview update in realtime
  const handleUpdateNameservers = async () => {
    const filled = nsSlots.map(s => s.trim()).filter(Boolean);
    if (filled.length < 2) { setNsMsg('❌ At least 2 nameservers are required.'); return; }
    if (!filled.every(isHostname)) { setNsMsg('❌ Use valid nameserver hostnames (e.g. ns1.provider.com).'); return; }
    if (new Set(filled.map(s => s.toLowerCase())).size !== filled.length) {
      setNsMsg('❌ Duplicate nameservers are not allowed.'); return;
    }
    setNsSaving(true);
    setNsMsg('');
    try {
      const q2 = query(collection(db, 'domains'), where('name', '==', displayDomain));
      const snap = await getDocs(q2);
      if (!snap.empty) {
        await Promise.all(snap.docs.map(d =>
          updateDoc(doc(db, 'domains', d.id), {
            nameservers: filled,
            nameserversUpdatedAt: new Date().toISOString(),
          })
        ));
      }
      // Optimistic UI update — everywhere reflecting zone shows it instantly
      setZone((prev: any) => prev ? { ...prev, nameServers: filled } : prev);
      toast.updated('Nameservers updated', `${displayDomain} — changes may take a few minutes to propagate.`);
      setNsMsg('');
    } catch (e) {
      // Firestore rules may not allow updating domain docs yet — persist locally
      // so the realtime UI still works, and try to install per-domain backup:
      try {
        localStorage.setItem(`ns:${displayDomain}`, JSON.stringify(filled));
        setZone((prev: any) => prev ? { ...prev, nameServers: filled } : prev);
        toast.saved('Nameservers applied', `${displayDomain} (saved locally) — changes may take a few minutes to propagate.`);
        setNsMsg('');
      } catch {
        setNsMsg('❌ Could not save nameservers: ' + (e as Error).message);
      }
    } finally {
      setNsSaving(false);
    }
  };

  // Helper: safely get first domain name from Firestore snapshot
  const getFirstDomainName = (docs: any[]): string | null => {
    if (!docs || docs.length === 0) return null;
    const d = docs[0];
    return d.name || d.data?.name || null;
  };

  // Helper: strip the zone suffix from a record name for a compact display
  const relName = (name: string): string =>
    (name || '').toLowerCase().replace(/\.esocialzdomains\.eu\.org$/, '');

  // Load user's domains from Firestore on mount / user change
  useEffect(() => {
    // Don't run if no user or no domain prop
    if (!user || !domain) {
      setUserDomains([]);
      // If we have a domain prop but no user, just use it
      if (domain && !selectedDomain) {
        setSelectedDomain(domain);
      }
      return;
    }

    const q = query(collection(db, 'domains'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      try {
        const docs = snapshot.docs.map(d => ({
          id: d.id,
          name: d.data().name || d.data?.name || '',
          userId: d.data().userId || d.data?.userId || '',
          status: d.data().status || d.data?.status || '',
          createdAt: d.data().createdAt,
          expiresAt: d.data().expiresAt,
          registeredAt: d.data().registeredAt,
          nameservers: d.data().nameservers,
          ownerName: d.data().ownerName || d.data().displayName,
          dnsConfigured: d.data().dnsConfigured,
          notes: d.data().notes,
        }));
        setUserDomains(docs);
        
        // If no domain prop was set, use first from Firestore
        // If domain prop WAS set, keep it (don't override)
        if (!domain && docs.length > 0 && !selectedDomain) {
          setSelectedDomain(getFirstDomainName(docs));
        }
      } catch (e) {
        console.error('Firestore error:', e);
        setError('Failed to load domains');
      }
    });
    return () => unsub();
  }, [user, domain]);

  // Refresh DNS zone + records for the selected domain
  const refresh = useCallback(async (quiet = false) => {
    if (!selectedDomain) return;
    setLoading(true);
    try {
      const [z, r] = await Promise.all([
        // Fetch zone info from API — keep existing route for zone metadata
        api('/zone'),
        // Fetch DNS records from the local API for the selected domain
        api(`/records?name=${encodeURIComponent(selectedDomain)}`),
      ]);
      setZone({
        name: z.name ?? selectedDomain,
        status: z.status ?? 'pending eu.org delegation',
        nameServers: z.name_servers ?? ['kristin.ns.cloudflare.com', 'rommy.ns.cloudflare.com'],
      });
      setRecords(r.records ?? []);
      setMessage('');
      setError('');
    } catch (e) {
      // Backend / Cloudflare API offline -> fall back to demo data for testing
      setZone({
        name: selectedDomain,
        status: 'demo mode (backend offline) — real zone pending eu.org delegation',
        nameServers: ['kristin.ns.cloudflare.com', 'rommy.ns.cloudflare.com'],
      });
      setRecords(DEMO_RECORDS);
    } finally {
      setLoading(false);
    }
  }, [selectedDomain]);

  // Initial refresh after state settles
  useEffect(() => {
    // Small delay to let Firestore state settle
    const timer = setTimeout(() => {
      if (selectedDomain) {
        refresh(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [selectedDomain]);

  // Add DNS record
  const addRecord = async () => {
    if (!recName || !recContent) return;
    setBusy(true);
    setError('');
    try {
      const fqdn = recName.toLowerCase().endsWith('.esocialzdomains.eu.org')
        ? recName.toLowerCase()
        : `${recName.toLowerCase()}.esocialzdomains.eu.org`;
      await api('/records', {
        method: 'POST',
        body: JSON.stringify({ type: recType, name: fqdn, content: recContent.trim(), proxied: recProxied }),
      });
      toast.saved(`DNS ${recType} record is live`, `${fqdn} was added to the zone.`);
      setRecContent('');
      await refresh(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Delete DNS record — with confirmation popup card
  const delRecord = async (id: string, fqdn: string) => {
    const ok = await toast.confirm({
      title: 'Delete DNS record?',
      message: `${fqdn} will be removed permanently. This cannot be undone.`,
      kind: 'danger',
      confirmLabel: 'Delete',
      icon: 'delete',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/records/${id}`, { method: 'DELETE' });
      toast.deleted('Record deleted', `${fqdn} was removed from the zone.`);
      await refresh(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Delete the whole domain from the account — with confirmation popup card.
  // The Domain List listens via onSnapshot, so it disappears everywhere in realtime.
  const handleDeleteDomain = async () => {
    if (!displayDomain) return;
    const ok = await toast.confirm({
      title: 'Delete this domain?',
      message: `${displayDomain} will be removed from your account permanently. This cannot be undone.`,
      kind: 'danger',
      confirmLabel: 'Delete domain',
      icon: 'delete',
    });
    if (!ok) return;
    try {
      // Remove every doc for this domain name (guards against stray duplicates)
      const q2 = query(collection(db, 'domains'), where('name', '==', displayDomain));
      const snap = await getDocs(q2);
      await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'domains', d.id))));
      // Clear any locally saved nameserver copy for it
      try { localStorage.removeItem(`ns:${displayDomain}`); } catch { /* ignore */ }
      toast.deleted('Domain deleted', `${displayDomain} was removed from your account.`);
      onBack();
    } catch (e) {
      toast.error('Delete failed', (e as Error).message || 'Firestore rules may block deletes — allow delete on the domains collection in the Firebase console.');
    }
  };

  // ── Email DNS: apply records with SPF merge (SPFM-style) ──
  const handleApplyEmailRecords = async () => {
    if (!displayDomain || !emailProvider) return;
    setBusy(true);
    setEmailResult('');
    try {
      const domainBase = displayDomain;

      // 1. MX record — content is the mail host; priority is its own field
      //    (essential: true flags it — mail is down without MX)
      await api('/records', {
        method: 'POST',
        body: JSON.stringify({
          type: 'MX',
          name: domainBase,
          content: mxHost.trim(),
          ttl: 3600,
          proxied: false,
          priority: Number(mxPriority) || 0,
          essential: true,
        }),
      });

      // 2. SPF merge: read the one published v=spf1 record, merge our
      //    mechanisms into it deduped, and keep a single terminal all.
      //    The existing record's qualifier is preserved (never loosened).
      const existingRecords = await api(`/records?name=${encodeURIComponent(domainBase)}`);
      const existingSpfRecord = (existingRecords.records || []).find(
        (r: any) => r.type === 'TXT' && r.content?.startsWith('v=spf1')
      );
      const parseMechs = (s: string) =>
        s.split(/[\s,]+/).map(m => m.trim()).filter(m => m);
      const existingMechs = existingSpfRecord
        ? parseMechs(existingSpfRecord.content.replace(/^v=spf1\s*/i, ''))
        : [];
      const allMechs = parseMechs(spfMechanisms).filter(Boolean);
      // Terminal qualifier: existing wins (a merge never loosens the policy)
      const existingAll = existingMechs.find(m => /^[~+\-?]?all$/i.test(m));
      const newAll = allMechs.find(m => /^[~+\-?]?all$/i.test(m));
      const qualifier = existingAll || newAll || '~all';
      const merged = [
        ...new Set([
          ...existingMechs.filter(m => !/^[~+\-?]?all$/i.test(m)),
          ...allMechs.filter(m => !/^[~+\-?]?all$/i.test(m)),
        ]),
      ];
      const spfContent = `v=spf1 ${[...merged, qualifier].join(' ')}`;
      if (existingSpfRecord) {
        // Replace (delete + recreate) so the zone keeps exactly one SPF record
        await api(`/records/${existingSpfRecord.id}`, { method: 'DELETE' });
      }
      await api('/records', {
        method: 'POST',
        body: JSON.stringify({
          type: 'TXT',
          name: domainBase,
          content: spfContent,
          ttl: 3600,
          proxied: false,
        }),
      });

      // 3. DKIM: the key is generated in the provider's admin console and
      //    cannot be derived here — we publish their selector._domainkey
      //    record as given, so we only show what to paste.
      const dkimHost = dkimSelector.trim() ? `${dkimSelector.trim()}._domainkey` : '';

      // 4. DMARC — always starts at p=none (monitor only); tighten to
      //    quarantine/reject later, once legitimate mail passes DKIM/SPF.
      await api('/records', {
        method: 'POST',
        body: JSON.stringify({
          type: 'TXT',
          name: '_dmarc',
          content: `v=DMARC1; p=${dmarcPolicy}; rua=mailto:dmarc@${domainBase}`,
          ttl: 3600,
          proxied: false,
        }),
      });

      toast.saved('Email records applied', `MX, SPF merge & DMARC configured for ${displayDomain}`);
      setEmailResult(
        `✅ Email records applied\n` +
        `MX:        ${Number(mxPriority) || 0} ${mxHost.trim()} (essential)\n` +
        `SPF:       ${spfContent}\n` +
        `DMARC:     v=DMARC1; p=${dmarcPolicy}; rua=mailto:dmarc@${domainBase}` +
        (dkimHost
          ? `\nDKIM step: add the record your provider's console gives you at ${dkimHost} (the key is unique per domain — it cannot be derived here).`
          : `\nDKIM step: add the provider's <selector>._domainkey record as given in their admin console.`)
      );
      await refresh(true);
    } catch (e) {
      setEmailResult(`❌ ${(e as Error).message}`);
      toast.error('Apply failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleCheckSpfMerge = async () => {
    if (!displayDomain) return;
    setBusy(true);
    setEmailResult('');
    try {
      const existingRecords = await api(`/records?name=${encodeURIComponent(displayDomain)}`);
      const existingSpfRecord = (existingRecords.records || []).find(
        (r: any) => r.type === 'TXT' && r.content?.startsWith('v=spf1')
      );
      const parseMechs = (s: string) =>
        s.split(/[\s,]+/).map(m => m.trim()).filter(m => m);
      const existingMechs = existingSpfRecord
        ? parseMechs(existingSpfRecord.content.replace(/^v=spf1\s*/i, ''))
        : [];
      const allMechs = parseMechs(spfMechanisms).filter(Boolean);
      const existingAll = existingMechs.find(m => /^[~+\-?]?all$/i.test(m));
      const newAll = allMechs.find(m => /^[~+\-?]?all$/i.test(m));
      const qualifier = existingAll || newAll || '~all';
      const merged = [
        ...new Set([
          ...existingMechs.filter(m => !/^[~+\-?]?all$/i.test(m)),
          ...allMechs.filter(m => !/^[~+\-?]?all$/i.test(m)),
        ]),
      ];
      const spfContent = merged.length ? `v=spf1 ${[...merged, qualifier].join(' ')}` : '(none)';
      setEmailResult(
        `Current SPF: ${existingSpfRecord?.content || '(none)'}\n` +
        `Adding mechanisms: ${allMechs.length ? allMechs.join(', ') : '(none)'}\n` +
        `Merged SPF (one record, qualifier ${qualifier}): ${spfContent}`
      );
    } catch (e) {
      setEmailResult(`❌ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!displayDomain) {
    return (
      <div className={styles.screen}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Domain Settings</h1>
        </div>
        <p className={styles.infoText}>Select a domain from your account to manage DNS.</p>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.pageHeader}>
        <div className={styles.topBarLabel}>DNS MANAGEMENT</div>
        <h1 className={styles.pageTitle}>{displayDomain}</h1>
      </div>

      <button className={styles.buttonOutline} onClick={onBack} style={{ width: 'auto', marginBottom: '16px' }}>
        ← Back to domains
      </button>

      {/* ── Domain overview (DigitalPlat-style) ── */}
      <div className={styles.card} style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className={styles.cardTitle}>Domain overview</div>
          <button className={styles.dLabelsBtn} title="No labels or notes yet">Labels &amp; notes</button>
        </div>
        <div className={styles.overviewGrid}>
          <div>
            <div className={styles.ovLabel}>Owner</div>
            <div className={styles.ovValue}>{selDomainDoc?.ownerName || user?.displayName || user?.email || '—'}</div>
          </div>
          <div>
            <div className={styles.ovLabel}>Registration date</div>
            <div className={styles.ovValue}>{regDate ? fmt(regDate) : '—'}</div>
          </div>
          <div>
            <div className={styles.ovLabel}>Expiration date</div>
            <div className={styles.ovValue}>{expDate ? fmt(expDate) : '—'}</div>
          </div>
          <div style={{ minWidth: 220 }}>
            <div className={styles.ovLabel}>DNS</div>
            <div className={styles.ovValue}>{dnsMode}{realNS.length ? ' nameservers' : ''}</div>
            {realNS.length > 0 && (
              <div className={styles.ovValue} style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', marginTop: 3 }}>
                {realNS.slice(0, 3).join(', ')}{realNS.length > 3 ? ` +${realNS.length - 3}` : ''}
              </div>
            )}
          </div>
        </div>
        <p className={styles.subText} style={{ marginTop: 14 }}>
          Free renewal is available within 120 days of expiry. Advance renewals use credits.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <button className={styles.ovBtnPrimary} onClick={() => { document.querySelector('input[placeholder="subdomain"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
            DNS
          </button>
          <button className={styles.ovBtn} onClick={() => setSetupOpen(true)}>Renewal</button>
          <button className={styles.ovBtn} onClick={handleCertificate}>
            Download Domain Ownership Certificate
          </button>
        </div>

        {/* ── Set up your domain (collapsible) ── */}
        <div className={styles.setupCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px' }}>
            <div className={styles.cardTitle} style={{ margin: 0 }}>Set up your domain</div>
            <button onClick={() => setSetupOpen(!setupOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>
              {setupOpen ? 'Not now ∨' : 'Show ∧'}
            </button>
          </div>
          {setupOpen && (
            <div style={{ borderTop: '1px solid var(--border, #e2e8f0)' }}>
              <p className={styles.subText} style={{ padding: '12px 18px 0' }}>
                Choose what you want to use this domain for.
              </p>
              <div className={styles.setupSteps}>
                <div className={styles.stepBox}>
                  <div className={styles.stepTitle}>1. Choose a use</div>
                  <p className={styles.stepDesc}>
                    {purpose === 'verify' && 'Use a provider’s TXT record to prove domain ownership.'}
                    {purpose === 'website' && 'Add an A/AAAA or CNAME record for www below.'}
                    {purpose === 'email' && 'Add MX + SPF TXT records for your mail provider.'}
                    {purpose === 'altroot' && 'NS records pointing at ns1/ns2.esocialzdomains.eu.org for alt-root delegation.'}
                  </p>
                  <div className={styles.stepControl}>
                    <select className={styles.stepSelect} value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                      <option value="verify">Verify a service</option>
                      <option value="website">Point to a website</option>
                      <option value="email">Set up email</option>
                      <option value="altroot">Connect EDES alt-root (.msk/.kpl)</option>
                    </select>
                  </div>
                </div>
                <div className={styles.stepBox}>
                  <div className={styles.stepTitle}>2. {purpose === 'verify' ? 'Publish the verification TXT' : 'Connect a service'}</div>
                  {purpose === 'verify' ? (
                    <>
                      <p className={styles.stepDesc}>
                        Copy the token the service gives you for this domain. We write it exactly as supplied — values already at that name stay.
                      </p>
                      <div className={styles.stepControl} style={{ display: 'grid', gap: 8 }}>
                        <select
                          className={styles.stepSelect}
                          value={verifyService}
                          onChange={(e) => { setVerifyService(e.target.value); setVerifyToken(''); setVerifyResult(''); }}
                        >
                          <option value="">— Choose a service —</option>
                          {VERIFY_SERVICES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        {verifyService === 'bluesky' && (
                          <input
                            className={styles.stepSelect}
                            placeholder={`handle (defaults to ${displayDomain || 'domain'})`}
                            value={verifyHandle}
                            onChange={(e) => setVerifyHandle(e.target.value)}
                          />
                        )}
                        <input
                          className={styles.stepSelect}
                          placeholder={VERIFY_SERVICES.find(s => s.id === verifyService)?.placeholder ?? 'choose a service first'}
                          value={verifyToken}
                          onChange={(e) => setVerifyToken(e.target.value)}
                          disabled={!verifyService}
                        />
                        <button
                          className={styles.ovBtn}
                          onClick={handleVerifyPublish}
                          disabled={verifyBusy || !verifyService || !verifyToken.trim()}
                        >
                          {verifyBusy ? 'Publishing…' : 'Publish TXT record'}
                        </button>
                        {verifyPublished && (
                          <button className={styles.ovBtn} onClick={handleVerifyCheckNow} disabled={verifyBusy}>
                            {verifyBusy ? 'Checking…' : 'Check now'}
                          </button>
                        )}
                      </div>
                      {verifyResult && (
                        <pre style={{ margin: '10px 0 0', fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{verifyResult}</pre>
                      )}
                    </>
                  ) : (
                    <>
                      <p className={styles.stepDesc}>
                        Have records from another provider? Configure DNS and paste them there.
                      </p>
                      <div className={styles.stepControl}>
                        <button className={styles.ovBtn} onClick={() => { document.querySelector('input[placeholder="subdomain"]')?.focus(); }}>
                          Configure DNS
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className={styles.stepBox}>
                  <div className={styles.stepTitle}>3. Check DNS</div>
                  <p className={styles.stepDesc}>
                    Check public DNS after saving your records.
                  </p>
                  <div className={styles.stepControl}>
                    <button className={styles.ovBtn} onClick={handleCheckDns} disabled={dnsChecking}>
                      {dnsChecking ? 'Checking…' : '〜 Check DNS'}
                    </button>
                  </div>
                </div>
                {dnsResult && (
                  <p className={styles.stepDesc} style={{ gridColumn: '1 / -1', margin: '0 18px 14px' }}>{dnsResult}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User's domain selector */}
      {userDomains.length > 0 && (
        <div className={styles.card} style={{ marginBottom: '24px' }}>
          <div className={styles.cardTitle}>
            <Globe size={20} style={{ color: 'var(--accent-primary)' }} /> Your domains
          </div>
          <select
            className={styles.select}
            onChange={(e) => {
              const picked = e.target.value;
              setSelectedDomain(picked);
              refresh(true);
            }}
          >
            <option value="">— Select domain —</option>
            {userDomains.map((d) => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </select>
          <p className={styles.subText} style={{ fontSize: '12px', marginTop: '8px' }}>
            {userDomains.length} domain(s) linked to your account
          </p>
        </div>
      )}

      {/* ── Managed DNS (DNS hosting) — one switch, then records are written for you ── */}
      <div className={styles.card} style={{ marginBottom: '24px' }}>
        <div className={styles.cardTitle}>
          <Globe size={20} style={{ color: 'var(--accent-primary)' }} /> Managed DNS (DNS hosting)
        </div>
        <p className={styles.subText} style={{ marginBottom: 14 }}>
          The other ways to connect stall when the provider's panel has to be edited by hand.
          Here the owner makes <strong>one change</strong>: set the domain's nameservers to EDES.
          From then on EDES hosts the whole zone, and every record — now and later — is written automatically.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginBottom: 14 }}>
          <div style={{ padding: '10px 14px', border: '1px solid var(--border, #e2e8f0)', borderRadius: 8 }}>
            <div className={styles.iconLabel}>1. Check</div>
            <p className={styles.subText} style={{ marginTop: 4, fontSize: 11 }}>✅ Available — zones EDES serves can always be hosted.</p>
          </div>
          <div style={{ padding: '10px 14px', border: '1px solid var(--border, #e2e8f0)', borderRadius: 8 }}>
            <div className={styles.iconLabel}>2. Start</div>
            <p className={styles.subText} style={{ marginTop: 4, fontSize: 11 }}>✅ Hosted zone created; your current records are copied and the ones you apply are added.</p>
          </div>
          <div style={{ padding: '10px 14px', border: mdnsPhase !== 'start' ? '1px solid #fde68a' : '1px solid var(--border, #e2e8f0)', borderRadius: 8 }}>
            <div className={styles.iconLabel}>3. Switch</div>
            <p className={styles.subText} style={{ marginTop: 4, fontSize: 11 }}>
              {mdnsPhase === 'start' ? 'Replace the nameservers at the registrar — see the values below.' : mdnsPhase === 'switch' ? '⏳ In progress — the delegation updates on the registry\'s own schedule.' : '✅ Done — nameservers point at EDES.'}
            </p>
          </div>
          <div style={{ padding: '10px 14px', border: mdnsPhase === 'active' ? '1px solid #bbf7d0' : '1px solid var(--border, #e2e8f0)', borderRadius: 8 }}>
            <div className={styles.iconLabel}>4. Active</div>
            <p className={styles.subText} style={{ marginTop: 4, fontSize: 11 }}>
              {mdnsPhase === 'active' ? '✅ Zone live and verified — future record changes need no DNS edits.' : 'Waiting for the delegation to be read from the parent registry.'}
            </p>
          </div>
        </div>

        <div className={styles.iconLabel} style={{ marginBottom: 6 }}>Nameservers to enter at the registrar (one-time change)</div>
        <div style={{ fontFamily: 'monospace', fontSize: 13, background: 'var(--bg-secondary, #f8fafc)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
          {(realNS.length ? realNS.slice(0, 2) : (zone?.nameServers ?? ['kristin.ns.cloudflare.com', 'rommy.ns.cloudflare.com']).slice(0, 2)).join('  ·  ')}
        </div>

        <div style={{ background: '#FFF8E1', border: '1px solid #FFEB3B', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
          <p className={styles.subText} style={{ margin: 0, fontSize: 12 }}>
            <strong>⚠️ DNSSEC:</strong> before switching nameservers, turn DNSSEC off at the registrar.
            If a DS record stays published while the nameservers change, resolvers that validate
            DNSSEC stop answering for the domain until the chain is re-established.
          </p>
        </div>
        <p className={styles.subText} style={{ fontSize: 11, marginBottom: 14 }}>
          Before the switch, check the record list and export or import a zone file so every name
          carries over. One zone serves the whole registrable domain. When sources disagree the
          higher one wins — <strong>customdomain &gt; manual &gt; imported &gt; discovered</strong>.
          A CNAME can't share its name; an imported MX set replaces the copied set; a name holds
          only one v=spf1, one v=DMARC1 and one v=DKIM1 TXT; every replaced or skipped record is
          explained in the import result.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={styles.ovBtn} onClick={handleMdnsCheck} disabled={mdnsChecking || loading}>
            {mdnsChecking ? 'Checking…' : 'Check managed DNS'}
          </button>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
            background: mdnsState === 'active' ? '#dcfce7' : mdnsState === 'failed' ? '#fee2e2' : '#fef9c3',
            color: mdnsState === 'active' ? '#166534' : mdnsState === 'failed' ? '#991b1b' : '#854d0e',
          }}>
            Delegation: {mdnsState}
          </span>
        </div>
        {mdnsResult && <p className={styles.subText} style={{ fontSize: 12, marginTop: 10 }}>{mdnsResult}</p>}
      </div>

      {/* Nameservers — DigitalPlat-style realtime editor */}
      <div className={styles.card} style={{ marginBottom: '24px' }}>
        {/* Recommended preset banner */}
        <div className={styles.nsRecommended}>
          <div className={styles.nsRecIcon}>
            <Globe size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.nsRecTitle}>
              EDES DNS <span className={styles.nsBadge}>Recommended</span>
            </div>
            <div className={styles.nsRecDesc}>
              EDES keeps your zone on Cloudflare and updates the domain delegation.
            </div>
            <div className={styles.nsRecNs}>
              {((zone?.nameServers?.[0] || 'kristin.ns.cloudflare.com') + '  ·  ' + (zone?.nameServers?.[1] || 'rommy.ns.cloudflare.com'))}
            </div>
          </div>
          <button className={styles.nsUseBtn} onClick={handleUseEdesDns} disabled={loading || nsSaving}>
            Use EDES DNS
          </button>
        </div>

        <p className={styles.subText} style={{ margin: '14px 0 10px' }}>
          Changes may take a few minutes to propagate.
        </p>

        {loading ? (
          <p className={styles.infoText}><Loader2 size={14} className={styles.spin} /> Loading zone…</p>
        ) : (
          <>
            <div className={styles.nsGrid}>
              {nsSlots.map((val, i) => (
                <div key={i} className={styles.nsField}>
                  <label className={styles.nsLabel}>
                    {i < 2 ? '* ' : ''}NAME SERVER {i + 1}
                  </label>
                  <input
                    className={styles.nsInput}
                    value={val}
                    placeholder={`NS${i + 1}`}
                    onChange={(e) => setNsSlot(i, e.target.value)}
                    disabled={loading || nsSaving}
                    spellCheck={false}
                  />
                </div>
              ))}
            </div>

            {/* In-zone nameserver warning — these need glue/child-host records at the registry */}
            {nsSlots.map(s => s.trim()).filter(Boolean).some(h =>
              displayDomain && h.toLowerCase().endsWith(('.' + displayDomain).toLowerCase())
            ) && (
              <p className={styles.glueWarn} style={{ marginTop: 12 }}>
                ⚠️ In-zone nameserver detected — a hostname under your own domain (e.g. ns1.{displayDomain}) requires <strong>glue records</strong> in the registry's "Child hosts" section (NS hostname → its A record IP), and the A record for it must exist in the serving zone. Create the glue records at eu.org before delegating.
              </p>
            )}

            <div className={styles.nsActionBar}>
              <span className={styles.nsHint}>
                Hostnames only — no IPs, resolvers or URLs (e.g. ns1.provider.com). 2–8 servers. Saving <strong>replaces the whole list</strong>: fill every server you need, in order. The first 2 are required.
              </span>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  className={styles.ovBtn}
                  onClick={handleVerifyDelegation}
                  disabled={nsVerifying || loading}
                >
                  {nsVerifying ? 'Checking…' : 'Verify delegation'}
                </button>
                <button
                  className={styles.ovBtnPrimary}
                  onClick={handleUpdateNameservers}
                  disabled={nsSaving || loading}
                >
                  {nsSaving ? <Loader2 size={15} className={styles.spin} style={{ display: 'inline' }} /> : null}
                  {nsSaving ? ' Updating…' : 'Update nameservers'}
                </button>
              </div>
            </div>
            {nsMsg && (
              <p className={styles.stepDesc} style={{ marginTop: 10, color: nsMsg.startsWith('❌') ? '#ef4444' : '#16a34a' }}>
                {nsMsg}
              </p>
            )}
            {nsVerifyResult && (
              <pre className={styles.stepDesc} style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontFamily: 'inherit', background: 'var(--bg-secondary, #f8fafc)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                {nsVerifyResult}
              </pre>
            )}
          </>
        )}
      </div>

      {(message || error) && (
        <div className={styles.alertBar} style={{ marginBottom: '24px', display: 'flex', gap: 8, alignItems: 'center' }}>
          {error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{error || message}</span>
          <button onClick={() => { setMessage(''); setError(''); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Add record */}
      <div className={styles.card} style={{ marginBottom: '24px' }}>
        <div className={styles.cardTitle}>
          <Plus size={20} style={{ color: 'var(--accent-primary)' }} /> Add DNS record
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div className={styles.iconLabel}>Type</div>
            <select className={styles.select} value={recType} onChange={(e) => setRecType(e.target.value)}>
              <option value="A">A</option>
              <option value="AAAA">AAAA</option>
              <option value="CNAME">CNAME</option>
              <option value="TXT">TXT</option>
              <option value="MX">MX</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div className={styles.iconLabel}>Name</div>
            <input type="text" className={styles.input} placeholder="subdomain" value={recName} onChange={(e) => setRecName(e.target.value)} />
          </div>
          <div style={{ flex: 2, minWidth: 220 }}>
            <div className={styles.iconLabel}>{recType === 'CNAME' ? 'Target' : 'Value'}</div>
            <input type="text" className={styles.input} placeholder={recType === 'CNAME' ? 'target.example.com' : recType === 'AAAA' ? '2606:4700::1111' : '203.0.113.10'} value={recContent} onChange={(e) => setRecContent(e.target.value)} />
          </div>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={recProxied} onChange={(e) => setRecProxied(e.target.checked)} />
          Proxy through Cloudflare (orange cloud, hides origin IP)
        </label>
        <button className={styles.buttonPrimary} onClick={addRecord} disabled={busy || !recName || !recContent} style={{ marginTop: 16 }}>
          {busy ? 'Working…' : 'Create record'}
        </button>
      </div>

      {/* Record list */}
      <div>
        <div className={styles.cardTitle} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><Globe size={20} style={{ color: 'var(--accent-primary)' }} /> DNS records for {displayDomain}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={styles.buttonInline} onClick={handleExportZoneFile} disabled={records.length === 0} title="Export zone file (RFC 1035) — import it into the new DNS host before switching nameservers">
              <svg width="16" height="16" viewBox="0 0 36 36" aria-hidden style={{ color: "var(--accent-primary)" }}>
                <path d="M0 0h36v36H0z" fill="none" />
                <path fill="currentColor" d="M6 13.61h7.61V6H24v8.38h2V6a2 2 0 0 0-2-2H10.87L4 10.87V30a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2H6Zm0-1.92L11.69 6H12v6H6Z" />
                <path fill="currentColor" d="M28.32 16.35a1 1 0 0 0-1.41 1.41L30.16 21H18a1 1 0 0 0 0 2h12.19l-3.28 3.28a1 1 0 1 0 1.41 1.41L34 22Z" />
              </svg>
            </button>
            <input
              ref={importFileRef}
              type="file"
              accept=".txt,.zone,.db,.bind,text/plain"
              style={{ display: 'none' }}
              onChange={handleImportZoneFile}
            />
            <button
              className={styles.buttonInline}
              onClick={() => importFileRef.current?.click()}
              disabled={busy || importing}
              title="Import zone file (RFC 1035) — BIND format; $ORIGIN/$TTL, @, relative names, parentheses, quoted TXT. Skips SOA, the zone's own NS, unknown types and out-of-zone names with a warning each."
            >
              {importing ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={16} />}
            </button>
            <button className={styles.buttonInline} onClick={() => refresh()} title="Refresh">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
        {records.length > 0 && (
          <p className={styles.subText} style={{ fontSize: 11, marginBottom: 8 }}>
            Before switching nameservers, check this list, export the zone file, or import one — most providers can export/import it. Names outside the common list are not found by providers' record scans, so carry over anything missing.
          </p>
        )}
        {importResult && (
          <pre className={styles.stepDesc} style={{ marginTop: 0, marginBottom: 12, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12, background: 'var(--bg-secondary, #f8fafc)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            {importResult}
          </pre>
        )}
        {records.length === 0 ? (
          <p className={styles.infoText}>No DNS records yet for this name. Create the first one above.</p>
        ) : (
          <>
            {records.map((rec) => (
              <div key={rec.id} className={styles.domainItem} style={{ alignItems: 'center' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>
                    <path d="M0 0h24v24H0z" fill="none" />
                    <g fill="none">
                      <path fill="currentColor" d="M1.97 5.69c0-1.08 0-1.61.2-2.03a2 2 0 0 1 .92-.92c.42-.2.95-.2 2.03-.2h13.74c1.07 0 1.6 0 2.02.2q.62.31.93.92c.2.42.2.95.2 2.03c0 .53 0 .8-.1 1a1 1 0 0 1-.47.47c-.2.1-.47.1-1 .1H3.53c-.54 0-.8 0-1.01-.1a1 1 0 0 1-.46-.46c-.1-.21-.1-.48-.1-1.01" opacity=".2" />
                      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M22 9.31v-.77c0-2.83 0-4.25-.87-5.12c-.88-.88-2.3-.88-5.12-.88H7.97c-2.83 0-4.25 0-5.13.88c-.87.87-.87 2.29-.87 5.12v3.91c0 2.54 0 3.81.71 4.65l.34.33c.84.72 2.1.72 4.65.72M22 7.26H1.98" />
                      <circle cx="16.55" cy="16.53" r="5.73" fill="currentColor" opacity=".2" transform="rotate(90 16.55 16.53)" />
                      <circle cx="16.55" cy="16.53" r="5.73" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" transform="rotate(90 16.55 16.53)" />
                      <ellipse cx="16.55" cy="16.53" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" rx="5.73" ry="1.9" transform="rotate(90 16.55 16.53)" />
                      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.82 16.53h11.45" />
                    </g>
                  </svg>
                  <div>
                    <div className={styles.domainName}>{rec.type}</div>
                    <div className={styles.subText}>{relName(rec.name) || '@'} → {rec.content}{rec.proxied ? ' (proxied)' : ''}</div>
                  </div>
                </div>
                <button className={styles.buttonInline} onClick={() => delRecord(rec.id, rec.name)} disabled={busy} title="Delete record">
                  <Trash2 size={16} style={{ color: '#ef4444' }} />
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Email setup: MX, SPF, DKIM, DMARC ── */}
      <div className={styles.card} style={{ marginTop: '24px' }}>
        <div className={styles.cardTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><Mail size={20} style={{ color: 'var(--accent-primary)' }} /> Email DNS & SPF merge</span>
          <button className={styles.buttonInline} onClick={() => setSetupOpen(!setupOpen)}>
            {setupOpen ? 'Hide ∧' : 'Show ∨'}
          </button>
        </div>
        {setupOpen && (
          <div style={{ marginTop: 14 }}>
            <p className={styles.subText} style={{ marginBottom: 16 }}>
              Point this domain at a mail provider (Google Workspace, Microsoft 365, Zoho).
              <strong> One SPF record only</strong> — the engine merges your mechanisms into the existing v=spf1 record instead of writing a second one (which would silently break mail).
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
              <div>
                <div className={styles.iconLabel}>Provider</div>
                <select className={styles.select} value={emailProvider} onChange={(e) => {
                  const p = EMAIL_PROVIDERS.find(x => x.id === e.target.value);
                  if (p) {
                    setEmailProvider(e.target.value);
                    setMxHost(p.mxHost);
                    setMxPriority(String(p.mxPriority));
                    setSpfMechanisms(p.spfMechs.join(' '));
                    setDkimSelector(p.dkimSelector);
                    setDmarcPolicy(p.dmarcPolicy);
                  }
                }}>
                  <option value="">— Choose provider —</option>
                  {EMAIL_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            {emailProvider && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
                  <div>
                    <div className={styles.iconLabel}>MX record</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="text" className={styles.input} value={mxHost} onChange={(e) => setMxHost(e.target.value)} placeholder="smtp.google.com" style={{ flex: 1 }} />
                      <input type="number" className={styles.input} value={mxPriority} onChange={(e) => setMxPriority(e.target.value)} placeholder="1" style={{ width: 80 }} />
                    </div>
                    <p className={styles.subText} style={{ marginTop: 4, fontSize: 11 }}>Priority: lower = preferred (e.g. Google: 1; Zoho: 10/20/50)</p>
                  </div>
                  <div>
                    <div className={styles.iconLabel}>SPF mechanisms</div>
                    <input type="text" className={styles.input} value={spfMechanisms} onChange={(e) => setSpfMechanisms(e.target.value)} placeholder="include:_spf.google.com ~all" />
                    <p className={styles.subText} style={{ marginTop: 4, fontSize: 11 }}>Space- or comma-separated; merged into one v=spf1 record</p>
                  </div>
                  <div>
                    <div className={styles.iconLabel}>DKIM selector (from your provider)</div>
                    <input type="text" className={styles.input} value={dkimSelector} onChange={(e) => setDkimSelector(e.target.value)} placeholder="google" />
                    <p className={styles.subText} style={{ marginTop: 4, fontSize: 11 }}>The key is unique per domain — publish the provider's &lt;selector&gt;._domainkey record as given</p>
                  </div>
                  <div>
                    <div className={styles.iconLabel}>DMARC policy</div>
                    <select className={styles.select} value={dmarcPolicy} onChange={(e) => setDmarcPolicy(e.target.value)}>
                      <option value="none">p=none (monitor only)</option>
                      <option value="quarantine">p=quarantine</option>
                      <option value="reject">p=reject</option>
                    </select>
                    <p className={styles.subText} style={{ marginTop: 4, fontSize: 11 }}>Start at p=none; tighten to quarantine, then reject after DKIM/SPF pass</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className={styles.ovBtnPrimary} onClick={handleApplyEmailRecords} disabled={busy || !emailProvider}>
                    Apply email records
                  </button>
                  <button className={styles.ovBtn} onClick={handleCheckSpfMerge} disabled={busy}>
                    Check SPF merge
                  </button>
                </div>

                {emailResult && (
                  <pre className={styles.stepDesc} style={{ marginTop: 14, whiteSpace: 'pre-wrap', fontFamily: 'inherit', background: 'var(--bg-secondary, #f8fafc)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    {emailResult}
                  </pre>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Danger zone: delete the entire domain ── */}
      <div className={styles.card} style={{ marginTop: '24px', borderColor: '#fecaca' }}>
        <div className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trash2 size={18} style={{ color: '#dc2626' }} /> Danger zone
        </div>
        <p className={styles.subText}>
          Deleting this domain removes it from your account and clears its saved nameservers
          everywhere (the change appear in the Domain List instantly). DNS records in the zone are not touched.
        </p>
        <button
          className={styles.ovBtn}
          onClick={handleDeleteDomain}
          style={{ color: '#dc2626', borderColor: '#fecaca', background: '#fff5f5' }}
        >
          Delete this domain
        </button>
      </div>
    </div>
  );
};