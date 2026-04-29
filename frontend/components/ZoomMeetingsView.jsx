import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Card, Table, Badge, Text, Heading, Flex, Callout } from '@radix-ui/themes';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const CHART_TITLES = {
  week:  'פגישות זום — 7 ימים אחרונים',
  month: 'פגישות זום — 30 ימים אחרונים',
  year:  'פגישות זום — 12 חודשים אחרונים',
  all:   'פגישות זום — כל הזמן',
};

function buildMeetingChartData(records, startTimeField, period) {
  const today = new Date();

  if (period === 'year') {
    const buckets = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      buckets[`${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`] = 0;
    }
    for (const r of records) {
      const raw = r.getCellValue(startTimeField);
      if (!raw) continue;
      const d = new Date(raw);
      const key = `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
      if (key in buckets) buckets[key]++;
    }
    return Object.entries(buckets).map(([date, count]) => ({ date, פגישות: count }));
  }

  if (period === 'all') {
    let earliest = null;
    for (const r of records) {
      const raw = r.getCellValue(startTimeField);
      if (!raw) continue;
      const d = new Date(raw);
      if (!earliest || d < earliest) earliest = d;
    }
    if (!earliest) return [];
    const buckets = {};
    const cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 1);
    while (cursor <= end) {
      buckets[`${cursor.getMonth() + 1}/${String(cursor.getFullYear()).slice(2)}`] = 0;
      cursor.setMonth(cursor.getMonth() + 1);
    }
    for (const r of records) {
      const raw = r.getCellValue(startTimeField);
      if (!raw) continue;
      const d = new Date(raw);
      const key = `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
      if (key in buckets) buckets[key]++;
    }
    return Object.entries(buckets).map(([date, count]) => ({ date, פגישות: count }));
  }

  const dayCount = period === 'week' ? 7 : 30;
  const buckets = {};
  for (let i = dayCount - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    buckets[`${d.getMonth() + 1}/${d.getDate()}`] = 0;
  }
  for (const r of records) {
    const raw = r.getCellValue(startTimeField);
    if (!raw) continue;
    const d = new Date(raw);
    const diffDays = Math.floor((today - d) / 86400000);
    if (diffDays >= 0 && diffDays < dayCount) {
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      if (key in buckets) buckets[key]++;
    }
  }
  return Object.entries(buckets).map(([date, count]) => ({ date, פגישות: count }));
}

const REMINDER_COLOR = {
  'נשלחה':    'green',
  'לא נשלחה': 'red',
  'ממתין':    'yellow',
};

function isTodayMeeting(record, isToday) {
  if (!isToday) return false;
  return record.getCellValueAsString(isToday) === 'היום';
}

function getMeetingDate(record, startTime) {
  if (!startTime) return null;
  const raw = record.getCellValue(startTime);
  return raw ? new Date(raw) : null;
}

function formatDateTime(date) {
  if (!date) return '—';
  return date.toLocaleString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getPeriodRange(period) {
  const now = new Date();
  if (period === 'week') {
    const start = new Date(now); start.setDate(start.getDate() - 7); start.setHours(0,0,0,0);
    const end   = new Date(now); end.setDate(end.getDate() + 7);     end.setHours(23,59,59,999);
    return { start, end };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }
  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end   = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { start, end };
  }
  return null;
}

