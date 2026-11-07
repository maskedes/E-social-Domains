import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import styles from './Screens.module.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../components/Toast';
import { Search, Loader2, Settings2, Download, Trash2 } from 'lucide-react';

interface DomainListProps {
  user: User | null;
  onOpenSettings?: (domain: string) => void;
}

export const DomainListScreen: React.FC<DomainListProps> = ({ user, onOpenSettings }) => {
  const { t } = useLanguage();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('');
  const [domains, setDomains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'domains'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDomains(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Delete a domain from the account — the onSnapshot listener above updates
  // the list in realtime (the row disappears without a reload).
  const handleDeleteDomain = async (d: { id: string; name: string }) => {
    const ok = await toast.confirm({
      title: 'Delete this domain?',
      message: `${d.name} will be removed from your account permanently. This cannot be undone.`,
      kind: 'danger',
      confirmLabel: 'Delete domain',
      icon: 'delete',
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'domains', d.id));
      try { localStorage.removeItem(`ns:${d.name}`); } catch { /* ignore */ }
      toast.deleted('Domain deleted', `${d.name} was removed from your account.`);
    } catch (e) {
      toast.error('Delete failed', (e as Error).message || 'Firestore rules may block deletes — allow delete on the domains collection in the Firebase console.');
    }
  };

  // ── Batch selection helpers ────────────────────────────────────────
  const toggleOne = (id: string) => setSelected(s => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAllVisible = () => {
    const ids = filteredDomains.map(d => d.id);
    if (ids.length === 0) return;
    const all = ids.every(id => selected.has(id));
    setSelected(all ? new Set() : new Set(ids));
  };
  const selectedDomains = domains.filter(d => selected.has(d.id));

  // Batch delete — removes every selected domain from the account
  const handleBatchDelete = async () => {
    if (selectedDomains.length === 0) return;
    const ok = await toast.confirm({
      title: `Delete ${selectedDomains.length} domain${selectedDomains.length > 1 ? 's' : ''}?`,
      message: `${selectedDomains.map(d => d.name).slice(0, 5).join(', ')}${selectedDomains.length > 5 ? '…' : ''} will be removed permanently. This cannot be undone.`,
      kind: 'danger',
      confirmLabel: 'Delete domains',
      icon: 'delete',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedDomains.map(d => deleteDoc(doc(db, 'domains', d.id))));
      selectedDomains.forEach(d => { try { localStorage.removeItem(`ns:${d.name}`); } catch { /* ignore */ } });
      toast.deleted('Domains deleted', `${selectedDomains.length} domain${selectedDomains.length > 1 ? 's were' : ' was'} removed from your account.`);
      setSelected(new Set());
    } catch (e) {
      toast.error('Batch delete failed', (e as Error).message || 'Firestore rules may block deletes — allow delete on the domains collection in the Firebase console.');
    }
  };

  // Batch lock — sets locked=true in Firestore (portable to transfer service)
  const handleBatchLock = async () => {
    if (selectedDomains.length === 0) return;
    try {
      await Promise.all(selectedDomains.map(d =>
        updateDoc(doc(db, 'domains', d.id), { locked: true, lockedAt: new Date().toISOString() })
      ));
      toast.updated('Domains locked', `${selectedDomains.length} domain${selectedDomains.length > 1 ? 's are' : ' is'} now transfer-locked.`);
      setSelected(new Set());
    } catch (e) {
      toast.error('Batch lock failed', (e as Error).message);
    }
  };

  // Batch WHOIS privacy — redact registrant details from public WHOIS
  const handleBatchPrivacy = async () => {
    if (selectedDomains.length === 0) return;
    try {
      await Promise.all(selectedDomains.map(d =>
        updateDoc(doc(db, 'domains', d.id), { whois_privacy: true, whois_privacy_at: new Date().toISOString() })
      ));
      toast.updated('WHOIS privacy enabled', `${selectedDomains.length} domain${selectedDomains.length > 1 ? 's are' : ' is'} now hidden from public WHOIS.`);
      setSelected(new Set());
    } catch (e) {
      toast.error('Batch WHOIS privacy failed', (e as Error).message);
    }
  };

  // Batch transfer — transfer requests must be initiated per-domain by the owner
  const handleBatchTransfer = () => {
    if (selectedDomains.length === 0) return;
    toast.saved('Transfer', `Open each domain's settings to start the transfer: ${selectedDomains.map(d => d.name).slice(0, 3).join(', ')}${selectedDomains.length > 3 ? '…' : ''}`);
  };

  // Batch export (selected only — complements the main Export CSV button)
  const handleBatchExportCsv = () => {
    if (selectedDomains.length === 0) return;
    const rows = [
      ['Domain', 'Status', 'Expiration date', 'Group/Tags'],
      ...selectedDomains.map(d => [
        d.name,
        d.status === 'failed' ? 'Failed' : 'Active',
        expDateOf(d)?.toLocaleDateString('en-US') ?? '—',
        (Array.isArray(d.tags) ? d.tags.join(' ') : (d.group || d.tags || '')) + '',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `edes-domains-selected-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMoreOpen(false);
  };

  // Open the settings of the first selected domain
  const handleBatchOpenSettings = () => {
    if (selectedDomains.length === 0) return;
    onOpenSettings?.(selectedDomains[0].name);
  };

  // Expiration date of a domain (null when unknown / permanent)
  const expDateOf = (d: any): Date | null => {
    if (!d.expiresAt) return null;
    const x = d.expiresAt.toDate?.() ?? d.expiresAt;
    const dt = x instanceof Date ? x : new Date(x);
    return isNaN(dt.getTime()) ? null : dt;
  };

  const groups = React.useMemo(
    () => Array.from(new Set(domains.map(d => (d.group || '').trim()).filter(Boolean))),
    [domains]
  );

  // ── Realtime filtering: every keystroke / dropdown change re-filters instantly ──
  const filteredDomains = React.useMemo(() => {
    const now = new Date();
    const days = (dt: Date) => (dt.getTime() - now.getTime()) / 86400000;
    const tag = tagFilter.trim().toLowerCase();
    return domains.filter(d => {
      // search
      if (searchTerm && !d.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      // status
      if (statusFilter === 'active' && d.status === 'failed') return false;
      if (statusFilter === 'failed' && d.status !== 'failed') return false;
      if (statusFilter === 'expired') {
        const dt = expDateOf(d);
        if (!dt || dt.getTime() >= now.getTime()) return false;
      }
      // expiration window
      if (expiryFilter !== 'all') {
        const dt = expDateOf(d);
        if (!dt) return false;                       // permanent domains fail date windows
        const dd = days(dt);
        if (dt.getTime() < now.getTime()) return false;          // already expired ≠ upcoming
        const limit = expiryFilter === '30' ? 30 : expiryFilter === '90' ? 90 : 365;
        if (dd > limit) return false;
      }
      // group
      if (groupFilter !== 'all' && ((d.group || '').trim() || 'Ungrouped') !== groupFilter
          && (d.group || '').trim() !== groupFilter) return false;
      // tag / labels & notes
      if (tag) {
        const hay = [
          ...(Array.isArray(d.tags) ? d.tags : []),
          d.notes || '',
          d.group || '',
        ].join(' ').toLowerCase();
        if (!hay.includes(tag)) return false;
      }
      return true;
    });
  }, [domains, searchTerm, statusFilter, expiryFilter, groupFilter, tagFilter]);

  // Export the currently filtered list as CSV (matches what's on screen)
  const handleExportCsv = () => {
    const rows = [
      ['Domain', 'Status', 'Expiration date', 'Renewal', 'DNS', 'Group/Tags', 'Notes'],
      ...filteredDomains.map(d => [
        d.name,
        d.status === 'failed' ? 'Failed' : 'Active',
        expDateOf(d)?.toLocaleDateString('en-US') ?? '—',
        d.renewal || 'Advance renewals use credits',
        d.dnsConfigured ? 'EDES DNS' : 'Not configured',
        (Array.isArray(d.tags) ? d.tags.join(' ') : (d.group || d.tags || '')) + '',
        d.notes || '',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `edes-domains-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.pageHeader}>
        <div className={styles.topBarLabel}>{t('domainManagement')}</div>
        <h1 className={styles.pageTitle}>{t('domainList')}</h1>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h2 className={styles.cardTitle}>{t('yourDomains')}</h2>
        <p className={styles.subText}>{t('manageSearchDomains')}</p>
      </div>

        {/* ── DigitalPlat-style filter toolbar (all realtime) ── */}
        <div className={styles.filterBar}>
          <div className={styles.filterRow}>
            <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 200 }}>
              <Search size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className={styles.nsInput}
                placeholder={t('searchDomains')}
                style={{ padding: '0 16px 0 44px' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select className={styles.nsInput} style={{ fontFamily: 'inherit', flex: '0 0 150px' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Status</option>
              <option value="active">Active</option>
              <option value="failed">Failed</option>
              <option value="expired">Expired</option>
            </select>
            <select className={styles.nsInput} style={{ fontFamily: 'inherit', flex: '0 0 180px' }} value={expiryFilter} onChange={(e) => setExpiryFilter(e.target.value)}>
              <option value="all">Expiration date</option>
              <option value="30">Next 30 days</option>
              <option value="90">Next 90 days</option>
              <option value="365">Next 12 months</option>
              <option value="expired">Expired</option>
            </select>
            <select className={styles.nsInput} style={{ fontFamily: 'inherit', flex: '0 0 150px' }} value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
              <option value="all">All groups</option>
              {groups.map(g => <option key={g} value={g}>{g}</option>)}
              {groups.includes('Ungrouped') ? null : <option value="Ungrouped">Ungrouped</option>}
            </select>
          </div>
          <div className={styles.filterRow} style={{ marginTop: 12 }}>
            <input
              type="text"
              className={styles.nsInput}
              style={{ fontFamily: 'inherit', flex: '0 0 200px' }}
              placeholder="Filter by tag"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            />
            <span className={styles.nsHint} style={{ marginLeft: 10 }}>
              Showing {filteredDomains.length} of {domains.length} domain{domains.length === 1 ? '' : 's'}
            </span>
            <div style={{ marginLeft: 'auto' }}>
              <button
                className={styles.ovBtn}
                onClick={handleExportCsv}
                title="Export the currently filtered list as CSV"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <Download size={15} /> Export CSV
              </button>
            </div>
          </div>
        </div>

        <div className={styles.domainTable}>
          {loading ? (
            <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
              <Loader2 className={styles.spin} />
            </div>
          ) : filteredDomains.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No domains found.
            </div>
          ) : (
            <>
              {/* Header row */}
              <div className={styles.domainTableHeader}>
                <div className={styles.dCheck}>
                  <input
                    type="checkbox"
                    aria-label={'Select all visible domains'}
                    checked={filteredDomains.length > 0 && filteredDomains.every(d => selected.has(d.id))}
                    onChange={toggleAllVisible}
                  />
                </div>
                <div className={styles.dNameHeader}>
                  Domains <span className={styles.dSortArrow} title="Sort">↑</span>
                </div>
                <div className={styles.dColStatus}>Status</div>
                <div className={styles.dColDate}>Expiration date</div>
                <div className={styles.dColRenewal}>Renewal</div>
                <div className={styles.dColDns}>DNS</div>
                <div className={styles.dColLabels}>Labels &amp; notes</div>
              </div>

              {/* Batch action bar — appears when ≥1 domain is selected */}
              {selectedDomains.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 0', borderBottom: '1px solid #cbd5e1', marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginRight: 4 }}>
                    {selectedDomains.length} selected
                  </span>
                  <button className={styles.ovBtn} style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={handleBatchTransfer} title="Initiate a transfer for every selected domain">
                    Transfer
                  </button>
                  <button className={styles.ovBtn} style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={handleBatchPrivacy} title="Enable WHOIS privacy (redact registrant details) on selected domains">
                    WHOIS privacy
                  </button>
                  <button className={styles.ovBtn} style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={handleBatchLock} title="Transfer-lock every selected domain">
                    Lock
                  </button>
                  <button className={styles.ovBtn} style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={handleBatchOpenSettings} title="Open settings for the first selected domain">
                    Open settings
                  </button>
                  <button className={styles.ovBtn} style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={handleBatchExportCsv} title="Export only the selected domains as CSV">
                    <Download size={13} style={{ marginRight: 4 }} /> Export
                  </button>
                  <div style={{ position: 'relative', marginLeft: 'auto' }}>
                    <button className={styles.ovBtn} style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={() => setMoreOpen(v => !v)} aria-expanded={moreOpen} aria-haspopup="menu">
                      More options ▾
                    </button>
                    {moreOpen && (
                      <div role="menu" style={{ position: 'absolute', top: '110%', right: 0, zIndex: 20, background: 'var(--bg-primary, #fff)', border: '1px solid #cbd5e1', borderRadius: 10, boxShadow: '0 6px 18px rgba(15, 23, 42, 0.12)', minWidth: 180, overflow: 'hidden' }}>
                        <button className={styles.dLabelsBtn} role="menuitem" onClick={() => { setMoreOpen(false); handleBatchOpenSettings(); }} style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, borderBottom: '1px solid #e2e8f0' }}>Open settings</button>
                        <button className={styles.dLabelsBtn} role="menuitem" onClick={() => { setMoreOpen(false); handleBatchExportCsv(); }} style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0 }}>Export selected</button>
                        <button className={styles.dLabelsBtn} role="menuitem" onClick={() => { setMoreOpen(false); setSelected(new Set()); }} style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0 }}>Clear selection</button>
                      </div>
                    )}
                  </div>
                  <button className={styles.ovBtnDanger ? styles.ovBtnDanger : styles.ovBtn} style={{ padding: '7px 12px', fontSize: 12.5, color: '#dc2626', borderColor: '#fecaca', background: '#fff5f5' }} onClick={handleBatchDelete} title="Delete every selected domain">
                    <Trash2 size={13} style={{ marginRight: 4 }} /> Delete
                  </button>
                </div>
              )}

              {/* Domain rows */}
              {filteredDomains.map((domain) => (
                <div key={domain.id} className={styles.domainRow}>
                  <div className={styles.dCheck}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${domain.name}`}
                      checked={selected.has(domain.id)}
                      onChange={() => toggleOne(domain.id)}
                    />
                  </div>
                  <div className={styles.dNameCell}>
                    <span
                      className={styles.dName}
                      title="Open DNS settings"
                      onClick={() => onOpenSettings?.(domain.name)}
                    >
                      {domain.name}
                    </span>
                    <span className={styles.dSub}>{domain.registrar || 'EDES domain'}</span>
                  </div>
                  <div className={styles.dColStatus}>
                    <span className={`${styles.badge} ${domain.status === 'failed' ? '' : styles.badgeSuccess}`}>
                      {domain.status === 'failed' ? 'Failed' : 'Active'}
                    </span>
                  </div>
                  <div className={styles.dColDate}>
                    {domain.expiresAt
                      ? new Date(domain.expiresAt.toDate?.() ?? domain.expiresAt).toLocaleDateString('en-US')
                      : '—'}
                  </div>
                  <div className={styles.dColRenewal}>
                    {domain.renewal || 'Advance renewals use credits'}
                  </div>
                  <div className={styles.dColDns}>
                    {domain.dnsConfigured
                      ? <span className={styles.dDnsConfigured}>EDES DNS</span>
                      : 'Not configured'}
                  </div>
                  <div className={styles.dColLabels}>
                    <button
                      className={styles.dLabelsBtn}
                      title={domain.notes || 'No labels or notes'}
                    >
                      <Settings2 size={15} /> Labels &amp; notes
                    </button>
                    <button
                      className={styles.dLabelsBtn}
                      onClick={() => handleDeleteDomain(domain)}
                      disabled={loading}
                      title="Delete this domain"
                      style={{ color: '#dc2626', borderColor: '#fecaca' }}
                    >
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {filteredDomains.length > 0 && (
          <div className={styles.pagination}>
            <button className={styles.pageBtn}>1</button>
          </div>
        )}
    </div>
  );
};
