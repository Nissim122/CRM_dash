import React, { useMemo } from 'react';
import { Card, Text } from '@radix-ui/themes';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer,
} from 'recharts';

const CHART_TITLES = {
  week:  'מגמת לידים — 7 ימים אחרונים',
  month: 'מגמת לידים — 30 ימים אחרונים',
  year:  'מגמת לידים — 12 חודשים אחרונים',
};

function buildDayBuckets(count) {
  const today = new Date();
  const buckets = {};
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    buckets[`${d.getMonth() + 1}/${d.getDate()}`] = 0;
  }
  return buckets;
}

function buildMonthBuckets() {
  const today = new Date();
  const buckets = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    buckets[`${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`] = 0;
  }
  return buckets;
}

export default function TrendChart({ records, fields, period = 'month' }) {
  const data = useMemo(() => {
    const today = new Date();

    if (period === 'year') {
      const buckets = buildMonthBuckets();
      for (const record of records) {
        const createdRaw = fields.createdTime
          ? record.getCellValue(fields.createdTime)
          : record.createdTime;
        if (!createdRaw) continue;
        const created = new Date(createdRaw);
        const key = `${created.getMonth() + 1}/${String(created.getFullYear()).slice(2)}`;
        if (key in buckets) buckets[key]++;
      }
      return Object.entries(buckets).map(([date, count]) => ({ date, לידים: count }));
    }

    const dayCount = period === 'week' ? 7 : 30;
    const buckets = buildDayBuckets(dayCount);

    for (const record of records) {
      const createdRaw = fields.createdTime
        ? record.getCellValue(fields.createdTime)
        : record.createdTime;
      if (!createdRaw) continue;
      const created = new Date(createdRaw);
      const diffDays = Math.floor((today - created) / 86400000);
      if (diffDays >= 0 && diffDays < dayCount) {
        const key = `${created.getMonth() + 1}/${created.getDate()}`;
        if (key in buckets) buckets[key]++;
      }
    }

    return Object.entries(buckets).map(([date, count]) => ({ date, לידים: count }));
  }, [records, fields, period]);

  return (
    <Card className="chart-section">
      <Text size="4" weight="bold">{CHART_TITLES[period]}</Text>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-4)" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--gray-10)', fontSize: 11 }}
              tickLine={false}
              interval={period === 'week' ? 0 : period === 'year' ? 1 : 4}
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
              dataKey="לידים"
              stroke="var(--indigo-9)"
              strokeWidth={2.5}
              dot={period === 'week'}
              activeDot={{ r: 5, fill: 'var(--indigo-9)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
