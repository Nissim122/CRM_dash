import React, { useState, useMemo } from 'react';
import {
  Table, Badge, Button, Text, Select, TextArea, Flex, Callout, TextField,
} from '@radix-ui/themes';

const STATUSES = ['נוצר קשר', 'לא נוצר קשר', 'נרשם כלקוח', 'שיתוף פעולה', 'לא רלוונטי'];
const ACTIVE_STATUSES = new Set(['נוצר קשר', 'לא נוצר קשר', 'שיתוף פעולה']);

const STATUS_COLOR = {
  'נוצר קשר':    'indigo',
  'לא נוצר קשר': 'red',
  'נרשם כלקוח':  'green',
  'שיתוף פעולה': 'yellow',
  'לא רלוונטי':  'gray',
};

const NEW_LEAD_MS     = 24 * 3600 * 1000;
const MAX_TEXT_LENGTH = 2000;

const DATE_RANGES = [
  { key: 'all',   label: 'הכל'  },
  { key: 'today', label: 'היום' },
  { key: 'week',  label: 'שבוע' },
  { key: 'month', label: 'חודש' },
];

const EMPTY_FILTERS = {
  search:    '',
  statuses:  [],
  sources:   [],
  services:  [],
  minScore:  '',
  dateRange: 'all',
  newOnly:   false,
};

function getDateRangeStart(key) {
  const now = new Date();
  if (key === 'today') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
  if (key === 'week')  { const d = new Date(now); d.setDate(now.getDate() - 6); d.setHours(0, 0, 0, 0); return d; }
  if (key === 'month') { return new Date(now.getFullYear(), now.getMonth(), 1); }
  return null;
}

function isNewLead(record, createdTimeField) {
  const raw = createdTimeField ? record.getCellValue(createdTimeField) : record.createdTime;
  return raw && Date.now() - new Date(raw).getTime() < NEW_LEAD_MS;
}

function buildWhatsAppUrl(phone) {
  const cleaned = (phone || '').replace(/\D/g, '');
  if (!cleaned) return null;
  const intl = cleaned.startsWith('0') ? '972' + cleaned.slice(1) : cleaned;
  if (intl.length < 10) return null;
  const msg = encodeURIComponent('שלום! אני מ-BillsAI, רציתי לחזור אליך בנוגע לפנייתך 😊');
  return `https://wa.me/${intl}?text=${msg}`;
}

function getSelectChoices(field) {
  return field?.options?.choices?.map((c) => c.name) ?? [];
}

function toggleInArray(arr, val) {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
}

