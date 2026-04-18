import React, { useMemo } from 'react';
import { Card, Text } from '@radix-ui/themes';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const SOURCE_COLORS = [
  '#6366f1', '#22d3ee', '#f59e0b', '#10b981',
  '#f43f5e', '#a78bfa', '#fb923c', '#34d399',
];

function getPeriodStart(period) {
  const now = new Date();
  if (period === 'week')  { const d = new Date(now); d.setDate(now.getDate() - 7); return d; }
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'year')  return new Date(now.getFullYear(), 0, 1);
  return null;
}

const RADIAN = Math.PI / 180;
function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.05) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function LeadSourceChart({ records, fields, period = 'month' }) {
  const data = useMemo(() => {
    if (!fields.leadSource) return [];
    const start = getPeriodStart(period);
    const counts = {};

    for (const record of records) {
      if (start) {
        const raw = fields.createdTime
          ? record.getCellValue(fields.createdTime)
          : record.createdTime;
        if (!raw || new Date(raw) < start) continue;
      }
      const source = record.getCellValueAsString(fields.leadSource) || 'לא ידוע';
      counts[source] = (counts[source] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [records, fields, period]);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card className="chart-section">
      <Text size="4" weight="bold">מקורות לידים</Text>
      {(!fields.leadSource || data.length === 0) ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220, color: 'var(--gray-9)', fontSize: 13 }}>
          {!fields.leadSource ? 'שדה "מקור ליד" לא נמצא' : 'אין נתונים לתקופה זו'}
        </div>
      ) : (
        <div className="chart-container" style={{ marginTop: 16, position: 'relative' }}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                dataKey="value"
                labelLine={false}
                label={renderCustomLabel}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--color-panel-solid)',
                  border: '1px solid var(--gray-6)',
                  borderRadius: 8,
                  color: 'var(--gray-12)',
                  direction: 'rtl',
                }}
                formatter={(value, name) => [`${value} (${((value / total) * 100).toFixed(1)}%)`, name]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, color: 'var(--gray-11)', paddingTop: 4 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -68%)',
            textAlign: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-12)' }}>{total}</div>
            <div style={{ fontSize: 10, color: 'var(--gray-9)' }}>לידים</div>
          </div>
        </div>
      )}
    </Card>
  );
}
