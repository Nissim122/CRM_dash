import React, { useMemo } from 'react';
import { Card, Text } from '@radix-ui/themes';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Cell, LabelList,
} from 'recharts';

const STATUSES = [
  { key: 'נוצר קשר',    fill: 'var(--blue-9)'   },
  { key: 'לא נוצר קשר', fill: 'var(--amber-9)'  },
  { key: 'שיתוף פעולה', fill: 'var(--purple-9)' },
  { key: 'נרשם כלקוח',  fill: 'var(--green-9)'  },
  { key: 'לא רלוונטי',  fill: 'var(--red-9)'    },
];

function getPeriodStart(period) {
  const now = new Date();
  if (period === 'week')  { const d = new Date(now); d.setDate(now.getDate() - 7); return d; }
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'year')  return new Date(now.getFullYear(), 0, 1);
  return null;
}

export default function LeadFunnel({ records, fields, period = 'month' }) {
  const data = useMemo(() => {
    const start = getPeriodStart(period);
    const counts = Object.fromEntries(STATUSES.map(s => [s.key, 0]));

    for (const record of records) {
      const status = fields.status ? record.getCellValueAsString(fields.status) : '';
      if (!(status in counts)) continue;
      if (start) {
        const raw = fields.createdTime
          ? record.getCellValue(fields.createdTime)
          : record.createdTime;
        if (!raw || new Date(raw) < start) continue;
      }
      counts[status]++;
    }

    return STATUSES.map(s => ({ name: s.key, count: counts[s.key], fill: s.fill }));
  }, [records, fields, period]);

  return (
    <Card className="chart-section">
      <Text size="4" weight="bold">פאנל לידים לפי סטטוס</Text>
      <div className="chart-container" style={{ marginTop: 16 }}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-4)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: 'var(--gray-10)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: 'var(--gray-10)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={86}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-panel-solid)',
                border: '1px solid var(--gray-6)',
                borderRadius: 8,
                color: 'var(--gray-12)',
              }}
              formatter={(value) => [value, 'לידים']}
            />
            <Bar dataKey="count" radius={4}>
              <LabelList
                dataKey="count"
                position="right"
                style={{ fill: 'var(--gray-11)', fontSize: 11 }}
              />
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
