import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Card, Table, Badge, Text, Heading, Flex, Callout } from '@radix-ui/themes';

const STATUS_COLOR = {
  'ממתין לראשון': 'amber',
  'ממתין לשני':   'orange',
  'הושלם':        'green',
};

const FILTER_OPTIONS = [
  { key: 'all',             label: 'הכל'            },
  { key: 'ממתין לראשון',   label: 'ממתין לראשון'   },
  { key: 'ממתין לשני',     label: 'ממתין לשני'     },
  { key: 'הושלם',           label: 'הושלם'          },
];

function formatDate(val) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function whatsappLink(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  const intl = digits.startsWith('0') ? '972' + digits.slice(1) : digits;
  return `https://wa.me/${intl}`;
}

export default function FollowupsView({
  followupsRecords,
  followupsFields,
  followupsTable,
  leadsRecords,
}) {
  const leadsById = useMemo(
    () => new Map((leadsRecords ?? []).map(r => [r.id, r])),
    [leadsRecords]
  );
  const [statusFilter, setStatusFilter] = useState('all');
  const [saving,       setSaving]       = useState(null);

  const [expandedRow,     setExpandedRow]     = useState(null);
  const [draftValues,     setDraftValues]     = useState({});
  const [origValues,      setOrigValues]      = useState({});
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [saveError,       setSaveError]       = useState(null);

  const expandedPanelRef = useRef(null);
  const isSavingRef      = useRef(false);
  const draftRef         = useRef(draftValues);
  const origRef          = useRef(origValues);
  const expandedRowRef   = useRef(expandedRow);

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

  const statusChoices = useMemo(
    () => followupsFields.status?.options?.choices?.map((c) => c.name) ?? ['ממתין לראשון', 'ממתין לשני', 'הושלם'],
    [followupsFields.status]
  );

  const counts = useMemo(() => {
    const c = { 'ממתין לראשון': 0, 'ממתין לשני': 0, 'הושלם': 0 };
    for (const r of followupsRecords ?? []) {
      const s = followupsFields.status ? r.getCellValue(followupsFields.status)?.name : null;
      if (s && s in c) c[s]++;
    }
    return c;
  }, [followupsRecords, followupsFields]);

  const filtered = useMemo(() => {
    const recs = followupsRecords ?? [];
    if (statusFilter === 'all') return recs;
    return recs.filter(r => {
      const s = followupsFields.status ? r.getCellValue(followupsFields.status)?.name : null;
      return s === statusFilter;
    });
  }, [followupsRecords, followupsFields, statusFilter]);

  async function toggleCheckbox(record, field, current) {
    if (!followupsTable || !field) return;
    const key = record.id + field.id;
    setSaving(key);
    try {
      await followupsTable.updateRecordAsync(record, { [field.id]: !current });
    } catch (e) {
      console.error('Failed to update follow-up:', e);
    }
    setSaving(null);
  }

  function getDraftInitial(record) {
    return {
      status: followupsFields.status
        ? (record.getCellValue(followupsFields.status)?.name ?? null)
        : null,
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
    const record = (followupsRecords ?? []).find((r) => r.id === currentId);
    if (!record) { closeExpand(); return; }
    isSavingRef.current = true;

    const draft = draftRef.current;
    const orig  = origRef.current;
    const updates = {};

    if (followupsFields.status && draft.status !== orig.status) {
      updates[followupsFields.status.id] = draft.status ? { name: draft.status } : null;
    }

    if (Object.keys(updates).length > 0) {
      try {
        setSaveError(null);
        await followupsTable.updateRecordAsync(record, updates);
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
    if (e.key === 'Enter') {
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

  if (!followupsTable) {
    return (
      <div className="ops-layout">
        <Text color="red">לא נמצאה טבלת "פולואפים".</Text>
      </div>
    );
  }

  return (
    <>
      <div className="kpi-bar">
        {[
          { key: 'ממתין לראשון', label: 'ממתין לפולואפ ראשון', color: 'var(--amber-9)'  },
          { key: 'ממתין לשני',   label: 'ממתין לפולואפ שני',   color: 'var(--orange-9)' },
          { key: 'הושלם',        label: 'הושלמו',               color: 'var(--green-9)'  },
        ].map(({ key, label, color }) => (
          <Card key={key} className="kpi-card" style={{ borderTop: `3px solid ${color}` }}>
            <Flex direction="column" align="end" gap="1">
              <Heading size="7" style={{ color, lineHeight: 1 }}>{counts[key] ?? 0}</Heading>
              <Text size="1" color="gray">{label}</Text>
            </Flex>
          </Card>
        ))}
      </div>

      <div className="ops-layout">
        <div className="ops-section">
          <Flex justify="between" align="center" mb="3">
            <Text size="4" weight="bold">פולואפים ללידים</Text>
            <Flex gap="2">
              {FILTER_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  className={`period-btn${statusFilter === key ? ' period-btn--active' : ''}`}
                  onClick={() => setStatusFilter(key)}
                >
                  {label}
                </button>
              ))}
            </Flex>
          </Flex>

          {saveError && (
            <Callout.Root color="red" mb="3" role="alert">
              <Callout.Text>{saveError}</Callout.Text>
            </Callout.Root>
          )}

          <div className="table-wrapper">
            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>WA</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>טלפון</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>סטטוס</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>✓ ראשון</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>תאריך ראשון</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>✓ שני</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>תאריך שני</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>שם ליד</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ width: 36 }}></Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filtered.length === 0 && (
                  <Table.Row>
                    <Table.Cell colSpan={9}>
                      <Text color="gray" align="center" style={{ display: 'block', padding: '24px' }}>
                        אין פולואפים להצגה
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                )}
                {filtered.map(record => {
                  const isExpanded = expandedRow === record.id;

                  const linkedLeads = followupsFields.leadLink
                    ? record.getCellValue(followupsFields.leadLink)
                    : null;
                  const leadName = leadsById.get(linkedLeads?.[0]?.id)?.name ?? '—';

                  const phoneLookup = followupsFields.phone
                    ? record.getCellValue(followupsFields.phone)
                    : null;
                  const phone = Array.isArray(phoneLookup) ? phoneLookup[0] : phoneLookup;

                  const status = followupsFields.status
                    ? record.getCellValue(followupsFields.status)?.name
                    : null;

                  const check1 = followupsFields.firstCheck
                    ? !!record.getCellValue(followupsFields.firstCheck)
                    : false;
                  const date1 = followupsFields.firstDate
                    ? record.getCellValue(followupsFields.firstDate)
                    : null;
                  const check2 = followupsFields.secondCheck
                    ? !!record.getCellValue(followupsFields.secondCheck)
                    : false;
                  const date2 = followupsFields.secondDate
                    ? record.getCellValue(followupsFields.secondDate)
                    : null;

                  const now = new Date();
                  const isOverdue1 = !check1 && date1 && new Date(date1) < now;
                  const isOverdue2 = !check2 && date2 && new Date(date2) < now;

                  const waLink   = whatsappLink(phone);
                  const isSaving1 = saving === record.id + (followupsFields.firstCheck?.id  ?? '');
                  const isSaving2 = saving === record.id + (followupsFields.secondCheck?.id ?? '');

                  return (
                    <Table.Row
                      key={record.id}
                      ref={isExpanded ? expandedPanelRef : null}
                      onKeyDown={isExpanded ? handlePanelKeyDown : undefined}
                      style={{
                        ...(status === 'הושלם' && !isExpanded ? { opacity: 0.55 } : {}),
                        ...(isExpanded ? { background: 'var(--indigo-a2)', outline: '2px solid var(--indigo-7)', outlineOffset: '-1px' } : {}),
                      }}
                    >
                      {/* WA */}
                      <Table.Cell>
                        {waLink ? (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="whatsapp-btn whatsapp-btn--sm"
                          >
                            WA
                          </a>
                        ) : (
                          <Text color="gray" size="1">—</Text>
                        )}
                      </Table.Cell>

                      {/* טלפון */}
                      <Table.Cell>
                        <Text size="2" style={{ fontFamily: 'monospace', direction: 'ltr', unicodeBidi: 'plaintext' }}>
                          {phone ?? '—'}
                        </Text>
                      </Table.Cell>

                      {/* סטטוס */}
                      <Table.Cell>
                        {isExpanded && followupsFields.status && statusChoices.length > 0 ? (
                          <select
                            className="cell-edit-select"
                            value={draftValues.status || ''}
                            onChange={(e) => setDraft('status', e.target.value || null)}
                          >
                            <option value="">—</option>
                            {statusChoices.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : status ? (
                          <Badge
                            color={STATUS_COLOR[status] ?? 'gray'}
                            variant="soft"
                            style={{ minWidth: 100, justifyContent: 'center' }}
                          >
                            {status}
                          </Badge>
                        ) : (
                          <Text color="gray" size="1">—</Text>
                        )}
                      </Table.Cell>

                      {/* פולואפ ראשון checkbox */}
                      <Table.Cell style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={check1}
                          disabled={isSaving1}
                          onChange={() => toggleCheckbox(record, followupsFields.firstCheck, check1)}
                          className="followup-checkbox"
                        />
                      </Table.Cell>

                      {/* תאריך פולואפ ראשון */}
                      <Table.Cell>
                        <Text size="2" style={{ color: isOverdue1 ? 'var(--red-9)' : undefined, fontWeight: isOverdue1 ? 600 : undefined }}>
                          {formatDate(date1)}
                        </Text>
                      </Table.Cell>

                      {/* פולואפ שני checkbox */}
                      <Table.Cell style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={check2}
                          disabled={isSaving2}
                          onChange={() => toggleCheckbox(record, followupsFields.secondCheck, check2)}
                          className="followup-checkbox"
                        />
                      </Table.Cell>

                      {/* תאריך פולואפ שני */}
                      <Table.Cell>
                        <Text size="2" style={{ color: isOverdue2 ? 'var(--red-9)' : undefined, fontWeight: isOverdue2 ? 600 : undefined }}>
                          {formatDate(date2)}
                        </Text>
                      </Table.Cell>

                      {/* שם ליד */}
                      <Table.Cell>
                        <Text size="2" weight="medium">{leadName}</Text>
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
      </div>

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
    </>
  );
}
