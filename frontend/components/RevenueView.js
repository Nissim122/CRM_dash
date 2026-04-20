import React, { useMemo, useState } from 'react';
import { Card, Text, Heading, Flex, Table } from '@radix-ui/themes';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import RevenueBarChart from './RevenueBarChart';

const PERIOD_LABEL = { week: 'השבוע', month: 'החודש', year: 'השנה', all: 'תמיד' };

const CARD_META = {
  revenue: { color: 'var(--amber-9)' },
  sales:   { color: 'var(--indigo-9)' },
  avg:     { color: 'var(--violet-9)' },
  debt:    { color: 'var(--red-9)' },
};

const PIE_COLORS = ['var(--green-9)', 'var(--amber-9)'];

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

const STATUS_BADGE = {
  'שולם בפועל': 'paid',
};

function PaymentsModal({ sale, payments, paymentsFields, customerName, salesFields, onClose }) {
  const totalDeal = salesFields.totalDeal ? (Number(sale.getCellValue(salesFields.totalDeal)) || 0) : 0;
  const totalPaid = salesFields.totalPaid ? (Number(sale.getCellValue(salesFields.totalPaid)) || 0) : 0;
  const balance   = totalDeal - totalPaid;
  const dateRaw   = salesFields.date ? sale.getCellValue(salesFields.date) : null;
  const dateStr   = dateRaw ? new Date(dateRaw).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

  return (
    <div className="interactions-overlay" onClick={onClose}>
      <div
        className="interactions-modal"
        style={{ width: 580, maxHeight: '82vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="interactions-modal__header">
          <button className="interactions-modal__close" onClick={onClose}>✕</button>
          <span className="interactions-modal__title">תשלומים — {customerName}</span>
          <div style={{ width: 28 }} />
        </div>

        <div style={{
          display: 'flex', gap: 28, padding: '10px 18px',
          borderBottom: '1px solid var(--gray-5)',
          fontSize: '0.82rem', color: 'var(--gray-11)',
        }}>
          <span>תאריך: <strong style={{ color: 'var(--gray-12)' }}>{dateStr}</strong></span>
          <span>עסקה: <strong style={{ color: 'var(--amber-11)' }}>₪{totalDeal.toLocaleString('he-IL')}</strong></span>
          <span>שולם: <strong style={{ color: 'var(--green-11)' }}>₪{totalPaid.toLocaleString('he-IL')}</strong></span>
          {balance > 0 && (
            <span>יתרה: <strong style={{ color: 'var(--red-11)' }}>₪{balance.toLocaleString('he-IL')}</strong></span>
          )}
        </div>

        <div className="interactions-modal__body">
          {payments.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--gray-9)', fontSize: '0.875rem' }}>
              לא נמצאו תשלומים לעסקה זו
            </div>
          ) : (
            <table className="payments-sub-table" style={{ fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th>מס׳</th>
                  <th>סכום</th>
                  <th>תאריך יעד</th>
                  <th>סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const numRaw  = paymentsFields.paymentNumber ? p.getCellValue(paymentsFields.paymentNumber) : null;
                  const num     = numRaw != null ? (typeof numRaw === 'object' ? (numRaw.name ?? '—') : numRaw) : null;
                  const amount  = paymentsFields.amount  ? (Number(p.getCellValue(paymentsFields.amount)) || 0) : 0;
                  const due     = paymentsFields.dueDate  ? p.getCellValue(paymentsFields.dueDate)  : null;
                  const dueStr  = due ? new Date(due).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
                  const st      = paymentsFields.status  ? p.getCellValue(paymentsFields.status)  : null;
                  const stName  = st?.name ?? '—';
                  const variant = STATUS_BADGE[stName] ?? 'pending';
                  return (
                    <tr key={p.id}>
                      <td style={{ textAlign: 'center' }}>{num ?? '—'}</td>
                      <td style={{ textAlign: 'center', color: 'var(--amber-11)', fontWeight: 600 }}>
                        {amount ? `₪${amount.toLocaleString('he-IL')}` : '—'}
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--gray-10)' }}>{dueStr}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`payment-badge payment-badge--${variant}`}>{stName}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RevenueView({
  salesRecords, salesFields,
  paymentsRecords, paymentsFields,
  customersRecords, customersFields,
  period,
}) {
  const [selectedSale, setSelectedSale] = useState(null);

  const periodLabel = PERIOD_LABEL[period];
  const startDate = useMemo(() => getPeriodStart(period), [period]);

  const customersById = useMemo(
    () => new Map((customersRecords ?? []).map((r) => [r.id, r])),
    [customersRecords]
  );

  const stats = useMemo(() => {
    let revenueInPeriod = 0;
    let salesInPeriod = 0;
    let totalDealInPeriod = 0;
    let openDebt = 0;

    for (const s of (salesRecords ?? [])) {
      const dateRaw = salesFields.date ? s.getCellValue(salesFields.date) : null;
      if (dateRaw && new Date(dateRaw) >= startDate) {
        salesInPeriod++;
        totalDealInPeriod += salesFields.totalDeal ? (Number(s.getCellValue(salesFields.totalDeal)) || 0) : 0;
      }
    }

    for (const p of (paymentsRecords ?? [])) {
      const st     = paymentsFields?.status  ? p.getCellValue(paymentsFields.status)  : null;
      const amount = paymentsFields?.amount  ? (Number(p.getCellValue(paymentsFields.amount)) || 0) : 0;
      const dateRaw = paymentsFields?.dueDate ? p.getCellValue(paymentsFields.dueDate) : null;
      if (st?.name === 'שולם בפועל' && dateRaw && new Date(dateRaw) >= startDate) {
        revenueInPeriod += amount;
      }
      if (st?.name !== 'שולם בפועל') {
        openDebt += amount;
      }
    }

    return {
      revenueInPeriod,
      salesInPeriod,
      avgDeal: salesInPeriod > 0 ? Math.round(totalDealInPeriod / salesInPeriod) : 0,
      openDebt,
    };
  }, [salesRecords, salesFields, paymentsRecords, paymentsFields, startDate]);

  const productChartData = useMemo(() => {
    const map = new Map();
    for (const s of (salesRecords ?? [])) {
      const dateRaw = salesFields.date ? s.getCellValue(salesFields.date) : null;
      if (!dateRaw || new Date(dateRaw) < startDate) continue;
      const products = salesFields.products ? (s.getCellValue(salesFields.products) ?? []) : [];
      const deal = salesFields.totalDeal ? (Number(s.getCellValue(salesFields.totalDeal)) || 0) : 0;
      if (products.length === 0) {
        map.set('ללא מוצר', (map.get('ללא מוצר') ?? 0) + deal);
      } else {
        const share = deal / products.length;
        for (const p of products) {
          map.set(p.name, (map.get(p.name) ?? 0) + share);
        }
      }
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [salesRecords, salesFields, startDate]);

  const paymentStatusData = useMemo(() => {
    let paid = 0;
    let pending = 0;
    for (const p of (paymentsRecords ?? [])) {
      const st = paymentsFields?.status ? p.getCellValue(paymentsFields.status) : null;
      const amount = paymentsFields?.amount ? (Number(p.getCellValue(paymentsFields.amount)) || 0) : 0;
      if (st?.name === 'שולם בפועל') paid += amount;
      else pending += amount;
    }
    return [
      { name: 'שולם', value: paid },
      { name: 'ממתין', value: pending },
    ];
  }, [paymentsRecords, paymentsFields]);

  const paymentsBySaleId = useMemo(() => {
    const map = new Map();
    if (!paymentsFields?.projectLink) return map;
    for (const p of (paymentsRecords ?? [])) {
      const links = p.getCellValue(paymentsFields.projectLink) ?? [];
      for (const link of links) {
        if (!map.has(link.id)) map.set(link.id, []);
        map.get(link.id).push(p);
      }
    }
    return map;
  }, [paymentsRecords, paymentsFields]);

  const selectedSalePayments = useMemo(() => {
    if (!selectedSale) return [];
    return paymentsBySaleId.get(selectedSale.id) ?? [];
  }, [selectedSale, paymentsBySaleId]);

  const selectedCustomerName = useMemo(() => {
    if (!selectedSale) return '—';
    const custLinks = salesFields.customersLink ? (selectedSale.getCellValue(salesFields.customersLink) ?? []) : [];
    const custRecord = custLinks[0] ? customersById.get(custLinks[0].id) : null;
    const leadLinks = custRecord && customersFields?.lead ? custRecord.getCellValue(customersFields.lead) : null;
    return leadLinks?.[0]?.name ?? custLinks[0]?.name ?? '—';
  }, [selectedSale, salesFields, customersById, customersFields]);

  const salesInPeriod = useMemo(() => {
    return (salesRecords ?? [])
      .filter((s) => {
        if (period === 'all') return true;
        const dateRaw = salesFields.date ? s.getCellValue(salesFields.date) : null;
        return dateRaw && new Date(dateRaw) >= startDate;
      })
      .sort((a, b) => {
        const da = salesFields.date ? new Date(a.getCellValue(salesFields.date) ?? 0) : 0;
        const db = salesFields.date ? new Date(b.getCellValue(salesFields.date) ?? 0) : 0;
        return db - da;
      });
  }, [salesRecords, salesFields, startDate, period]);

  const cards = [
    { id: 'revenue', value: `₪${stats.revenueInPeriod.toLocaleString('he-IL')}`, label: `הכנסות ${periodLabel}` },
    { id: 'sales',   value: stats.salesInPeriod,                                  label: `מכירות ${periodLabel}` },
    { id: 'avg',     value: stats.avgDeal ? `₪${stats.avgDeal.toLocaleString('he-IL')}` : '—', label: `ממוצע עסקה ${periodLabel}` },
    { id: 'debt',    value: `₪${stats.openDebt.toLocaleString('he-IL')}`,          label: 'חוב פתוח (הכל)' },
  ];

  const tooltipStyle = {
    contentStyle: {
      background: 'var(--color-panel-solid)',
      border: '1px solid var(--gray-6)',
      borderRadius: 8,
      color: 'var(--gray-12)',
    },
  };

  return (
    <>
      <div className="kpi-bar">
        {cards.map(({ id, value, label }) => {
          const { color } = CARD_META[id];
          return (
            <Card key={id} className="kpi-card" style={{ borderTop: `3px solid ${color}` }}>
              <Flex direction="column" align="end" gap="1">
                <Heading size="7" style={{ color, lineHeight: 1 }}>{value}</Heading>
                <Text size="1" color="gray">{label}</Text>
              </Flex>
            </Card>
          );
        })}
      </div>

      <div className="analytics-row">
        <RevenueBarChart
          salesRecords={salesRecords}
          salesFields={salesFields}
          paymentsRecords={paymentsRecords ?? []}
          paymentsFields={paymentsFields}
          period={period}
        />

        <Card className="chart-section">
          <Text size="4" weight="bold">הכנסות לפי מוצר</Text>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={productChartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-4)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'var(--gray-10)', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--gray-10)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                  width={36}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v) => [`₪${Number(v).toLocaleString('he-IL')}`, 'הכנסות']}
                />
                <Bar dataKey="value" fill="var(--indigo-9)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="chart-section">
          <Text size="4" weight="bold">סטטוס תשלומים</Text>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={paymentStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={82}
                  dataKey="value"
                  label={({ name, percent }) =>
                    percent > 0.04 ? `${name} ${Math.round(percent * 100)}%` : ''
                  }
                  labelLine={false}
                >
                  {paymentStatusData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v) => [`₪${Number(v).toLocaleString('he-IL')}`]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="ops-section">
        <Flex justify="between" align="center" mb="3">
          <Text size="4" weight="bold">רשימת מכירות — {periodLabel}</Text>
          <Text size="2" color="gray">{salesInPeriod.length} רשומות</Text>
        </Flex>
        <div className="table-wrapper">
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>סטטוס</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>יתרה</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>שולם</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>סכום עסקה</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>מוצרים</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>תאריך</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>לקוח</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {salesInPeriod.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={7}>
                    <Text color="gray" align="center" style={{ display: 'block', padding: '24px' }}>
                      אין מכירות בתקופה זו
                    </Text>
                  </Table.Cell>
                </Table.Row>
              )}
              {salesInPeriod.map((s) => {
                const dateRaw     = salesFields.date      ? s.getCellValue(salesFields.date)      : null;
                const dateStr     = dateRaw ? new Date(dateRaw).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
                const productsRaw = salesFields.products  ? (s.getCellValue(salesFields.products) ?? []) : [];
                const productsStr = Array.isArray(productsRaw) ? productsRaw.map((p) => p.name).join(', ') : '—';
                const totalDeal   = salesFields.totalDeal ? (Number(s.getCellValue(salesFields.totalDeal)) || 0) : 0;
                const totalPaid   = salesFields.totalPaid ? (Number(s.getCellValue(salesFields.totalPaid)) || 0) : 0;
                const balance     = totalDeal - totalPaid;
                const fpRaw       = salesFields.fullyPaid ? s.getCellValue(salesFields.fullyPaid) : null;
                const fullyPaid   = fpRaw === true || fpRaw === '✅' || fpRaw === 1;
                const custLinks    = salesFields.customersLink ? (s.getCellValue(salesFields.customersLink) ?? []) : [];
                const custRecord   = custLinks[0] ? customersById.get(custLinks[0].id) : null;
                const leadLinks    = custRecord && customersFields?.lead ? custRecord.getCellValue(customersFields.lead) : null;
                const customerName = leadLinks?.[0]?.name ?? custLinks[0]?.name ?? '—';

                return (
                  <Table.Row
                    key={s.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedSale(s)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedSale(s)}
                  >
                    <Table.Cell>
                      <span className={`payment-badge payment-badge--${fullyPaid ? 'paid' : 'pending'}`}>
                        {fullyPaid ? 'שולם במלואו' : 'ממתין'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <Text
                        color={balance > 0 ? 'red' : 'gray'}
                        weight={balance > 0 ? 'bold' : 'regular'}
                        size="2"
                      >
                        {balance > 0 ? `₪${balance.toLocaleString('he-IL')}` : '—'}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text color="green" size="2">
                        {totalPaid ? `₪${totalPaid.toLocaleString('he-IL')}` : '—'}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text color="amber" weight="bold" size="2">
                        {totalDeal ? `₪${totalDeal.toLocaleString('he-IL')}` : '—'}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2">{productsStr || '—'}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text color="gray" size="1" style={{ whiteSpace: 'nowrap' }}>{dateStr}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text weight="medium">{customerName}</Text>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </div>
      </div>

      {selectedSale && (
        <PaymentsModal
          sale={selectedSale}
          payments={selectedSalePayments}
          paymentsFields={paymentsFields}
          customerName={selectedCustomerName}
          salesFields={salesFields}
          onClose={() => setSelectedSale(null)}
        />
      )}
    </>
  );
}