function CloseRateChart({ meetingsRecords, fields }) {
  const { closed, total } = useMemo(() => {
    if (!meetingsRecords?.length || !fields.dealClosed) return { closed: 0, total: 0 };
    const total = meetingsRecords.length;
    let closed = 0;
    for (const meeting of meetingsRecords) {
      if (meeting.getCellValue(fields.dealClosed) === true) closed++;
    }
    return { closed, total };
  }, [meetingsRecords, fields]);

  const rate = total > 0 ? Math.round((closed / total) * 100) : 0;
  const color = rate >= 40 ? 'var(--green-9)' : rate >= 20 ? 'var(--amber-9)' : 'var(--red-9)';
  const data = [{ value: rate }, { value: 100 - rate }];

  return (
    <Card className="chart-section">
      <Text size="4" weight="bold">יחס המרה — Close Rate</Text>
      <div className="chart-container" style={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="85%"
              startAngle={180}
              endAngle={0}
              innerRadius="58%"
              outerRadius="82%"
              dataKey="value"
              strokeWidth={0}
            >
              <Cell fill={color} />
              <Cell fill="var(--gray-4)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{
          position: 'absolute', bottom: 36,
          left: 0, right: 0, textAlign: 'center', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: '2.2rem', fontWeight: 700, color, lineHeight: 1 }}>{rate}%</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--gray-10)', marginTop: 5 }}>
            {closed} מתוך {total} פגישות סגרו
          </div>
          {total === 0 && (
            <div style={{ fontSize: '0.72rem', color: 'var(--gray-8)', marginTop: 4 }}>
              אין נתונים לתקופה זו
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function ZoomMeetingsView({ meetingsRecords, meetingsTable, leadsRecords, period }) {
  const leadsById = useMemo(
    () => new Map((leadsRecords ?? []).map(r => [r.id, r])),
    [leadsRecords]
  );
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

  const fields = useMemo(() => {
    if (!meetingsTable) return {};
    return {
      leadName:       meetingsTable.getFieldByNameIfExists('שם לקוח'),
      startTime:      meetingsTable.getFieldByNameIfExists('זמן התחלת פגישה'),
      isToday:        meetingsTable.getFieldByNameIfExists('האם פגישה היום'),
      link:           meetingsTable.getFieldByNameIfExists('קישור לפגישה'),
      reminderStatus:    meetingsTable.getFieldByNameIfExists('סטטוס תזכורת - כשעה לפני'),
      reminderSameDay:   meetingsTable.getFieldByNameIfExists('תזכורת - ביום הפגישה'),
      dealClosed:        meetingsTable.fields.find(f => f.name.includes('נסגרה')),
    };
  }, [meetingsTable]);

  const reminderStatusChoices = useMemo(
    () => fields.reminderStatus?.options?.choices?.map((c) => c.name) ?? ['נשלחה', 'לא נשלחה', 'ממתין'],
    [fields.reminderStatus]
  );

  function getDraftInitial(record) {
    const reminderVal = fields.reminderStatus ? record.getCellValue(fields.reminderStatus) : null;
    const reminderStr = reminderVal?.name ?? (typeof reminderVal === 'string' ? reminderVal : '') ?? '';
    return {
      reminderStatus: reminderStr || null,
      dealClosed: fields.dealClosed ? !!record.getCellValue(fields.dealClosed) : false,
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
    const record = (meetingsRecords ?? []).find((r) => r.id === currentId);
    if (!record) { closeExpand(); return; }
    isSavingRef.current = true;

    const draft = draftRef.current;
    const orig  = origRef.current;
    const updates = {};

    if (fields.reminderStatus && draft.reminderStatus !== orig.reminderStatus) {
      updates[fields.reminderStatus.id] = draft.reminderStatus ? { name: draft.reminderStatus } : null;
    }
    if (fields.dealClosed && draft.dealClosed !== orig.dealClosed) {
      updates[fields.dealClosed.id] = !!draft.dealClosed;
    }

    if (Object.keys(updates).length > 0) {
      try {
        setSaveError(null);
        await meetingsTable.updateRecordAsync(record, updates);
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

  const periodFiltered = useMemo(() => {
    if (!meetingsRecords) return [];
    const range = getPeriodRange(period);
    if (!range || !fields.startTime) return meetingsRecords;
    const { start, end } = range;
    return meetingsRecords.filter(r => {
      const d = getMeetingDate(r, fields.startTime);
      return d && d >= start && d <= end;
    });
  }, [meetingsRecords, period, fields.startTime]);

  const sorted = useMemo(() => {
    if (!periodFiltered || !fields.startTime) return periodFiltered ?? [];
    const now = Date.now();
    return [...periodFiltered].sort((a, b) => {
      const da = getMeetingDate(a, fields.startTime);
      const db = getMeetingDate(b, fields.startTime);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return Math.abs(da - now) - Math.abs(db - now);
    });
  }, [periodFiltered, fields.startTime]);

  const todayCount = useMemo(
    () => sorted.filter(r => isTodayMeeting(r, fields.isToday)).length,
    [sorted, fields.isToday]
  );

  const chartData = useMemo(() => {
    if (!fields.startTime || !meetingsRecords) return [];
    return buildMeetingChartData(meetingsRecords, fields.startTime, period);
  }, [meetingsRecords, fields.startTime, period]);

  const kpiCards = [
    { id: 'total', label: 'סה"כ פגישות', value: periodFiltered.length, color: '#2196b0', icon: '📅' },
    { id: 'today', label: 'פגישות היום',  value: todayCount,            color: '#10b981', icon: '✅' },
  ];

  if (!meetingsTable) {
    return (
      <div className="ops-layout">
        <Callout.Root color="red"><Callout.Text>לא נמצאה טבלת "פגישות בזום".</Callout.Text></Callout.Root>
      </div>
    );
  }

  return (
    <>
      <div className="kpi-bar">
        {kpiCards.map(({ id, label, value, color, icon }) => (
          <Card key={id} className="kpi-card" style={{ borderTop: `3px solid ${color}` }}>
            <Flex direction="column" align="end" gap="1">
              <Text size="4">{icon}</Text>
              <Heading size="7" style={{ color, lineHeight: 1 }}>{value}</Heading>
              <Text size="1" color="gray">{label}</Text>
            </Flex>
          </Card>
        ))}
      </div>

      <div className="analytics-row">
        <Card className="chart-section">
          <Text size="4" weight="bold">{CHART_TITLES[period] ?? 'פגישות זום לאורך זמן'}</Text>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-4)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'var(--gray-10)', fontSize: 11 }}
                  tickLine={false}
                  interval={period === 'week' ? 0 : (period === 'year' || period === 'all') ? 1 : 4}
                />
                <YAxis
                  tick={{ fill: 'var(--gray-10)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-panel-solid)',
                    border: '1px solid var(--gray-6)',
                    borderRadius: 8,
                    color: 'var(--gray-12)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="פגישות"
                  stroke="var(--indigo-9)"
                  strokeWidth={2.5}
                  dot={period === 'week'}
                  activeDot={{ r: 5, fill: 'var(--indigo-9)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <CloseRateChart meetingsRecords={periodFiltered} fields={fields} />
        <div className="analytics-empty" />
      </div>

      <div className="ops-layout">
        <div className="ops-section">
          <Flex justify="between" align="center" mb="3">
            <Text size="4" weight="bold">פגישות זום</Text>
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
                  <Table.ColumnHeaderCell>קישור לפגישה</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>נסגרה עסקה?</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>תזכורת כשעה לפני</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>תזכורת ביום הפגישה</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>היום?</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>זמן פגישה</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>שם לקוח</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ width: 36 }}></Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {sorted.length === 0 && (
                  <Table.Row>
                    <Table.Cell colSpan={8}>
                      <Text color="gray" align="center" style={{ display: 'block', padding: '24px' }}>
                        אין פגישות להצגה
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                )}
                {sorted.map(record => {
                  const isExpanded = expandedRow === record.id;
                  const today      = isTodayMeeting(record, fields.isToday);
                  const date       = getMeetingDate(record, fields.startTime);
                  const leads      = fields.leadName ? record.getCellValue(fields.leadName) : null;
                  const leadName   = leadsById.get(leads?.[0]?.id)?.name ?? '—';
                  const link       = fields.link ? record.getCellValueAsString(fields.link) : '';
                  const reminder   = fields.reminderStatus  ? record.getCellValueAsString(fields.reminderStatus)  : '';
                  const reminderDay = fields.reminderSameDay ? record.getCellValueAsString(fields.reminderSameDay) : '';
                  const dealClosed  = fields.dealClosed ? record.getCellValue(fields.dealClosed) : null;

                  return (
                    <Table.Row
                      key={record.id}
                      ref={isExpanded ? expandedPanelRef : null}
                      onKeyDown={isExpanded ? handlePanelKeyDown : undefined}
                      style={{
                        ...(today && !isExpanded ? { background: 'var(--green-a3)' } : {}),
                        ...(isExpanded ? { background: 'var(--indigo-a2)', outline: '2px solid var(--indigo-7)', outlineOffset: '-1px' } : {}),
                      }}
                    >
                      {/* קישור לפגישה */}
                      <Table.Cell>
                        {link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="zoom-join-btn zoom-join-btn--sq"
                            title={link}
                          >
                            הצטרף
                          </a>
                        ) : (
                          <Text color="gray" size="1">—</Text>
                        )}
                      </Table.Cell>

                      {/* נסגרה עסקה */}
                      <Table.Cell>
                        {isExpanded && fields.dealClosed ? (
                          <button
                            className={`msg-checkbox${draftValues.dealClosed ? ' msg-checkbox--checked' : ''}`}
                            onClick={() => setDraft('dealClosed', !draftValues.dealClosed)}
                            title={draftValues.dealClosed ? 'בטל סגירה' : 'סמן כסגור'}
                          >
                            {draftValues.dealClosed && (
                              <svg viewBox="0 0 12 10" width="10" height="10" fill="none">
                                <polyline points="1,5 4.5,8.5 11,1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                        ) : dealClosed === true ? (
                          <Badge color="green" variant="solid">סגור</Badge>
                        ) : (
                          <Text color="gray" size="2">—</Text>
                        )}
                      </Table.Cell>

                      {/* תזכורת כשעה לפני */}
                      <Table.Cell>
                        {isExpanded && fields.reminderStatus && reminderStatusChoices.length > 0 ? (
                          <select
                            className="cell-edit-select"
                            value={draftValues.reminderStatus || ''}
                            onChange={(e) => setDraft('reminderStatus', e.target.value || null)}
                          >
                            <option value="">—</option>
                            {reminderStatusChoices.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : reminder === 'נשלחה' ? (
                          <Text size="4" style={{ color: 'var(--green-9)', lineHeight: 1 }}>✓</Text>
                        ) : reminder ? (
                          <Badge color={REMINDER_COLOR[reminder] ?? 'gray'} variant="soft" style={{ minWidth: '84px', justifyContent: 'center' }}>{reminder}</Badge>
                        ) : (
                          <Text color="gray" size="2">—</Text>
                        )}
                      </Table.Cell>

                      {/* תזכורת ביום הפגישה */}
                      <Table.Cell>
                        {reminderDay === 'checked'
                          ? <Text size="4" style={{ color: 'var(--green-9)', lineHeight: 1 }}>✓</Text>
                          : reminderDay
                            ? <Badge color={REMINDER_COLOR[reminderDay] ?? 'gray'} variant="soft">{reminderDay}</Badge>
                            : <Text color="gray" size="2">—</Text>
                        }
                      </Table.Cell>

                      {/* היום? */}
                      <Table.Cell>
                        {today
                          ? <Badge color="green" variant="solid">היום</Badge>
                          : <Text color="gray" size="2">לא היום</Text>
                        }
                      </Table.Cell>

                      {/* זמן פגישה */}
                      <Table.Cell>
                        <Text color="gray" size="1" style={{ whiteSpace: 'nowrap' }}>
                          {formatDateTime(date)}
                        </Text>
                      </Table.Cell>

                      {/* שם לקוח */}
                      <Table.Cell>
                        <Flex align="center" justify="center" gap="2">
                          {today && <Badge color="green" size="1">היום!</Badge>}
                          <Text size="2">{leadName}</Text>
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
