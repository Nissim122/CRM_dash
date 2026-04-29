import React, { useMemo } from 'react';
import { Card, Text } from '@radix-ui/themes';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Cell, LabelList,
} from 'recharts';

const PALETTE = [
  'var(--blue-9)',
  'var(--green-9)',
  'var(--purple-9)',
  'var(--amber-9)',
  'var(--red-9)',
  'var(--cyan-9)',
  'var(--pink-9)',
];

export default function ProjectStatusChart({ customersRecords, customersFields }) {
  const data = useMemo(() => {
    if (!customersFields.projectStatus) return [];
    const choices = customersFields.projectStatus.options?.choices ?? [];
    const counts = Object.fromEntries(choices.map((c) => [c.name, 0]));
    for (const record of customersRecords) {
      const val = record.getCellValue(customersFields.projectStatus)?.name;
      if (val && val in counts) counts[val]++;
    }
    return choices.map((c, i) => ({
      name: c.name,
      count: counts[c.name],
      fill: PALETTE[i % PALETTE.length],
    }));
  }, [customersRecords, customersFields]);

  if (!customersFields.projectStatus || data.length === 0) return null;

  const chartHeight = Math.max(160, data.length * 44);

  return (
    <Card className="chart-section">
      <Text size="4" weight="bold">פילוג לפי סטטוס פרוייקט</Text>
      <div className="chart-container" style={{ marginTop: 16 }}>
        <ResponsiveContainer width="100%" height={chartHeight}>
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
              width={100}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-panel-solid)',
                border: '1px solid var(--gray-6)',
                borderRadius: 8,
                color: 'var(--gray-12)',
              }}
              formatter={(value) => [value, 'לקוחות']}
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
