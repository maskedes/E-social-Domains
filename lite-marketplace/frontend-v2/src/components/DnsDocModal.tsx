import React from 'react';
import { X, Globe, ShieldCheck, Mail, ArrowRightLeft, FileText, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import s from './DnsDocModal.module.css';

export const DnsDocModal: React.FC<{
  onClose: () => void;
  enabled?: boolean;
  onToggle?: (v: boolean) => void;
  onUseEdesDns?: () => void;
}> = ({ onClose, enabled = true, onToggle, onUseEdesDns }) => {
  return (
    <div className={s.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="EDES DNS — panel and documentation">
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <div className={s.header}>
          <div className={s.headerTitle}>
            <span className={s.headerIcon}><Globe size={20} /></span>
            <div>
              <h2 className={s.title}>E-Domains — DNS</h2>
              <p className={s.subtitle}>Enable, disable and read how nameservers and the EDES DNS policy work.</p>
            </div>
          </div>
          <button className={s.closeBtn} onClick={onClose} aria-label="Close panel"><X size={18} /></button>
        </div>

        <div className={s.body}>
          {/* ── E-Domains DNS panel: enable/disable + apply + policies ── */}
          <section className={s.panelSection}>
            <div className={s.panelRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={enabled ? s.stateOn : s.stateOff}>{enabled ? <CheckCircle2 size={16} /> : <XCircle size={16} />}</span>
                <div>
                  <div className={s.panelTitle}>EDES DNS {enabled ? 'enabled' : 'disabled'}</div>
                  <div className={s.panelDesc}>EDES writes and keeps the records this domain needs.</div>
                </div>
              </div>
              <label className={s.toggleSmall} title={enabled ? 'Disable EDES DNS for this domain' : 'Enable EDES DNS for this domain'}>
                <input type="checkbox" checked={enabled} onChange={(e) => onToggle?.(e.target.checked)} />
                <span className={s.toggleSmallSlider} />
              </label>
            </div>
            <div className={s.panelActions}>
              <button className={s.applyBtn} onClick={() => onUseEdesDns?.()}>E-Domains DNS</button>
            </div>
            <ul className={s.panelPolicies}>
              <li><strong>One change, made once.</strong> EDES writes and maintains the records this domain needs — nothing platform-wide, nothing outside this domain.</li>
              <li><strong>Records stay put.</strong> Records you rely on are never removed; when sources disagree, your copy wins over what we can discover.</li>
              <li><strong>Drift is fixed automatically.</strong> Hand-edited or stale records we find are put back on the next check.</li>
              <li><strong>Propagation.</strong> Resolvers may serve old answers for up to ~48 hours — NXDOMAIN during that window is expected, not an outage.</li>
              <li><strong>DNSSEC.</strong> Turn DNSSEC <em>off</em> at the registrar <em>before</em> switching; residual DS records break validating resolvers.</li>
              <li><strong>Switch back anytime.</strong> To your old DNS host (records live ~7 days after the nameservers move) or your registrar&rsquo;s own DNS, which is always there.</li>
              <li><strong>No abuse.</strong> Spam or phishing may suspend the zone. <code>abuse@esocialzdomains.eu.org</code></li>
            </ul>
          </section>
          <section>
            <h3 className={s.h3}>1. What DNS is</h3>
            <p>DNS is the internet's address book. It translates a name like <code>example.com</code> into the data the rest of the internet needs: A/AAAA records point a name at servers, MX records tell senders where mail goes, TXT records carry proof tokens (SPF, DKIM, DMARC, verification keys), CNAME records alias one name to another, CAA restricts certificate issuers and SRV publishes service endpoints.</p>
            <p>A domain's <strong>DNS settings</strong> live in what's called a <strong>zone</strong>. Every record in the zone answers one kind of question about the name it covers.</p>
          </section>

          <section>
            <h3 className={s.h3}>2. Registrar vs nameservers vs DNS host</h3>
            <ul>
              <li><strong>Registrar</strong> — where the domain is registered and renewed (GoDaddy, Namecheap…). The registrar tells the registry which nameservers answer for the domain. A move <em>never</em> touches the registrar.</li>
              <li><strong>Nameservers</strong> — the one setting at the registrar that says who runs the domain's DNS. Changing this setting is the entire switch.</li>
              <li><strong>DNS host</strong> — whoever operates those nameservers and keeps the records correct (EDES does this for you via Cloudflare).</li>
            </ul>
            <p>A domain has two parts: where it is registered (paid for) and what keeps it working (its DNS). EDES DNS changes only the second part. The registration, the renewal date and the owner stay exactly as they were.</p>
          </section>

          <section>
            <h3 className={s.h3}>3. How the EDES DNS switch works</h3>
            <ol>
              <li><strong>Copy first.</strong> Your existing records are copied into the EDES zone before any nameserver changes. Nothing goes dark because of the copy.</li>
              <li><strong>One change at the registrar.</strong> You replace your nameservers with EDES's (the two names listed on this screen). This is the only registrar-side edit, one time.</li>
              <li><strong>Verification.</strong> EDES checks what the parent registry publishes and flips the zone to <em>active</em> as soon as the delegation points at our nameservers. Until then the zone is <em>awaiting delegation</em> — it holds your records but the internet still asks the old nameservers.</li>
            </ol>
          </section>

          <section>
            <h3 className={s.h3}>4. Records EDES manages for you</h3>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr><th>Type</th><th>Purpose</th><th>Example</th></tr>
                </thead>
                <tbody>
                  <tr><td>A</td><td>Points a name at an IPv4 address</td><td><code>203.0.113.10</code></td></tr>
                  <tr><td>AAAA</td><td>Points a name at an IPv6 address</td><td><code>2001:db8::1</code></td></tr>
                  <tr><td>CNAME</td><td>Aliases one name to another name</td><td><code>www → host.provider.net</code></td></tr>
                  <tr><td>MX</td><td>Tells senders where mail for the domain lands</td><td><code>10 mail.google.com</code></td></tr>
                  <tr><td>TXT</td><td>SPF, DKIM, DMARC, ownership &amp; verification tokens</td><td><code>v=spf1 … ~all</code></td></tr>
                  <tr><td>CAA</td><td>Restricts which CAs may issue certificates</td><td><code>0 issue "letsencrypt.org"</code></td></tr>
                  <tr><td>SRV</td><td>Publishes service endpoints (SIP, XMPP, etc.)</td><td><code>10 5 5060 sip.host.net</code></td></tr>
                  <tr><td>NS</td><td>Child nameservers for sub-delegations</td><td><code>ns1.provider.net</code></td></tr>
                </tbody>
              </table>
            </div>
            <p>One record per purpose: exactly one <code>v=spf1</code>, one <code>v=DMARC1</code>, one <code>v=DKIM1</code> per name. A CNAME can't share its name with any other record. Everything is kept correct automatically after the switch — or copied/restored from a zone file you import.</p>
          </section>

          <section>
            <h3 className={s.h3}>5. Propagation and caching</h3>
            <p>DNS answers are cached everywhere (resolvers, browsers, operating systems) for the length of the record's TTL. After you change nameservers, some of the internet keeps asking the old nameservers for up to ~48 hours. Nothing is broken while that happens — the registrar carries whichever delegation it has been told, and the zone is only served by one set of nameservers at a time.</p>
            <ul>
              <li>Our checks look at both the parent registry (NS) and the zone itself (SOA). The zone turns <em>active</em> once the parent publishes our nameservers.</li>
              <li>If the switch doesn't happen within <strong>14 days</strong> of the zone being created, the zone is marked <em>failed</em>. Failed zones keep being re-checked and flip to active automatically when the delegation appears.</li>
              <li>If the nameservers later moved away from ours, the zone is marked <em>failed</em> again and resumes checking twice a day.</li>
            </ul>
          </section>

          <section>
            <h3 className={s.h3}>6. DNSSEC — turn it off before you switch</h3>
            <p><AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />If a zone is signed and the DS record stays published at the registrar after the nameservers change, resolvers that validate DNSSEC stop answering for your domain. The fix is simple: <strong>disable DNSSEC at the registrar before switching nameservers</strong>. You can re-enable it after the delegation is live.</p>
          </section>

          <section>
            <h3 className={s.h3}>7. Email records</h3>
            <p><Mail size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />To receive mail, publish MX records <em>first</em>, then SPF/DKIM/DMARC to keep out of spam folders:</p>
            <ul>
              <li><code>SPF</code> — one TXT starting with <code>v=spf1</code>, listing your senders; end with <code>~all</code>.</li>
              <li><code>DKIM</code> — your provider gives you a selector and a public key; publish it as <code>&lt;selector&gt;._domainkey</code>.</li>
              <li><code>DMARC</code> — one TXT <code>v=DMARC1; p=none;</code> to start; tighten to <code>quarantine</code> then <code>reject</code> once SPF+DKIM pass.</li>
            </ul>
            <p>EDES writes these for you when you connect a provider — and merges your mechanisms into the existing <code>v=spf1</code> record instead of creating a second one.</p>
          </section>

          <section>
            <h3 className={s.h3}>8. Verification TXT records (WorkOS / Search Console / Bluesky)</h3>
            <p>To prove domain ownership to a service, EDES writes the exact value the service gives you, at exactly the name it expects:</p>
            <ul>
              <li><strong>WorkOS</strong> — <code>verification_token=…</code> at the domain (<code>@</code>).</li>
              <li><strong>Google Search Console</strong> — <code>google-site-verification=…</code> at <code>@</code>.</li>
              <li><strong>Bluesky</strong> — <code>did=…</code> at <code>_atproto.&lt;handle or domain&gt;</code>.</li>
            </ul>
            <p>Values are stored exactly as supplied — nothing at that name is removed. Verification completes when the service runs its own check; EDES DNS only publishes the record.</p>
          </section>

          <section>
            <h3 className={s.h3}>9. Switching back</h3>
            <p><ArrowRightLeft size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} /><strong>To your previous DNS host</strong> — while that host still answers for the domain. Most hosts keep a moved domain's records for ~7 days after the nameservers change.</p>
            <p><strong>To your registrar's own DNS</strong> — always available. The registrar ships a default nameservice with every registration; your records there will be whatever you (or the registrar) put in it.</p>
            <p>Switch back any time by changing the nameservers at the registrar. EDES DNS keeps the zone file as long as the domain is registered — nothing is deleted without you asking.</p>
          </section>

          <section>
            <h3 className={s.h3}>10. EDES DNS policy</h3>
            <ul>
              <li><strong>One change, made once.</strong> You authorize EDES to write and maintain the records this domain needs — nothing else, nothing outside this domain.</li>
              <li><strong>Records stay put.</strong> We never overwrite records your platform depends on without a matching rule; when sources disagree, your copy wins over what we can discover.</li>
              <li><strong>Correctness.</strong> Record drift (hand-edited zones, stale TTLs) is detected and fixed automatically.</li>
              <li><strong>Availability.</strong> EDES DNS runs on Cloudflare's edge (anycast, 100+ points of presence). Propagation of record changes is typically seconds to minutes at resolvers that don't aggressively cache.</li>
              <li><strong>Acceptable use.</strong> No spam, phishing, malware distribution, or unlawful content. Violations may suspend the zone.</li>
              <li><strong>Privacy.</strong> EDES queries your zone's records only to operate it. We do not sell ownership data and do not serve your records for advertising.</li>
              <li><strong>Support.</strong> Report a record you didn't expect at <code>abuse@esocialzdomains.eu.org</code> — we answer within one business day.</li>
            </ul>
          </section>

          <p className={s.footnote}><FileText size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />Last reviewed: November 2026. This page documents EDES DNS as operated for zones hosted on Cloudflare (kristin.ns.cloudflare.com / rommy.ns.cloudflare.com).</p>
        </div>
      </div>
    </div>
  );
};
