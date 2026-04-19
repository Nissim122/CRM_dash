import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Card, Text, Heading, Flex, Table, Badge, Callout } from '@radix-ui/themes';
import { globalConfig } from '@airtable/blocks';
import { useGlobalConfig } from '@airtable/blocks/ui';
import RevenueBarChart from './RevenueBarChart';

function getSelectChoices(field) {
  return field?.options?.choices?.map((c) => c.name) ?? [];
}

const PRESETS_KEY = 'filterPresets_customers';
const MAX_TEXT_LENGTH = 2000;

function getPeriodStart(period) {
  if (period === 'all') return new Date(0);
  const now = new Date();
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(now.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'year') return new Date(now.getFullYear(), 0, 1);
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

const CARD_META = {
  total:   { color: '#6366f1', icon: '👥' },
  revenue: { color: '#f59e0b', icon: '💰' },
  sales:   { color: '#10b981', icon: '🛒' },
};

const PERIOD_LABEL = { week: 'השבוע', month: 'החודש', year: 'השנה', all: 'תמיד' };

const EMPTY_FILTERS = { search: '', minRevenue: '', projectStatus: '', leadSource: '' };

export default function CustomersView({
  customersRecords, customersFields, customersTable,
  salesRecords, salesFields,
  leadsRecords, leadsFields,
  paymentsRecords, paymentsFields,
  period,
}) {
  const [salesModal,     setSalesModal]     = useState(null);
  const [showFilters,    setShowFilters]    = useState(false);
  const [filters,        setFilters]        = useState(EMPTY_FILTERS);
  const [showSaveInput,  setShowSaveInput]  = useState(false);
  const [presetName,     setPresetName]     = useState('');

  const [expandedRow,     setExpandedRow]     = useState(null);
  const [draftValues,     setDraftValues]     = useState({});
  const [origValues,      setOrigValues]      = useState({});
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [saveError,       setSaveError]       = useState(null);
  const [activePresetId,  setActivePresetId]  = useState(null);

  const expandedPanelRef = useRef(null);
  const pencilBtnRefs    = useRef({});
  const isSavingRef      = useRef(false);
  const draftRef         = useRef(draftValues);
  const origRef          = useRef(origValues);
  const expandedRowRef   = useRef(expandedRow);

  const salesById = useMemo(
    () => new Map((salesRecords ?? []).map((r) => [r.id, r])),
    [salesRecords]
  );

  const paymentsBySaleId = useMemo(() => {
    const map = new Map();
    if (!paymentsFields?.projectLink) return map;
    for (const p of paymentsRecords) {
      const links = p.getCellValue(paymentsFields.projectLink) || [];
      for (const link of links) {
        if (!map.has(link.id)) map.set(link.id, []);
        map.get(link.id).push(p);
      }
    }
    return map;
  }, [paymentsRecords, paymentsFields]);

  useEffect(() => { draftRef.current       = draftValues; }, [draftValues]);
  useEffect(() => { origRef.current        = origValues;  }, [origValues]);
  useEffect(() => { expandedRowRef.current = expandedRow; }, [expandedRow]);

  useEffect(() => {
    if (!expandedRow || showSaveConfirm) return;
    function handleDocMouseDown(e) {
      if (isSavingRef.current) return;
      const panel = expandedPanelRef.current;
      if (panel && panel.contains(e.target)) return;
      const changed = JSON.stringify(draftRef.current) !== JSON.stringify(origRef.current);
      if (changed) setShowSaveConfirm(true);
      else closeExpand();
    }
    document.addEventListener('mousedown', handleDocMouseDown);
    return () => document.removeEventListener('mousedown', handleDocMouseDown);
  }, [expandedRow, showSaveConfirm]);

  useEffect(() => {
    if (!salesModal) return;
    function handleKey(e) { if (e.key === 'Escape') setSalesModal(null); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [salesModal]);

  function openSalesModal(record) {
    const leadLinks  = customersFields.lead  ? record.getCellValue(customersFields.lead)  : null;
    const salesLinks = customersFields.sales ? record.getCellValue(customersFields.sales) : null;
    const customerName = leadLinks?.[0]?.name ?? '—';
    const saleIds = new Set((salesLinks ?? []).map((s) => s.id));

    const salesData = salesRecords
      .filter((s) => saleIds.has(s.id))
      .map((s) => {
        const dateRaw = salesFields.date ? s.getCellValue(salesFields.date) : null;
        const dateStr = dateRaw
          ? new Date(dateRaw).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })
          : '—';

        const productsRaw = salesFields.products ? s.getCellValue(salesFields.products) : null;
        const productsStr = Array.isArray(productsRaw) ? productsRaw.map((p) => p.name).join(', ') : '—';

        const totalDeal = salesFields.totalDeal ? (Number(s.getCellValue(salesFields.totalDeal)) || 0) : 0;
        const totalPaid = salesFields.totalPaid ? (Number(s.getCellValue(salesFields.totalPaid)) || 0) : 0;
        const balance   = salesFields.balance   ? (Number(s.getCellValue(salesFields.balance))   || 0) : 0;
        const fpRaw     = salesFields.fullyPaid  ?  s.getCellValue(salesFields.fullyPaid)              : null;
        const fullyPaid = fpRaw === true || fpRaw === '✅' || fpRaw === 1;

        const salePayments = (paymentsFields?.projectLink ? (paymentsBySaleId.get(s.id) ?? []) : [])
          .sort((a, b) => {
            const na = paymentsFields.paymentNumber ? Number(a.getCellValue(paymentsFields.paymentNumber) ?? 0) : 0;
            const nb = paymentsFields.paymentNumber ? Number(b.getCellValue(paymentsFields.paymentNumber) ?? 0) : 0;
            return na - nb;
          })
          .map((p) => {
            const num    = paymentsFields.paymentNumber ? String(p.getCellValue(paymentsFields.paymentNumber) ?? '—') : '—';
            const amt    = paymentsFields.amount   ? (p.getCellValue(paymentsFields.amount) ?? 0) : 0;
            const st     = paymentsFields.status   ? p.getCellValue(paymentsFields.status)?.name ?? '—' : '—';
            const due    = paymentsFields.dueDate  ? p.getCellValue(paymentsFields.dueDate) : null;
            const dueStr = due
              ? new Date(due).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })
              : '—';
            return { num, amount: amt, status: st, dueDate: dueStr };
          });

        return { id: s.id, date: dateStr, products: productsStr, totalDeal, totalPaid, balance, fullyPaid, payments: salePayments };
      });

    setSalesModal({ customerName, salesData });
  }

  const gConfig = useGlobalConfig();
  const presets  = gConfig.get(PRESETS_KEY) ?? [];

  const activeFilterCount = (filters.search ? 1 : 0) + (filters.minRevenue ? 1 : 0)
    + (filters.projectStatus ? 1 : 0) + (filters.leadSource ? 1 : 0);

  function setFilter(key, val) { setActivePresetId(null); setFilters((f) => ({ ...f, [key]: val })); }
  function resetFilters()      { setActivePresetId(null); setFilters(EMPTY_FILTERS); }

  async function savePreset() {
    const name = presetName.trim();
    if (!name) return;
    const entry = { id: String(Date.now()), name, filters: { ...filters } };
    await globalConfig.setAsync(PRESETS_KEY, [...presets, entry]);
    setPresetName('');
    setShowSaveInput(false);
  }

  async function deletePreset(id) {
    await globalConfig.setAsync(PRESETS_KEY, presets.filter((p) => p.id !== id));
  }

  function applyPreset(preset) {
    setFilters(preset.filters);
    setActivePresetId(preset.id);
    setShowFilters(false);
  }

  const projectStatusChoices = useMemo(
    () => getSelectChoices(customersFields.projectStatus),
    [customersFields.projectStatus]
  );

  const leadSourceChoices = useMemo(
    () => getSelectChoices(leadsFields?.leadSource),
    [leadsFields?.leadSource]
  );

  function getDraftInitial(record) {
    return {
      projectStatus: customersFields.projectStatus
        ? (record.getCellValue(customersFields.projectStatus)?.name ?? null)
        : null,
      notes: customersFields.notes
        ? (record.getCellValue(customersFields.notes) ?? '')
        : '',
    };
  }

  function openExpand(record) {
    const initial = getDraftInitial(record);
    setExpandedRow(record.id);
    setDraftValues(initial);
    setOrigValues(initial);
    setShowSaveConfirm(false);
  }

  function closeExpand() {
    setExpandedRow(null);
    setDraftValues({});
    setOrigValues({});
    setShowSaveConfirm(false);
    isSavingRef.current = false;
  }

  async function saveExpandedRecord() {
    const currentId = expandedRowRef.current;
    const record = customersRecords.find((r) => r.id === currentId);
    if (!record) { closeExpand(); return; }
    isSavingRef.current = true;

    const draft = draftRef.current;
    const orig  = origRef.current;
    const updates = {};

    if (customersFields.projectStatus && draft.projectStatus !== orig.projectStatus) {
      updates[customersFields.projectStatus.id] = draft.projectStatus ? { name: draft.projectStatus } : null;
    }
    if (customersFields.notes && draft.notes !== orig.notes) {
      updates[customersFields.notes.id] = (draft.notes || '').trim().slice(0, MAX_TEXT_LENGTH);
    }

    if (Object.keys(updates).length > 0) {
      try {
        setSaveError(null);
        await customersTable.updateRecordAsync(record, updates);
      } catch {
        setSaveError('שגיאה בשמירה — בדוק הרשאות');
        isSavingRef.current = false;
        return;
      }
    }
    closeExpand();
  }

  function handlePencilClick(record) {
    if (expandedRow === record.id) {
      isSavingRef.current = true;
      saveExpandedRecord();
    } else {
      openExpand(record);
    }
  }

  function handlePanelKeyDown(e) {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      isSavingRef.current = true;
      saveExpandedRecord();
    }
    if (e.key === 'Escape') {
      const changed = JSON.stringify(draftRef.current) !== JSON.stringify(origRef.current);
      if (changed) setShowSaveConfirm(true);
      else closeExpand();
    }
  }

  function setDraft(key, val) {
    setDraftValues((prev) => ({ ...prev, [key]: val }));
  }

  const stats = useMemo(() => {
    const startDate = getPeriodStart(period);
    let revenueInPeriod = 0;
    let salesInPeriod = 0;

    for (const record of salesRecords) {
      const dateRaw = salesFields.date ? record.getCellValue(salesFields.date) : null;
      if (!dateRaw || new Date(dateRaw) < startDate) continue;
      salesInPeriod++;
    }

    for (const p of (paymentsRecords ?? [])) {
      const st = paymentsFields?.status ? p.getCellValue(paymentsFields.status) : null;
      if (!st || st.name !== 'שולם בפועל') continue;
      const dateRaw = paymentsFields?.dueDate ? p.getCellValue(paymentsFields.dueDate) : null;
      if (!dateRaw || new Date(dateRaw) < startDate) continue;
      revenueInPeriod += paymentsFields?.amount ? (p.getCellValue(paymentsFields.amount) ?? 0) : 0;
    }

    const leadsMap = new Map((leadsRecords ?? []).map((r) => [r.id, r]));
    let customersInPeriod = 0;
    for (const record of customersRecords) {
      const leadLinks = customersFields.lead ? record.getCellValue(customersFields.lead) : null;
      const leadRec = leadsMap.get(leadLinks?.[0]?.id);
      if (!leadRec) continue;
      const createdRaw = leadsFields?.createdTime
        ? leadRec.getCellValue(leadsFields.createdTime)
        : leadRec.createdTime;
      if (!createdRaw || new Date(createdRaw) < startDate) continue;
      customersInPeriod++;
    }

    return { total: customersRecords.length, customersInPeriod, revenueInPeriod, salesInPeriod };
  }, [customersRecords, customersFields, salesRecords, salesFields, paymentsRecords, paymentsFields, leadsRecords, leadsFields, period]);

  const periodLabel = PERIOD_LABEL[period];

  const leadsById = useMemo(() => {
    const map = new Map();
    for (const r of (leadsRecords ?? [])) map.set(r.id, r);
    return map;
  }, [leadsRecords]);

  const revenueByCustomer = useMemo(() => {
    const map = new Map();
    for (const record of customersRecords) {
      const salesLinks = customersFields.sales ? record.getCellValue(customersFields.sales) : null;
      const total = (salesLinks ?? []).reduce((sum, link) => {
        const sale = salesById.get(link.id);
        const v = sale && salesFields.totalPaid ? sale.getCellValue(salesFields.totalPaid) : 0;
        return sum + (Number(v) || 0);
      }, 0);
      map.set(record.id, total);
    }
    return map;
  }, [customersRecords, customersFields, salesById, salesFields]);

  const filteredCustomers = useMemo(() => {
    let base = customersRecords;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      base = base.filter((r) => {
        const leadLinks = customersFields.lead ? r.getCellValue(customersFields.lead) : null;
        const name = leadLinks?.[0]?.name ?? '';
        return name.toLowerCase().includes(q);
      });
    }
    if (filters.minRevenue) {
      const min = Number(filters.minRevenue);
      base = base.filter((r) => (revenueByCustomer.get(r.id) ?? 0) >= min);
    }
    if (filters.projectStatus) {
      base = base.filter((r) => {
        const status = customersFields.projectStatus
          ? r.getCellValue(customersFields.projectStatus)?.name ?? ''
          : '';
        return status === filters.projectStatus;
      });
    }
    if (filters.leadSource) {
      base = base.filter((r) => {
        const leadLinks = customersFields.lead ? r.getCellValue(customersFields.lead) : null;
        const leadRec = leadLinks?.[0] ? leadsById.get(leadLinks[0].id) : null;
        const source = leadRec && leadsFields?.leadSource
          ? leadRec.getCellValue(leadsFields.leadSource)?.name ?? ''
          : '';
        return source === filters.leadSource;
      });
    }
    return base;
  }, [customersRecords, customersFields, filters, revenueByCustomer, leadsById, leadsFields]);

  const colCount = 7
    + (customersFields.projectStatus ? 1 : 0)
    + (customersFields.notes         ? 1 : 0)
    + (customersFields.contract      ? 1 : 0)
    + 1; // pencil column

  const cards = [
    { id: 'total',   label: `סה"כ לקוחות ${periodLabel}`, value: stats.customersInPeriod },
    { id: 'revenue', label: `הכנסות ${periodLabel}`,       value: `₪${stats.revenueInPeriod.toLocaleString('he-IL')}` },
    { id: 'sales',   label: `מכירות ${periodLabel}`,       value: stats.salesInPeriod },
  ];

  return (
    <>
      <div className="kpi-bar">
        {cards.map(({ id, label, value }) => {
          const { color, icon } = CARD_META[id];
          return (
            <Card key={id} className="kpi-card" style={{ borderTop: `3px solid ${color}` }}>
              <Flex direction="column" align="end" gap="1">
                <Text size="4">{icon}</Text>
                <Heading size="7" style={{ color, lineHeight: 1 }}>{value}</Heading>
                <Text size="1" color="gray">{label}</Text>
              </Flex>
            </Card>
          );
        })}
      </div>

      <div className="analytics-row">
        <RevenueBarChart salesRecords={salesRecords} salesFields={salesFields} paymentsRecords={paymentsRecords ?? []} paymentsFields={paymentsFields} period={period} />
      </div>

      <div className="ops-layout">
      <div className="ops-section">
        <Flex justify="between" align="center" mb="3">
          <Text size="4" weight="bold">רשימת לקוחות</Text>
          <Flex gap="2" align="center">
            <button
              className={`filter-toggle-btn${showFilters ? ' filter-toggle-btn--active' : ''}`}
              onClick={() => setShowFilters((v) => !v)}
            >
              סינון{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>
            {activeFilterCount > 0 && (
              <button className="filter-reset-btn" onClick={resetFilters}>נקה הכל</button>
            )}
          </Flex>
        </Flex>


        {showFilters && (
          <div className="filter-panel">
            <div className="filter-group filter-group--wide">
              <span className="filter-label">חיפוש לפי שם</span>
              <input
                type="text"
                placeholder="שם לקוח…"
                value={filters.search}
                onChange={(e) => setFilter('search', e.target.value)}
                className="filter-number-input"
                style={{ width: '100%' }}
              />
            </div>
            <div className="filter-group">
              <span className="filter-label">הכנסות מינ׳ (₪)</span>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={filters.minRevenue}
                onChange={(e) => setFilter('minRevenue', e.target.value)}
                className="filter-number-input"
              />
            </div>
            {projectStatusChoices.length > 0 && (
              <div className="filter-group">
                <span className="filter-label">סטטוס פרוייקט</span>
                <select
                  className="filter-number-input"
                  value={filters.projectStatus}
                  onChange={(e) => setFilter('projectStatus', e.target.value)}
                >
                  <option value="">הכל</option>
                  {projectStatusChoices.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            {leadSourceChoices.length > 0 && (
              <div className="filter-group">
                <span className="filter-label">מקור ליד</span>
                <select
                  className="filter-number-input"
                  value={filters.leadSource}
                  onChange={(e) => setFilter('leadSource', e.target.value)}
                >
                  <option value="">הכל</option>
                  {leadSourceChoices.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            <div className="filter-save-row">
              {showSaveInput ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    className="filter-save-input"
                    placeholder="שם התבנית…"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') savePreset();
                      if (e.key === 'Escape') { setShowSaveInput(false); setPresetName(''); }
                    }}
                    maxLength={40}
                  />
                  <button className="filter-chip filter-chip--active" onClick={savePreset}>שמור</button>
                  <button className="filter-reset-btn" onClick={() => { setShowSaveInput(false); setPresetName(''); }}>ביטול</button>
                </>
              ) : (
                <button className="filter-chip" onClick={() => setShowSaveInput(true)}>+ שמור תבנית</button>
              )}
            </div>
          </div>
        )}

        {saveError && (
          <Callout.Root color="red" mb="3" role="alert">
            <Callout.Text>{saveError}</Callout.Text>
          </Callout.Root>
        )}

        <div className="table-wrapper">
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>מכירות</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>סה"כ הכנסות</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>יתרה לגבייה</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>שולם?</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>תאריך יצירה</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>מקור ליד</Table.ColumnHeaderCell>
                {customersFields.projectStatus && (
                  <Table.ColumnHeaderCell>סטטוס פרוייקט</Table.ColumnHeaderCell>
                )}
                {customersFields.notes && (
                  <Table.ColumnHeaderCell>הערות</Table.ColumnHeaderCell>
                )}
                {customersFields.contract && (
                  <Table.ColumnHeaderCell>חוזה</Table.ColumnHeaderCell>
                )}
                <Table.ColumnHeaderCell>שם לקוח</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell style={{ width: 36 }}></Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filteredCustomers.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={colCount}>
                    <Text color="gray" align="center" style={{ display: 'block', padding: '24px' }}>
                      אין לקוחות להצגה
                    </Text>
                  </Table.Cell>
                </Table.Row>
              )}
              {filteredCustomers.map((record) => {
                const isExpanded = expandedRow === record.id;

                const leadLinks  = customersFields.lead  ? record.getCellValue(customersFields.lead)  : null;
                const salesLinks = customersFields.sales ? record.getCellValue(customersFields.sales) : null;
                const totalRaw   = revenueByCustomer.get(record.id);

                const name       = leadLinks?.[0]?.name ?? '—';
                const salesCount = Array.isArray(salesLinks) ? salesLinks.length : 0;
                const totalStr   = totalRaw ? `₪${totalRaw.toLocaleString('he-IL')}` : '—';

                const leadRecord = leadLinks?.[0] ? leadsById.get(leadLinks[0].id) : null;
                const leadSource = leadRecord && leadsFields?.leadSource
                  ? leadRecord.getCellValue(leadsFields.leadSource)?.name ?? '—'
                  : '—';
                const createdRaw = leadRecord && leadsFields?.createdTime
                  ? leadRecord.getCellValue(leadsFields.createdTime)
                  : null;
                const createdStr = createdRaw
                  ? new Date(createdRaw).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })
                  : '—';

                const projectStatus = customersFields.projectStatus
                  ? record.getCellValue(customersFields.projectStatus)?.name ?? null
                  : null;
                const notes = customersFields.notes
                  ? record.getCellValue(customersFields.notes) ?? ''
                  : '';

                return (
                  <Table.Row
                    key={record.id}
                    ref={isExpanded ? expandedPanelRef : null}
                    onKeyDown={isExpanded ? handlePanelKeyDown : undefined}
                    style={isExpanded
                      ? { background: 'var(--indigo-a2)', outline: '2px solid var(--indigo-7)', outlineOffset: '-1px' }
                      : {}}
                  >
                    {/* מכירות */}
                    <Table.Cell>
                      <button
                        className="interactions-count-btn"
                        onClick={() => openSalesModal(record)}
                        disabled={salesCount === 0}
                        style={salesCount === 0 ? { opacity: 0.4, cursor: 'default' } : {}}
                      >
                        {salesCount}
                      </button>
                    </Table.Cell>

                    {/* סה"כ הכנסות */}
                    <Table.Cell>
                      <Text color="amber" weight="bold">{totalStr}</Text>
                    </Table.Cell>

                    {/* יתרה לגבייה */}
                    <Table.Cell>
                      {(() => {
                        const links = Array.isArray(salesLinks) ? salesLinks : [];
                        const bal = links.reduce((sum, link) => {
                          const sale = salesById.get(link.id);
                          const v = sale && salesFields.balance ? sale.getCellValue(salesFields.balance) : 0;
                          return sum + (Number(v) || 0);
                        }, 0);
                        return bal > 0
                          ? <Text style={{ color: 'var(--red-11)', fontWeight: 600 }}>₪{bal.toLocaleString('he-IL')}</Text>
                          : <Text color="gray">—</Text>;
                      })()}
                    </Table.Cell>

                    {/* שולם במלואו? */}
                    <Table.Cell style={{ textAlign: 'center' }}>
                      {(() => {
                        const links = Array.isArray(salesLinks) ? salesLinks : [];
                        if (links.length === 0) return <Text color="gray">—</Text>;
                        const allPaid = links.every((link) => {
                          const sale = salesById.get(link.id);
                          if (!sale || !salesFields.fullyPaid) return false;
                          const fp = sale.getCellValue(salesFields.fullyPaid);
                          return fp === true || fp === '✅' || fp === 1;
                        });
                        return allPaid
                          ? <Text>✅</Text>
                          : <Text color="gray" size="1">–</Text>;
                      })()}
                    </Table.Cell>

                    {/* תאריך יצירה */}
                    <Table.Cell>
                      <Text color="gray" size="1" style={{ whiteSpace: 'nowrap' }}>{createdStr}</Text>
                    </Table.Cell>

                    {/* מקור ליד */}
                    <Table.Cell>
                      <Text size="2">{leadSource}</Text>
                    </Table.Cell>

                    {/* סטטוס פרוייקט */}
                    {customersFields.projectStatus && (
                      <Table.Cell>
                        {isExpanded && projectStatusChoices.length > 0 ? (
                          <select
                            className="cell-edit-select"
                            value={draftValues.projectStatus || ''}
                            onChange={(e) => setDraft('projectStatus', e.target.value || null)}
                          >
                            <option value="">—</option>
                            {projectStatusChoices.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          projectStatus
                            ? <Badge color="gray" variant="soft">{projectStatus}</Badge>
                            : <Text color="gray" size="2">—</Text>
                        )}
                      </Table.Cell>
                    )}

                    {/* הערות */}
                    {customersFields.notes && (
                      <Table.Cell>
                        {isExpanded ? (
                          <textarea
                            className="cell-edit-textarea"
                            value={draftValues.notes ?? ''}
                            onChange={(e) => setDraft('notes', e.target.value)}
                            rows={2}
                            maxLength={MAX_TEXT_LENGTH}
                            placeholder="הערות ללקוח…"
                          />
                        ) : (
                          <Text
                            color={notes ? undefined : 'gray'}
                            style={{ fontStyle: notes ? 'normal' : 'italic', fontSize: '0.82rem' }}
                          >
                            {notes || '—'}
                          </Text>
                        )}
                      </Table.Cell>
                    )}

                    {/* חוזה */}
                    {customersFields.contract && (() => {
                      const attachments = record.getCellValue(customersFields.contract);
                      const first = Array.isArray(attachments) ? attachments[0] : null;
                      return (
                        <Table.Cell>
                          {first ? (
                            <a
                              href={first.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="contract-link"
                              title={first.filename}
                            >
                              📄 {attachments.length > 1 ? `${attachments.length} קבצים` : 'פתח'}
                            </a>
                          ) : (
                            <Text color="gray" size="1">—</Text>
                          )}
                        </Table.Cell>
                      );
                    })()}

                    {/* שם לקוח */}
                    <Table.Cell>
                      <Text>{name}</Text>
                    </Table.Cell>

                    {/* עריכה */}
                    <Table.Cell>
                      {isExpanded ? (
                        <Flex direction="column" gap="1" align="center">
                          <button
                            className="row-edit-btn row-edit-btn--save-inline"
                            onClick={() => { isSavingRef.current = true; saveExpandedRecord(); }}
                            title="שמור שינויים"
                          >✓</button>
                          <button
                            className="row-edit-btn row-edit-btn--cancel-inline"
                            onClick={closeExpand}
                            title="בטל"
                          >✕</button>
                        </Flex>
                      ) : (
                        <button
                          ref={(el) => { pencilBtnRefs.current[record.id] = el; }}
                          className="row-edit-btn"
                          onClick={() => handlePencilClick(record)}
                          title="ערוך שורה"
                        >✏</button>
                      )}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </div>
      </div>

      {presets.length > 0 && (
        <aside className="presets-sidebar">
          <div className="presets-sidebar__title">תבניות שמורות</div>
          {presets.map((p) => (
            <div key={p.id} className="presets-sidebar__item">
              <button
                className={`presets-sidebar__apply${activePresetId === p.id ? ' presets-sidebar__apply--active' : ''}`}
                onClick={() => applyPreset(p)}
                title={`החל: ${p.name}`}
              >
                {p.name}
              </button>
              <button
                className="presets-sidebar__delete"
                onClick={() => deletePreset(p.id)}
                title="מחק תבנית"
              >×</button>
            </div>
          ))}
        </aside>
      )}

      {/* Sales modal */}
      {salesModal && (
        <div className="interactions-overlay" onClick={() => setSalesModal(null)}>
          <div
            className="interactions-modal"
            style={{ width: 640, maxHeight: 600 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="interactions-modal__header">
              <button className="interactions-modal__close" onClick={() => setSalesModal(null)}>×</button>
              <span className="interactions-modal__title">מכירות — {salesModal.customerName}</span>
            </div>
            <div className="interactions-modal__body">
              {salesModal.salesData.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-9)', fontSize: '0.875rem' }}>
                  אין מכירות לצפייה
                </div>
              ) : (
                salesModal.salesData.map((sale) => (
                  <div key={sale.id} className="sale-block">
                    <table className="sales-modal-table">
                      <thead>
                        <tr>
                          <th>תאריך</th>
                          <th>מוצרים</th>
                          <th>סכום עסקה</th>
                          <th>שולם</th>
                          <th>יתרה</th>
                          <th>סטטוס</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ whiteSpace: 'nowrap' }}>{sale.date}</td>
                          <td>{sale.products}</td>
                          <td style={{ whiteSpace: 'nowrap', color: 'var(--amber-11)', fontWeight: 600 }}>
                            {sale.totalDeal ? `₪${sale.totalDeal.toLocaleString('he-IL')}` : '—'}
                          </td>
                          <td style={{ whiteSpace: 'nowrap', color: 'var(--green-11)' }}>
                            {sale.totalPaid ? `₪${sale.totalPaid.toLocaleString('he-IL')}` : '—'}
                          </td>
                          <td style={{ whiteSpace: 'nowrap', color: sale.balance > 0 ? 'var(--red-11)' : 'var(--gray-9)', fontWeight: sale.balance > 0 ? 600 : 400 }}>
                            {sale.balance > 0 ? `₪${sale.balance.toLocaleString('he-IL')}` : '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>{sale.fullyPaid ? '✅' : '—'}</td>
                        </tr>
                      </tbody>
                    </table>
                    {sale.payments.length > 0 ? (
                      <table className="payments-sub-table">
                        <thead>
                          <tr>
                            <th>מספר תשלום</th>
                            <th>סכום</th>
                            <th>סטטוס</th>
                            <th>תאריך יעד</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sale.payments.map((p, i) => (
                            <tr key={i}>
                              <td>{p.num}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>₪{p.amount.toLocaleString('he-IL')}</td>
                              <td>
                                <span className={`payment-badge payment-badge--${p.status === 'שולם בפועל' ? 'paid' : 'pending'}`}>
                                  {p.status}
                                </span>
                              </td>
                              <td style={{ whiteSpace: 'nowrap', color: 'var(--gray-11)' }}>{p.dueDate}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ padding: '8px 12px', color: 'var(--gray-9)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                        — אין פעימות תשלום —
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save confirmation dialog */}
      {showSaveConfirm && (
        <div className="save-confirm-overlay">
          <div className="save-confirm-dialog">
            <Text size="3" weight="bold" style={{ display: 'block', marginBottom: '18px' }}>
              האם לשמור שינויים?
            </Text>
            <Flex gap="2" justify="center">
              <button
                className="row-edit-save-btn"
                onClick={() => { isSavingRef.current = true; saveExpandedRecord(); }}
              >
                שמור
              </button>
              <button className="row-edit-cancel-btn" onClick={closeExpand}>
                בטל שינויים
              </button>
            </Flex>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
