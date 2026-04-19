import React, { useMemo } from 'react';
import { Card, Text } from '@radix-ui/themes';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer,
} from 'recharts';

const MONTH_NAMES = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

const CHART_TITLES = {
  week:  'הכנסות — 7 ימים אחרונים',
  month: 'הכנסות — 30 ימים אחרונים',
  year:  'צמיחת הכנסות — 12 חודשים',
  all:   'צמיחת הכנסות — כל הזמן',
};

function buildDayBuckets(count) {
  const today = new Date();
  const buckets = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    buckets.push({
      key:    `${d.getMonth() + 1}/${d.getDate()}`,
      label:  `${d.getMonth() + 1}/${d.getDate()}`,
      הכנסות: 0,
    });
  }
  return buckets;
}

function buildMonthBuckets(count) {
  const today = new Date();
  const buckets = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    buckets.push({
      key:    `${d.getFullYear()}-${d.getMonth()}`,
      label:  `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      הכנסות: 0,
    });
  }
  return buckets;
}

function getPaidPayments(paymentsRecords, paymentsFields) {
  if (!paymentsFields?.status || !paymentsFields?.dueDate || !paymentsFields?.amount) return [];
  return paymentsRecords.filter((p) => {
    const st = p.getCellValue(paymentsFields.status);
    return st?.name === 'שולם בפועל';
  });
}

export default function RevenueBarChart({ salesRecords, salesFields, paymentsRecords = [], paymentsFields = {}, period = 'year' }) {
  const data = useMemo(() => {
    const today = new Date();
    const paidPayments = getPaidPayments(paymentsRecords, paymentsFields);

    function addPaymentRevenue(bucketMap, keyFn) {
      for (const p of paidPayments) {
        const dateRaw = paymentsFields.dueDate ? p.getCellValue(paymentsFields.dueDate) : null;
        if (!dateRaw) continue;
        const d = new Date(dateRaw);
        const key = keyFn(d);
        const bucket = bucketMap.get(key);
        if (bucket) bucket.הכנסות += paymentsFields.amount ? (p.getCellValue(paymentsFields.amount) ?? 0) : 0;
      }
    }

    if (period === 'week' || period === 'month') {
      const dayCount  = period === 'week' ? 7 : 30;
      const buckets   = buildDayBuckets(dayCount);
      const bucketMap = new Map(buckets.map((b) => [b.key, b]));
      addPaymentRevenue(bucketMap, (d) => {
        const diffDays = Math.floor((today - d) / 86400000);
        return (diffDays >= 0 && diffDays < dayCount) ? `${d.getMonth() + 1}/${d.getDate()}` : null;
      });
      return buckets;
    }

    if (period === 'year') {
      const buckets   = buildMonthBuckets(12);
      const bucketMap = new Map(buckets.map((b) => [b.key, b]));
      addPaymentRevenue(bucketMap, (d) => `${d.getFullYear()}-${d.getMonth()}`);
      return buckets;
    }

    // period === 'all'
    let earliest = null;
    for (const p of paidPayments) {
      const raw = paymentsFields.dueDate ? p.getCellValue(paymentsFields.dueDate) : null;
      if (!raw) continue;
      const d = new Date(raw);
      if (!earliest || d < earliest) earliest = d;
    }
    if (!earliest) return [];

    const buckets = [];
    const cursor  = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    const end     = new Date(today.getFullYear(), today.getMonth(), 1);
    while (cursor <= end) {
      buckets.push({
        key:    `${cursor.getFullYear()}-${cursor.getMonth()}`,
        label:  `${MONTH_NAMES[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`,
        הכנסות: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const bucketMap = new Map(buckets.map((b) => [b.key, b]));
    addPaymentRevenue(bucketMap, (d) => `${d.getFullYear()}-${d.getMonth()}`);
    return buckets;
  }, [paymentsRecords, paymentsFields, period]);

  const xAxisInterval = period === 'week' ? 0
    : period === 'month' ? 4
    : (period === 'year' || data.length <= 14) ? 1
    : Math.ceil(data.length / 12);

  return (
    <Card className="chart-section">
      <Text size="4" weight="bold">{CHART_TITLES[period]}</Text>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-4)" />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--gray-10)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval={xAxisInterval}
            />
            <YAxis
              tick={{ fill: 'var(--gray-10)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-panel-solid)',
                border: '1px solid var(--gray-6)',
                borderRadius: 8,
                color: 'var(--gray-12)',
              }}
              formatter={(value) => [`₪${Number(value).toLocaleString('he-IL')}`, 'הכנסות']}
            />
            <Line
              type="monotone"
              dataKey="הכנסות"
              stroke="var(--amber-9)"
              strokeWidth={2.5}
              dot={period === 'week' ? true : false}
              activeDot={{ r: 5, fill: 'var(--amber-9)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
