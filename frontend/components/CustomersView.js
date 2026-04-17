import React, { useMemo } from 'react';
import { Card, Text, Heading, Flex, Table, Badge } from '@radix-ui/themes';

function getPeriodStart(period) {
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

const CARD_META = {
  total:   { color: '#6366f1', icon: '👥' },
  revenue: { color: '#f59e0b', icon: '💰' },
  sales:   { color: '#10b981', icon: '🛒' },
};

const PERIOD_LABEL = { week: 'השבוע', month: 'החודש', year: 'השנה' };

export default function CustomersView({
  customersRecords, customersFields,
  salesRecords, salesFields,
  period,
}) {
  const stats = useMemo(() => {
    const startDate = getPeriodStart(period);
    let revenueInPeriod = 0;
    let salesInPeriod = 0;

    for (const record of salesRecords) {
      const dateRaw = salesFields.date ? record.getCellValue(salesFields.date) : null;
      if (!dateRaw || new Date(dateRaw) < startDate) continue;
      salesInPeriod++;
      const priceArr = salesFields.price ? record.getCellValue(salesFields.price) : null;
      if (Array.isArray(priceArr)) {
        for (const val of priceArr) {
          revenueInPeriod += typeof val === 'number' ? val : (val?.value ?? 0);
        }
      }
    }

    return { total: customersRecords.length, revenueInPeriod, salesInPeriod };
  }, [customersRecords, salesRecords, salesFields, period]);

  const periodLabel = PERIOD_LABEL[period];

  const cards = [
    { id: 'total',   label: 'סה"כ לקוחות',           value: stats.total },
    { id: 'revenue', label: `הכנסות ${periodLabel}`,  value: `₪${stats.revenueInPeriod.toLocaleString('he-IL')}` },
    { id: 'sales',   label: `מכירות ${periodLabel}`,  value: stats.salesInPeriod },
  ];

  return (
    <>
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

      <div className="ops-section">
        <Text size="4" weight="bold" style={{ display: 'block', marginBottom: '16px' }}>
          רשימת לקוחות
        </Text>
        <div className="table-wrapper">
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>שם לקוח</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>סה"כ הכנסות</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>מכירות</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {customersRecords.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={3}>
                    <Text color="gray" align="center" style={{ display: 'block', padding: '24px' }}>
                      אין לקוחות להצגה
                    </Text>
                  </Table.Cell>
                </Table.Row>
              )}
              {customersRecords.map((record) => {
                const leadLinks  = customersFields.lead  ? record.getCellValue(customersFields.lead)  : null;
                const salesLinks = customersFields.sales ? record.getCellValue(customersFields.sales) : null;
                const totalRaw   = customersFields.total ? record.getCellValue(customersFields.total) : null;

                const name       = leadLinks?.[0]?.name ?? '—';
                const salesCount = Array.isArray(salesLinks) ? salesLinks.length : 0;
                const totalStr   = totalRaw != null
                  ? `₪${Number(totalRaw).toLocaleString('he-IL')}`
                  : '—';

                return (
                  <Table.Row key={record.id}>
                    <Table.Cell><Text>{name}</Text></Table.Cell>
                    <Table.Cell>
                      <Text color="amber" weight="bold">{totalStr}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color="indigo" variant="soft">{salesCount}</Badge>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </div>
      </div>
    </>
  );
}
