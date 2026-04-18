import React, { useMemo, useState } from 'react';
import { Card, Text, Heading, Flex, Table, Badge } from '@radix-ui/themes';
import { globalConfig } from '@airtable/blocks';
import { useGlobalConfig } from '@airtable/blocks/ui';

const PRESETS_KEY = 'filterPresets_customers';

function getPeriodStart(period) {
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

const PERIOD_LABEL = { week: 'השבוע', month: 'החודש', year: 'השנה' };

const EMPTY_FILTERS = { search: '', minRevenue: '' };

export default function CustomersView({
  customersRecords, customersFields,
  salesRecords, salesFields,
  leadsRecords, leadsFields,
  period,
}) {
  const [showFilters,    setShowFilters]    = useState(false);
  const [filters,        setFilters]        = useState(EMPTY_FILTERS);
  const [showSaveInput,  setShowSaveInput]  = useState(false);
  const [presetName,     setPresetName]     = useState('');

  const gConfig = useGlobalConfig();
  const presets  = gConfig.get(PRESETS_KEY) ?? [];

  const activeFilterCount = (filters.search ? 1 : 0) + (filters.minRevenue ? 1 : 0);

  function setFilter(key, val) { setFilters((f) => ({ ...f, [key]: val })); }
  function resetFilters()      { setFilters(EMPTY_FILTERS); }

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
    setShowFilters(false);
  }

  const stats = useMemo(() => {
    const startDate = getPeriodStart(period);
    let revenueInPeriod = 0;
    let salesInPeriod = 0;

    for (const record of salesRecords) {
      const dateRaw = salesFields.date ? record.getCellValue(salesFields.date) : null;
      if (!dateRaw || new Date(dateRaw) < startDate) continue;
      salesInPeriod++;
      const priceArr = salesFields.price ? record.getCellValue(salesFields.price) : null;
      if (Array.isArray(priceArr)) {
        for (const val of priceArr) {
          revenueInPeriod += typeof val === 'number' ? val : (val?.value ?? 0);
        }
      }
    }

    return { total: customersRecords.length, revenueInPeriod, salesInPeriod };
  }, [customersRecords, salesRecords, salesFields, period]);

  const periodLabel = PERIOD_LABEL[period];

  const leadsById = useMemo(() => {
    const map = new Map();
    for (const r of (leadsRecords ?? [])) map.set(r.id, r);
    return map;
  }, [leadsRecords]);

  const revenueByCustomer = useMemo(() => {
    const map = new Map();
    for (const record of customersRecords) {
      const totalRaw = customersFields.total ? record.getCellValue(customersFields.total) : null;
      map.set(record.id, totalRaw != null ? Number(totalRaw) : 0);
    }
    return map;
  }, [customersRecords, customersFields]);

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
    return base;
  }, [customersRecords, customersFields, filters, revenueByCustomer]);

  const cards = [
    { id: 'total',   label: 'סה"כ לקוחות',           value: stats.total },
    { id: 'revenue', label: `הכנסות ${periodLabel}`,  value: `₪${stats.revenueInPeriod.toLocaleString('he-IL')}` },
    { id: 'sales',   label: `מכירות ${periodLabel}`,  value: stats.salesInPeriod },
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

        {presets.length > 0 && (
          <div className="preset-bar">
            <span className="preset-bar__label">תבניות:</span>
            {presets.map((p) => (
              <span key={p.id} className="preset-chip">
                <button className="preset-chip__apply" onClick={() => applyPreset(p)}>{p.name}</button>
                <button className="preset-chip__delete" onClick={() => deletePreset(p.id)} title="מחק תבנית">×</button>
              </span>
            ))}
          </div>
        )}

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

        <div className="table-wrapper">
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>מכירות</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>סה"כ הכנסות</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>תאריך יצירה</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>מקור ליד</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>שם לקוח</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filteredCustomers.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={5}>
                    <Text color="gray" align="center" style={{ display: 'block', padding: '24px' }}>
                      אין לקוחות להצגה
                    </Text>
                  </Table.Cell>
                </Table.Row>
              )}
              {filteredCustomers.map((record) => {
                const leadLinks  = customersFields.lead  ? record.getCellValue(customersFields.lead)  : null;
                const salesLinks = customersFields.sales ? record.getCellValue(customersFields.sales) : null;
                const totalRaw   = revenueByCustomer.get(record.id);

                const name       = leadLinks?.[0]?.name ?? '—';
                const salesCount = Array.isArray(salesLinks) ? salesLinks.length : 0;
                const totalStr   = totalRaw ? `₪${totalRaw.toLocaleString('he-IL')}` : '—';

                const leadRecord   = leadLinks?.[0] ? leadsById.get(leadLinks[0].id) : null;
                const leadSource   = leadRecord && leadsFields?.leadSource
                  ? leadRecord.getCellValue(leadsFields.leadSource)?.name ?? '—'
                  : '—';
                const createdRaw   = leadRecord && leadsFields?.createdTime
                  ? leadRecord.getCellValue(leadsFields.createdTime)
                  : null;
                const createdStr   = createdRaw
                  ? new Date(createdRaw).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })
                  : '—';

                return (
                  <Table.Row key={record.id}>
                    <Table.Cell>
                      <Badge color="indigo" variant="soft">{salesCount}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text color="amber" weight="bold">{totalStr}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text color="gray" size="1" style={{ whiteSpace: 'nowrap' }}>{createdStr}</Text>
                    </Table.Cell>
                    <Table.Cell><Text size="2">{leadSource}</Text></Table.Cell>
                    <Table.Cell><Text>{name}</Text></Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </div>
      </div>
    </>
  );
}
