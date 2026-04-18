import React, { useMemo } from 'react';
import { Card, Text, Heading, Flex } from '@radix-ui/themes';
import { useGlobalConfig } from '@airtable/blocks/ui';

const RESPONSE_TIMES_KEY = 'leadResponseTimestamps';

function formatAvg(ms) {
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} דקות`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)} שעות`;
  return `${(ms / 86_400_000).toFixed(1)} ימים`;
}

const CLOSED_STATUS  = 'נרשם כלקוח';
const ACTIVE_STATUSES = ['נוצר קשר', 'לא נוצר קשר', 'שיתוף פעולה'];

const CARD_META = {
  leads:       { color: '#6366f1', icon: '📥' },
  closed:      { color: '#10b981', icon: '✅' },
  conversion:  { color: '#f59e0b', icon: '📊' },
  active:      { color: '#ef4444', icon: '🔔' },
  avgResponse: { color: '#f43f5e', icon: '⏱' },
};

const PERIOD_LABEL = { week: 'השבוע', month: 'החודש', year: 'השנה', all: 'תמיד' };

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

export default function KpiBar({ records, fields, period = 'month' }) {
  const gConfig = useGlobalConfig();
  const responseTimes = gConfig.get(RESPONSE_TIMES_KEY) ?? {};

  const avgResponseMs = useMemo(() => {
    const entries = Object.values(responseTimes);
    if (!entries.length) return null;
    const total = entries.reduce((sum, e) => sum + (e.changedAt - e.createdAt), 0);
    return total / entries.length;
  }, [responseTimes]);

  const stats = useMemo(() => {
    const startDate = getPeriodStart(period);
    let newInPeriod = 0;
    let closedInPeriod = 0;
    let activeLeads = 0;

    for (const record of records) {
      const createdRaw = fields.createdTime
        ? record.getCellValue(fields.createdTime)
        : record.createdTime;
      const created = createdRaw ? new Date(createdRaw) : null;
      const status   = fields.status ? record.getCellValue(fields.status)?.name : null;

      if (created && created >= startDate) {
        newInPeriod++;
        if (status === CLOSED_STATUS) closedInPeriod++;
      }
      if (ACTIVE_STATUSES.includes(status)) activeLeads++;
    }

    const conversion = newInPeriod > 0
      ? Math.round((closedInPeriod / newInPeriod) * 100)
      : 0;

    return { newInPeriod, closedInPeriod, conversion, activeLeads };
  }, [records, fields, period]);

  const p = PERIOD_LABEL[period];

  const cards = [
    { id: 'leads',       label: `מספר לידים ${p}`,     value: stats.newInPeriod },
    { id: 'closed',      label: `נסגרו כלקוחות ${p}`, value: stats.closedInPeriod },
    { id: 'conversion',  label: 'אחוז המרה',           value: `${stats.conversion}%` },
    { id: 'active',      label: 'לידים פעילים',        value: stats.activeLeads },
    { id: 'avgResponse', label: 'ממוצע זמן חזרה',      value: avgResponseMs != null ? formatAvg(avgResponseMs) : '—' },
  ];

  return (
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
  );
}
