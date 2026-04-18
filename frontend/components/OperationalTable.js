import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Table, Badge, Button, Text, Flex, Callout, TextField,
} from '@radix-ui/themes';
import { globalConfig } from '@airtable/blocks';
import { useGlobalConfig } from '@airtable/blocks/ui';

const PRESETS_KEY = 'filterPresets_leads';

function formatMinutes(min) {
  if (min < 60) return `${Math.round(min)} דקות`;
  if (min < 1440) return `${Math.round(min / 60)} שעות`;
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  return h > 0 ? `${d} ימים ${h} שעות` : `${d} ימים`;
}

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
  search:          '',
  statuses:        [],
  sources:         [],
  services:        [],
  minScore:        '',
  minInteractions: '',
  messageSent:     'all',
  dateRange:       'all',
  newOnly:         false,
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

export default function OperationalTable({ records, fields, table, interactionsTable, interactionsRecords }) {
  const [expandedRow,     setExpandedRow]     = useState(null);
  const [draftValues,     setDraftValues]     = useState({});
  const [origValues,      setOrigValues]      = useState({});
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [saveError,       setSaveError]       = useState(null);
  const [showFilters,     setShowFilters]     = useState(false);
  const [filters,         setFilters]         = useState(EMPTY_FILTERS);
  const [showSaveInput,   setShowSaveInput]   = useState(false);
  const [presetName,      setPresetName]      = useState('');
  const [tick,            setTick]            = useState(0);
  const [activePresetId,  setActivePresetId]  = useState(null);

  const expandedPanelRef = useRef(null);
  const pencilBtnRefs    = useRef({});
  const isSavingRef      = useRef(false);
  const draftRef         = useRef(draftValues);
  const origRef          = useRef(origValues);
  const expandedRowRef   = useRef(expandedRow);

  useEffect(() => { draftRef.current        = draftValues;  }, [draftValues]);
  useEffect(() => { origRef.current         = origValues;   }, [origValues]);
  useEffect(() => { expandedRowRef.current  = expandedRow;  }, [expandedRow]);

  const gConfig = useGlobalConfig();
  const presets = gConfig.get(PRESETS_KEY) ?? [];

  const [interactionsModal,   setInteractionsModal]   = useState(null);
  const [interactionDetailId, setInteractionDetailId] = useState(null);

  const interactionsById = useMemo(
    () => new Map((interactionsRecords ?? []).map((r) => [r.id, r])),
    [interactionsRecords]
  );
  const intxActionField = useMemo(
    () => interactionsTable?.getFieldByNameIfExists('פעולה'),
    [interactionsTable]
  );
  const intxScoreField = useMemo(
    () => interactionsTable?.getFieldByNameIfExists('הוספה לדירוג'),
    [interactionsTable]
  );

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Outside-click: show save confirmation if there are unsaved changes
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

  const serviceChoices = useMemo(() => getSelectChoices(fields.serviceType), [fields.serviceType]);
  const sourceChoices  = useMemo(() => getSelectChoices(fields.leadSource),  [fields.leadSource]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.search)              n++;
    if (filters.statuses.length)     n++;
    if (filters.sources.length)      n++;
    if (filters.services.length)     n++;
    if (filters.minScore)                n++;
    if (filters.minInteractions)         n++;
    if (filters.messageSent !== 'all')   n++;
    if (filters.dateRange !== 'all')     n++;
    if (filters.newOnly)             n++;
    return n;
  }, [filters]);

  function setFilter(key, val) { setActivePresetId(null); setFilters((f) => ({ ...f, [key]: val })); }
  function resetFilters()      { setActivePresetId(null); setFilters(EMPTY_FILTERS); }

  const filtered = useMemo(() => {
    let base = records;

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
    if (filters.minInteractions) {
      const min = Number(filters.minInteractions);
      base = base.filter((r) => {
        const val = fields.interactions ? r.getCellValue(fields.interactions) : null;
        const count = Array.isArray(val) ? val.length : (val != null ? Number(val) : 0);
        return count >= min;
      });
    }
    if (filters.messageSent !== 'all') {
      base = base.filter((r) => {
        const val = fields.messageSent ? r.getCellValue(fields.messageSent) : null;
        const isSent = val === true || val === 'כן' || val === 'נשלחה';
        return filters.messageSent === 'yes' ? isSent : !isSent;
      });
    }
    if (filters.newOnly) {
      base = base.filter((r) => isNewLead(r, fields.createdTime));
    }
    return [...base].sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
  }, [records, fields, filters]);

  function getDraftInitial(record) {
    return {
      status:      fields.status      ? (record.getCellValue(fields.status)?.name      ?? null) : null,
      nextAction:  fields.nextAction  ? (record.getCellValue(fields.nextAction)         ?? '')   : '',
      dealValue:   fields.dealValue   ? (record.getCellValue(fields.dealValue)          ?? '')   : '',
      leadSource:  fields.leadSource  ? (record.getCellValue(fields.leadSource)?.name  ?? null) : null,
      serviceType: fields.serviceType ? (record.getCellValue(fields.serviceType)?.name ?? null) : null,
      phone:       fields.phone       ? (record.getCellValue(fields.phone)              ?? '')   : '',
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
    const record = records.find((r) => r.id === currentId);
    if (!record) { closeExpand(); return; }
    isSavingRef.current = true;

    const draft = draftRef.current;
    const orig  = origRef.current;
    const updates = {};

    if (fields.status && draft.status !== orig.status) {
      updates[fields.status.id] = draft.status ? { name: draft.status } : null;
    }
    if (fields.nextAction && draft.nextAction !== orig.nextAction) {
      updates[fields.nextAction.id] = (draft.nextAction || '').trim().slice(0, MAX_TEXT_LENGTH);
    }
    if (fields.dealValue && String(draft.dealValue) !== String(orig.dealValue)) {
      updates[fields.dealValue.id] = draft.dealValue === '' ? null : Number(draft.dealValue);
    }
    if (fields.leadSource && draft.leadSource !== orig.leadSource) {
      updates[fields.leadSource.id] = draft.leadSource ? { name: draft.leadSource } : null;
    }
    if (fields.serviceType && draft.serviceType !== orig.serviceType) {
      updates[fields.serviceType.id] = draft.serviceType ? { name: draft.serviceType } : null;
    }
    if (fields.phone && draft.phone !== orig.phone) {
      updates[fields.phone.id] = draft.phone || '';
    }

    if (Object.keys(updates).length > 0) {
      try {
        setSaveError(null);
        await table.updateRecordAsync(record, updates);
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

  return (
    <div className="ops-layout">

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

            {fields.messageSent && (
              <div className="filter-group">
                <span className="filter-label">נשלחה הודעה</span>
                <div className="filter-chips-row">
                  {[{ key: 'all', label: 'הכל' }, { key: 'yes', label: 'כן' }, { key: 'no', label: 'לא' }].map(({ key, label }) => (
                    <button
                      key={key}
                      className={`filter-chip${filters.messageSent === key ? ' filter-chip--active' : ''}`}
                      onClick={() => setFilter('messageSent', key)}
                    >
                      {label}
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
              {fields.interactions && (
                <label className="filter-inline-label">
                  <span className="filter-label">אינטרקציות מינ׳</span>
                  <input
                    type="number"
                    min="0"
                    value={filters.minInteractions}
                    onChange={(e) => setFilter('minInteractions', e.target.value)}
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
                <Table.ColumnHeaderCell style={{ width: 40 }}></Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>תאריך יצירה</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>הערות</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>מקור</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>סוג שירות</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>זמן חזרה</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>ניקוד</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>נשלחה הודעה</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>אינטרקציות</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>סטטוס</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>שם</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell style={{ width: 36 }}></Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filtered.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={12}>
                    <Text color="gray" align="center" style={{ display: 'block', padding: '24px' }}>
                      אין לידים להצגה
                    </Text>
                  </Table.Cell>
                </Table.Row>
              )}
              {filtered.map((record) => {
                const isNew      = isNewLead(record, fields.createdTime);
                const isExpanded = expandedRow === record.id;
                const status     = fields.status      ? record.getCellValue(fields.status)?.name      : null;
                const phone      = fields.phone       ? record.getCellValue(fields.phone)             : null;
                const nextAct    = fields.nextAction  ? record.getCellValue(fields.nextAction)        : '';
                const service    = fields.serviceType ? record.getCellValue(fields.serviceType)?.name : null;
                const source     = fields.leadSource  ? record.getCellValue(fields.leadSource)?.name  : null;
                const dealVal    = fields.dealValue   ? record.getCellValue(fields.dealValue)         : null;
                const name         = fields.name         ? record.getCellValue(fields.name)              : record.name;
                const score        = fields.score        ? record.getCellValue(fields.score)              : null;
                const interactions = fields.interactions ? record.getCellValue(fields.interactions)       : null;
                const messageSent  = fields.messageSent  ? record.getCellValue(fields.messageSent)        : null;
                const waUrl        = buildWhatsAppUrl(phone);
                const createdRaw = fields.createdTime ? record.getCellValue(fields.createdTime) : record.createdTime;
                const createdStr = createdRaw
                  ? new Date(createdRaw).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })
                  : '—';
                const dealDisplay = dealVal != null ? `₪${Number(dealVal).toLocaleString('he-IL')}` : '—';
                const responseWaitMin = fields.responseWait ? record.getCellValue(fields.responseWait) : null;
                let waitDisplay = '—';
                let waitColor = 'gray';
                if (responseWaitMin != null && responseWaitMin > 0) {
                  waitDisplay = formatMinutes(responseWaitMin) + ' ✓';
                  waitColor = 'green';
                } else if (status === 'לא נוצר קשר') {
                  const cr = fields.createdTime ? record.getCellValue(fields.createdTime) : record.createdTime;
                  if (cr) {
                    waitDisplay = formatMinutes((Date.now() - new Date(cr).getTime()) / 60000);
                    waitColor = 'red';
                  }
                }

                return (
                  <Table.Row
                    key={record.id}
                    ref={isExpanded ? expandedPanelRef : null}
                    onKeyDown={isExpanded ? handlePanelKeyDown : undefined}
                    style={{
                      ...(isNew && !isExpanded ? { background: 'var(--indigo-a3)' } : {}),
                      ...(isExpanded ? { background: 'var(--indigo-a2)', outline: '2px solid var(--indigo-7)', outlineOffset: '-1px' } : {}),
                    }}
                  >
                    {/* WhatsApp */}
                    <Table.Cell>
                      {waUrl ? (
                        <a href={waUrl} target="_blank" rel="noopener noreferrer" className="whatsapp-btn" title="פתח וואטסאפ">💬</a>
                      ) : (
                        <Text color="gray" size="1">—</Text>
                      )}
                    </Table.Cell>

                    {/* תאריך יצירה */}
                    <Table.Cell>
                      <Text color="gray" size="1" style={{ whiteSpace: 'nowrap' }}>{createdStr}</Text>
                    </Table.Cell>

                    {/* הערות */}
                    <Table.Cell>
                      {isExpanded && fields.nextAction ? (
                        <textarea
                          className="cell-edit-textarea"
                          value={draftValues.nextAction}
                          onChange={(e) => setDraft('nextAction', e.target.value)}
                          rows={2}
                          maxLength={MAX_TEXT_LENGTH}
                          placeholder="הערות לליד…"
                        />
                      ) : (
                        <Text
                          color={nextAct ? undefined : 'gray'}
                          style={{ fontStyle: nextAct ? 'normal' : 'italic', fontSize: '0.82rem' }}
                        >
                          {nextAct || '—'}
                        </Text>
                      )}
                    </Table.Cell>

                    {/* מקור ליד */}
                    <Table.Cell>
                      {isExpanded && fields.leadSource && sourceChoices.length > 0 ? (
                        <select
                          className="cell-edit-select"
                          value={draftValues.leadSource || ''}
                          onChange={(e) => setDraft('leadSource', e.target.value || null)}
                        >
                          <option value="">—</option>
                          {sourceChoices.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        source
                          ? <Badge color="gray" variant="soft">{source}</Badge>
                          : <Text color="gray" size="2">—</Text>
                      )}
                    </Table.Cell>

                    {/* סוג שירות */}
                    <Table.Cell>
                      {isExpanded && fields.serviceType && serviceChoices.length > 0 ? (
                        <select
                          className="cell-edit-select"
                          value={draftValues.serviceType || ''}
                          onChange={(e) => setDraft('serviceType', e.target.value || null)}
                        >
                          <option value="">—</option>
                          {serviceChoices.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        service
                          ? <Badge color="gray" variant="soft">{service}</Badge>
                          : <Text color="gray" size="2">—</Text>
                      )}
                    </Table.Cell>

                    {/* זמן חזרה */}
                    <Table.Cell>
                      <Text
                        size="1"
                        color={waitColor}
                        style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {waitDisplay}
                      </Text>
                    </Table.Cell>

                    {/* ניקוד */}
                    <Table.Cell>
                      <Text size="2" weight="bold" color="indigo" align="center" style={{ display: 'block' }}>
                        {score != null ? score : '—'}
                      </Text>
                    </Table.Cell>

                    {/* נשלחה הודעה */}
                    <Table.Cell>
                      {messageSent === true || messageSent === 'כן' || messageSent === 'נשלחה' ? (
                        <Badge color="green" variant="soft">כן</Badge>
                      ) : messageSent === false || messageSent === 'לא' ? (
                        <Badge color="gray" variant="soft">לא</Badge>
                      ) : messageSent ? (
                        <Badge color="gray" variant="soft">{String(messageSent)}</Badge>
                      ) : (
                        <Text color="gray" size="2">—</Text>
                      )}
                    </Table.Cell>

                    {/* אינטרקציות */}
                    <Table.Cell>
                      {Array.isArray(interactions) && interactions.length > 0 ? (
                        <button
                          className="interactions-count-btn"
                          onClick={(e) => { e.stopPropagation(); setInteractionsModal({ leadName: name || '—', linkedIds: interactions.map((i) => i.id) }); }}
                        >
                          {interactions.length}
                        </button>
                      ) : (
                        <Text size="2" align="center" color="gray" style={{ display: 'block' }}>—</Text>
                      )}
                    </Table.Cell>

                    {/* סטטוס */}
                    <Table.Cell>
                      {isExpanded && fields.status ? (
                        <select
                          className="cell-edit-select"
                          value={draftValues.status || ''}
                          onChange={(e) => setDraft('status', e.target.value || null)}
                        >
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <Badge color={STATUS_COLOR[status] || 'gray'} variant="soft">
                          {status || '—'}
                        </Badge>
                      )}
                    </Table.Cell>

                    {/* שם */}
                    <Table.Cell>
                      <Flex align="center" justify="center" gap="2">
                        {isNew && <Badge color="indigo" size="1">חדש!</Badge>}
                        <Text size="2">{name || '—'}</Text>
                      </Flex>
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

      {/* Interactions modal */}
      {interactionsModal && (
        <div
          className="interactions-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) { setInteractionsModal(null); setInteractionDetailId(null); } }}
        >
          <div className="interactions-modal">
            <div className="interactions-modal__header">
              {interactionDetailId ? (
                <button className="interactions-modal__back" onClick={() => setInteractionDetailId(null)} title="חזרה">&#8592;</button>
              ) : (
                <span style={{ width: 28 }} />
              )}
              <span className="interactions-modal__title">
                {interactionDetailId ? 'פרטי אינטרקציה' : `אינטרקציות — ${interactionsModal.leadName}`}
              </span>
              <button className="interactions-modal__close" onClick={() => { setInteractionsModal(null); setInteractionDetailId(null); }} title="סגור">×</button>
            </div>

            <div className="interactions-modal__body">
              {interactionDetailId ? (() => {
                const rec = interactionsById.get(interactionDetailId);
                if (!rec) return <div className="interaction-detail__fields"><span style={{ color: 'var(--gray-9)', fontSize: '0.85rem' }}>לא נמצא</span></div>;
                const actionVal  = intxActionField ? rec.getCellValue(intxActionField) : null;
                const actionName = Array.isArray(actionVal) ? actionVal[0]?.name : (actionVal?.name ?? rec.name ?? '—');
                const scoreRaw   = intxScoreField ? rec.getCellValue(intxScoreField) : null;
                const scoreItem  = Array.isArray(scoreRaw) ? scoreRaw[0] : scoreRaw;
                const score      = scoreItem != null && typeof scoreItem === 'object' ? scoreItem.value : scoreItem;
                return (
                  <div className="interaction-detail__fields">
                    <div className="interaction-detail__field">
                      <span className="interaction-detail__label">פעולה</span>
                      <span className="interaction-detail__value">
                        <span className="interaction-action-badge">{actionName || '—'}</span>
                      </span>
                    </div>
                    <div className="interaction-detail__field">
                      <span className="interaction-detail__label">הוספה לדירוג</span>
                      <span className="interaction-detail__value" style={{ fontWeight: 700, color: 'var(--indigo-11)' }}>
                        {score != null ? `+${score}` : '—'}
                      </span>
                    </div>
                    <div className="interaction-detail__field">
                      <span className="interaction-detail__label">מזהה רשומה</span>
                      <span className="interaction-detail__value" style={{ color: 'var(--gray-9)', fontSize: '0.78rem' }}>{rec.id}</span>
                    </div>
                  </div>
                );
              })() : (
                interactionsModal.linkedIds.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--gray-9)', fontSize: '0.85rem' }}>אין אינטרקציות</div>
                ) : interactionsModal.linkedIds.map((id) => {
                  const rec = interactionsById.get(id);
                  if (!rec) return null;
                  const actionVal  = intxActionField ? rec.getCellValue(intxActionField) : null;
                  const actionName = Array.isArray(actionVal) ? actionVal[0]?.name : (actionVal?.name ?? rec.name ?? '—');
                  const scoreRaw   = intxScoreField ? rec.getCellValue(intxScoreField) : null;
                  const scoreItem  = Array.isArray(scoreRaw) ? scoreRaw[0] : scoreRaw;
                  const score      = scoreItem != null && typeof scoreItem === 'object' ? scoreItem.value : scoreItem;
                  return (
                    <div key={id} className="interaction-item" onClick={() => setInteractionDetailId(id)}>
                      <span className="interaction-item__action">{actionName || '—'}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {score != null && <span className="interaction-item__score">+{score}</span>}
                        <span className="interaction-item__arrow">&#8249;</span>
                      </span>
                    </div>
                  );
                })
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
  );
}
