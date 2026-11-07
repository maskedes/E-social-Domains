import React, { useEffect, useState, useCallback } from 'react';
import { collection, onSnapshot, query, where, doc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import { Globe, AlertCircle, CheckCircle2, Loader2, Plus, RefreshCw, Trash2, Mail, Download } from 'lucide-react';
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
      headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
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
  const [mdnsChecking, setMdnsChecking] = useState(false);
  const [mdnsPhase, setMdnsPhase] = useState<'start' | 'switch' | 'active'>('start');
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
      if (published.length && ours.length && published.every(p => ours.includes(p))) {
        setMdnsPhase('active');
        setMdnsResult(`✅ Active — the parent publishes our nameservers (${published.join(', ')}). The zone is live and verified; every record change from now on is written automatically.`);
      } else {
        setMdnsPhase('switch');
        setMdnsResult(
          published.length
            ? `⏳ Switching — the parent currently publishes: ${published.join(', ')}. Nothing changes for anyone until the nameservers are replaced at the registrar.`
            : `⏳ Switching — no delegation published yet (NXDOMAIN/NOANSWER). Nothing changes for anyone until the nameservers are replaced at the registrar.`
        );
      }
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
                  <div className={styles.stepTitle}>2. Connect a service</div>
                  <p className={styles.stepDesc}>
                    Have records from another provider? Configure DNS and paste them there.
                  </p>
                  <div className={styles.stepControl}>
                    <button className={styles.ovBtn} onClick={() => { document.querySelector('input[placeholder="subdomain"]')?.focus(); }}>
                      Configure DNS
                    </button>
                  </div>
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

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={styles.ovBtn} onClick={handleMdnsCheck} disabled={mdnsChecking || loading}>
            {mdnsChecking ? 'Checking…' : 'Check managed DNS'}
          </button>
          {mdnsResult && <span className={styles.subText} style={{ fontSize: 12 }}>{mdnsResult}</span>}
        </div>
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
      <div className={styles.card}>
        <div className={styles.cardTitle} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><Globe size={20} style={{ color: 'var(--accent-primary)' }} /> DNS records for {displayDomain}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={styles.buttonInline} onClick={handleExportZoneFile} disabled={records.length === 0} title="Export zone file (RFC 1035) — import it into the new DNS host before switching nameservers">
              <Download size={16} />
            </button>
            <button className={styles.buttonInline} onClick={() => refresh()} title="Refresh">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
        {records.length > 0 && (
          <p className={styles.subText} style={{ fontSize: 11, marginBottom: 8 }}>
            Before switching nameservers, check this list and export the zone file — most providers can import it. Names outside the common list are not found by providers' record scans, so carry over anything missing from the export.
          </p>
        )}
        {records.length === 0 ? (
          <p className={styles.infoText}>No DNS records yet for this name. Create the first one above.</p>
        ) : (
          <>
            {records.map((rec) => (
              <div key={rec.id} className={styles.domainItem} style={{ alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div className={styles.domainName}>{rec.type}</div>
                  <div className={styles.subText}>{relName(rec.name) || '@'} → {rec.content}{rec.proxied ? ' (proxied)' : ''}</div>
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