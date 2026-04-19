import React, { useMemo, useState } from 'react';
import { Card, Table, Badge, Text, Heading, Flex, Callout } from '@radix-ui/themes';

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

export default function ZoomMeetingsView({ meetingsRecords, meetingsTable, leadsRecords, period }) {
  const fields = useMemo(() => {
    if (!meetingsTable) return {};
    return {
      leadName:       meetingsTable.getFieldByNameIfExists('שם לקוח'),
      startTime:      meetingsTable.getFieldByNameIfExists('זמן התחלת פגישה'),
      isToday:        meetingsTable.getFieldByNameIfExists('האם פגישה היום'),
      link:           meetingsTable.getFieldByNameIfExists('קישור לפגישה'),
      reminderStatus:    meetingsTable.getFieldByNameIfExists('סטטוס תזכורת - כשעה לפני'),
      reminderSameDay:   meetingsTable.getFieldByNameIfExists('תזכורת - ביום הפגישה'),
    };
  }, [meetingsTable]);

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

  const kpiCards = [
    { id: 'total', label: 'סה"כ פגישות', value: periodFiltered.length, color: '#6366f1', icon: '📅' },
    { id: 'today', label: 'פגישות היום',  value: todayCount,                   color: '#10b981', icon: '✅' },
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

    <div className="ops-layout">
      <div className="ops-section">
        <Flex justify="between" align="center" mb="3">
          <Text size="4" weight="bold">פגישות זום</Text>
        </Flex>

        <div className="table-wrapper">
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>קישור לפגישה</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>תזכורת כשעה לפני</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>תזכורת ביום הפגישה</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>היום?</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>זמן פגישה</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>שם לקוח</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {sorted.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={6}>
                    <Text color="gray" align="center" style={{ display: 'block', padding: '24px' }}>
                      אין פגישות להצגה
                    </Text>
                  </Table.Cell>
                </Table.Row>
              )}
              {sorted.map(record => {
                const today    = isTodayMeeting(record, fields.isToday);
                const date     = getMeetingDate(record, fields.startTime);
                const leads    = fields.leadName ? record.getCellValue(fields.leadName) : null;
                const leadName = leads?.[0]?.name ?? '—';
                const link          = fields.link ? record.getCellValueAsString(fields.link) : '';
                const reminder      = fields.reminderStatus  ? record.getCellValueAsString(fields.reminderStatus)  : '';
                const reminderDay   = fields.reminderSameDay ? record.getCellValueAsString(fields.reminderSameDay) : '';

                return (
                  <Table.Row
                    key={record.id}
                    style={today ? { background: 'var(--green-a3)' } : undefined}
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

                    {/* תזכורת כשעה לפני */}
                    <Table.Cell>
                      {reminder === 'נשלחה'
                        ? <Text size="4" style={{ color: 'var(--green-9)', lineHeight: 1 }}>✓</Text>
                        : reminder
                          ? <Badge color={REMINDER_COLOR[reminder] ?? 'gray'} variant="soft" style={{ minWidth: '84px', justifyContent: 'center' }}>{reminder}</Badge>
                          : <Text color="gray" size="2">—</Text>
                      }
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
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </div>
      </div>
    </div>
    </>
  );
}