export default function OperationalTable({ records, fields, table }) {
  const [editingCell,  setEditingCell]  = useState(null);
  const [showAll,      setShowAll]      = useState(false);
  const [saveError,    setSaveError]    = useState(null);
  const [showFilters,  setShowFilters]  = useState(false);
  const [filters,      setFilters]      = useState(EMPTY_FILTERS);

  const serviceChoices = useMemo(() => getSelectChoices(fields.serviceType), [fields.serviceType]);
  const sourceChoices  = useMemo(() => getSelectChoices(fields.leadSource),  [fields.leadSource]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.search)              n++;
    if (filters.statuses.length)     n++;
    if (filters.sources.length)      n++;
    if (filters.services.length)     n++;
    if (filters.minScore)            n++;
    if (filters.dateRange !== 'all') n++;
    if (filters.newOnly)             n++;
    return n;
  }, [filters]);

  function setFilter(key, val) {
    setFilters((f) => ({ ...f, [key]: val }));
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
  }

  const filtered = useMemo(() => {
    let base = showAll
      ? records
      : records.filter((r) => {
          const s = fields.status ? r.getCellValue(fields.status)?.name : null;
          return !s || ACTIVE_STATUSES.has(s);
        });

    if (filters.search) {
      const q = filters.search.toLowerCase();
      base = base.filter((r) => {
        const name  = fields.name  ? String(r.getCellValue(fields.name)  ?? '') : '';
        const phone = fields.phone ? String(r.getCellValue(fields.phone) ?? '') : '';
        return name.toLowerCase().includes(q) || phone.includes(q);
      });
    }

    if (filters.statuses.length) {
      base = base.filter((r) => {
        const s = fields.status ? r.getCellValue(fields.status)?.name : null;
        return filters.statuses.includes(s);
      });
    }

    if (filters.sources.length) {
      base = base.filter((r) => {
        const s = fields.leadSource ? r.getCellValue(fields.leadSource)?.name : null;
        return filters.sources.includes(s);
      });
    }

    if (filters.services.length) {
      base = base.filter((r) => {
        const s = fields.serviceType ? r.getCellValue(fields.serviceType)?.name : null;
        return filters.services.includes(s);
      });
    }

    if (filters.minScore) {
      const min = Number(filters.minScore);
      base = base.filter((r) => {
        const score = fields.score ? (r.getCellValue(fields.score) ?? 0) : 0;
        return Number(score) >= min;
      });
    }

    if (filters.dateRange !== 'all') {
      const rangeStart = getDateRangeStart(filters.dateRange);
      if (rangeStart) {
        base = base.filter((r) => {
          const raw = fields.createdTime ? r.getCellValue(fields.createdTime) : r.createdTime;
          return raw && new Date(raw) >= rangeStart;
        });
      }
    }

    if (filters.newOnly) {
      base = base.filter((r) => isNewLead(r, fields.createdTime));
    }

    return base;
  }, [records, fields, showAll, filters]);

  async function saveField(record, field, value) {
    if (!field) return;
    try {
      setSaveError(null);
      await table.updateRecordAsync(record, { [field.id]: value });
    } catch {
      setSaveError('שגיאה בשמירה — בדוק הרשאות');
    }
    setEditingCell(null);
  }

  function editing(recordId, fieldName) {
    return editingCell?.recordId === recordId && editingCell?.field === fieldName;
  }

  function InlineSelect({ record, field, choices, currentValue, colorMap }) {
    if (!field || choices.length === 0) {
      return <Text color="gray" size="2">{currentValue || '—'}</Text>;
    }
    if (editing(record.id, field.id)) {
      return (
        <Select.Root
          defaultValue={currentValue}
          onValueChange={(val) => saveField(record, field, { name: val })}
          size="1"
        >
          <Select.Trigger />
          <Select.Content>
            {choices.map((s) => <Select.Item key={s} value={s}>{s}</Select.Item>)}
          </Select.Content>
        </Select.Root>
      );
    }
    const color = colorMap?.[currentValue] || 'gray';
    return (
      <Badge
        color={color}
        variant="soft"
        style={{ cursor: 'pointer' }}
        onClick={() => setEditingCell({ recordId: record.id, field: field.id })}
        title="לחץ לעריכה"
      >
        {currentValue || '—'}
      </Badge>
    );
  }

  return (
    <div className="ops-section">
      <Flex justify="between" align="center" mb="3">
        <Text size="4" weight="bold">לידים — מרכז עבודה</Text>
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
          <Button variant="soft" color="gray" size="2" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'פעילים בלבד' : 'הצג הכל'}
          </Button>
        </Flex>
      </Flex>

      {showFilters && (
        <div className="filter-panel">
          <div className="filter-group filter-group--wide">
            <span className="filter-label">חיפוש</span>
            <TextField.Root
              placeholder="שם / טלפון…"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              size="2"
            />
          </div>

          <div className="filter-group">
            <span className="filter-label">תאריך יצירה</span>
            <div className="filter-chips-row">
              {DATE_RANGES.map(({ key, label }) => (
                <button
                  key={key}
                  className={`filter-chip${filters.dateRange === key ? ' filter-chip--active' : ''}`}
                  onClick={() => setFilter('dateRange', key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-label">סטטוס</span>
            <div className="filter-chips-row">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  className={`filter-chip${filters.statuses.includes(s) ? ' filter-chip--active' : ''}`}
                  onClick={() => setFilter('statuses', toggleInArray(filters.statuses, s))}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {sourceChoices.length > 0 && (
            <div className="filter-group">
              <span className="filter-label">מקור ליד</span>
              <div className="filter-chips-row">
                {sourceChoices.map((s) => (
                  <button
                    key={s}
                    className={`filter-chip${filters.sources.includes(s) ? ' filter-chip--active' : ''}`}
                    onClick={() => setFilter('sources', toggleInArray(filters.sources, s))}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {serviceChoices.length > 0 && (
            <div className="filter-group">
              <span className="filter-label">סוג שירות</span>
              <div className="filter-chips-row">
                {serviceChoices.map((s) => (
                  <button
                    key={s}
                    className={`filter-chip${filters.services.includes(s) ? ' filter-chip--active' : ''}`}
                    onClick={() => setFilter('services', toggleInArray(filters.services, s))}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="filter-group filter-group--row">
            {fields.score && (
              <label className="filter-inline-label">
                <span className="filter-label">ניקוד מינ׳</span>
                <input
                  type="number"
                  min="0"
                  value={filters.minScore}
                  onChange={(e) => setFilter('minScore', e.target.value)}
                  className="filter-number-input"
                  placeholder="0"
                />
              </label>
            )}
            <label className="filter-checkbox-label">
              <input
                type="checkbox"
                checked={filters.newOnly}
                onChange={(e) => setFilter('newOnly', e.target.checked)}
              />
              <span>חדשים בלבד</span>
            </label>
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
              <Table.ColumnHeaderCell style={{ width: 40 }}></Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>פעולה הבאה</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>שווי עסקה</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>מקור</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>סוג שירות</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>סטטוס</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>שם</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {filtered.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={7}>
                  <Text color="gray" align="center" style={{ display: 'block', padding: '24px' }}>
                    אין לידים להצגה
                  </Text>
                </Table.Cell>
              </Table.Row>
            )}
            {filtered.map((record) => {
              const isNew   = isNewLead(record, fields.createdTime);
              const status  = fields.status      ? record.getCellValue(fields.status)?.name      : null;
              const phone   = fields.phone       ? record.getCellValue(fields.phone)             : null;
              const nextAct = fields.nextAction  ? record.getCellValue(fields.nextAction)        : '';
              const service = fields.serviceType ? record.getCellValue(fields.serviceType)?.name : null;
              const source  = fields.leadSource  ? record.getCellValue(fields.leadSource)?.name  : null;
              const dealVal = fields.dealValue   ? record.getCellValue(fields.dealValue)         : null;
              const name    = fields.name        ? record.getCellValue(fields.name)              : record.name;
              const waUrl   = buildWhatsAppUrl(phone);

              const dealDisplay = dealVal != null
                ? `₪${Number(dealVal).toLocaleString('he-IL')}`
                : '—';

              return (
                <Table.Row key={record.id} style={isNew ? { background: 'var(--indigo-a3)' } : {}}>

                  {/* WhatsApp */}
                  <Table.Cell>
                    {waUrl ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="whatsapp-btn"
                        title="פתח וואטסאפ"
                      >💬</a>
                    ) : (
                      <Text color="gray" size="1">—</Text>
                    )}
                  </Table.Cell>

                  {/* פעולה הבאה */}
                  <Table.Cell>
                    {editing(record.id, 'nextAction') ? (
                      <TextArea
                        defaultValue={nextAct || ''}
                        autoFocus
                        onBlur={(e) => saveField(record, fields.nextAction, e.target.value.trim().slice(0, MAX_TEXT_LENGTH))}
                        rows={2}
                        size="1"
                        maxLength={MAX_TEXT_LENGTH}
                      />
                    ) : (
                      <Text
                        color={nextAct ? undefined : 'gray'}
                        style={{
                          cursor: fields.nextAction ? 'pointer' : 'default',
                          fontStyle: nextAct ? 'normal' : 'italic',
                          fontSize: '0.82rem',
                        }}
                        onClick={() => fields.nextAction && setEditingCell({ recordId: record.id, field: 'nextAction' })}
                        title={fields.nextAction ? 'לחץ לעריכה' : undefined}
                      >
                        {nextAct || (fields.nextAction ? '+ הוסף פעולה' : '—')}
                      </Text>
                    )}
                  </Table.Cell>

                  {/* שווי עסקה */}
                  <Table.Cell>
                    <Text color="amber" weight="bold" size="2">{dealDisplay}</Text>
                  </Table.Cell>

                  {/* מקור ליד */}
                  <Table.Cell>
                    <InlineSelect
                      record={record}
                      field={fields.leadSource}
                      choices={sourceChoices}
                      currentValue={source}
                    />
                  </Table.Cell>

                  {/* סוג שירות */}
                  <Table.Cell>
                    <InlineSelect
                      record={record}
                      field={fields.serviceType}
                      choices={serviceChoices}
                      currentValue={service}
                    />
                  </Table.Cell>

                  {/* סטטוס */}
                  <Table.Cell>
                    <InlineSelect
                      record={record}
                      field={fields.status}
                      choices={STATUSES}
                      currentValue={status}
                      colorMap={STATUS_COLOR}
                    />
                  </Table.Cell>

                  {/* שם */}
                  <Table.Cell>
                    <Flex align="center" gap="2">
                      {isNew && <Badge color="indigo" size="1">חדש!</Badge>}
                      <Text size="2">{name || '—'}</Text>
                    </Flex>
                  </Table.Cell>

                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      </div>
    </div>
  );
}
