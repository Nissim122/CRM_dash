import React, { useMemo } from 'react';
import { Card, Text } from '@radix-ui/themes';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
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
        <div className="chart-container" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: 16 }}>
          <div style={{ flex: '0 0 auto', position: 'relative', width: 180, height: 220 }}>
            <ResponsiveContainer width={180} height={220}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  labelLine={false}
                  label={false}
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
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-12)' }}>{total}</div>
              <div style={{ fontSize: 10, color: 'var(--gray-9)' }}>לידים</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', direction: 'rtl' }}>
            {data.map((entry, i) => {
              const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: SOURCE_COLORS[i % SOURCE_COLORS.length], flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>{entry.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
