import React, { useState, useMemo } from 'react';
import {
  Table, Badge, Button, Text, Select, TextArea, Flex, Callout,
} from '@radix-ui/themes';

const STATUSES = ['נוצר קשר', 'לא נוצר קשר', 'נרשם כלקוח', 'שיתוף פעולה', 'לא רלוונטי'];
const ACTIVE_STATUSES = new Set(['נוצר קשר', 'לא נוצר קשר', 'שיתוף פעולה']);

const STATUS_COLOR = {
  'נוצר קשר':    'indigo',
  'לא נוצר קשר': 'red',
  'נרשם כלקוח':  'green',
  'שיתוף פעולה': 'yellow',
  'לא רלוונטי':  'gray',
};

const NEW_LEAD_MS     = 24 * 3600 * 1000;
const MAX_TEXT_LENGTH = 2000;

function isNewLead(record, createdTimeField) {
  const raw = createdTimeField ? record.getCellValue(createdTimeField) : record.createdTime;
  return raw && Date.now() - new Date(raw).getTime() < NEW_LEAD_MS;
}

function buildWhatsAppUrl(phone) {
  const cleaned = (phone || '').replace(/\D/g, '');
  if (!cleaned) return null;
  const intl = cleaned.startsWith('0') ? '972' + cleaned.slice(1) : cleaned;
  if (intl.length < 10) return null;
  const msg = encodeURIComponent('שלום! אני מ-BillsAI, רציתי לחזור אליך בנוגע לפנייתך 😊');
  return `https://wa.me/${intl}?text=${msg}`;
}

function getSelectChoices(field) {
  return field?.options?.choices?.map((c) => c.name) ?? [];
}

export default function OperationalTable({ records, fields, table }) {
  const [editingCell, setEditingCell] = useState(null);
  const [showAll, setShowAll]         = useState(false);
  const [saveError, setSaveError]     = useState(null);

  const serviceChoices = useMemo(() => getSelectChoices(fields.serviceType), [fields.serviceType]);
  const sourceChoices  = useMemo(() => getSelectChoices(fields.leadSource),  [fields.leadSource]);

  const filtered = useMemo(() => {
    if (showAll) return records;
    return records.filter((r) => {
      const status = fields.status ? r.getCellValue(fields.status)?.name : null;
      return !status || ACTIVE_STATUSES.has(status);
    });
  }, [records, fields, showAll]);

  async function saveField(record, field, value) {
    if (!field) return;
    try {
      setSaveError(null);
      await table.updateRecordAsync(record, { [field.id]: value });
    } catch {
      setSaveError('שגיאה בשמירה — בדוק הרשאות');
    }
    setEditingCell(null);
  }

  function editing(recordId, fieldName) {
    return editingCell?.recordId === recordId && editingCell?.field === fieldName;
  }

  function InlineSelect({ record, field, choices, currentValue, colorMap }) {
    if (!field || choices.length === 0) {
      return <Text color="gray" size="2">{currentValue || '—'}</Text>;
    }
    if (editing(record.id, field.id)) {
      return (
        <Select.Root
          defaultValue={currentValue}
          onValueChange={(val) => saveField(record, field, { name: val })}
          size="1"
        >
          <Select.Trigger />
          <Select.Content>
            {choices.map((s) => <Select.Item key={s} value={s}>{s}</Select.Item>)}
          </Select.Content>
        </Select.Root>
      );
    }
    const color = colorMap?.[currentValue] || 'gray';
    return (
      <Badge
        color={color}
        variant="soft"
        style={{ cursor: 'pointer' }}
        onClick={() => setEditingCell({ recordId: record.id, field: field.id })}
        title="לחץ לעריכה"
      >
        {currentValue || '—'}
      </Badge>
    );
  }

  return (
    <div className="ops-section">
      <Flex justify="between" align="center" mb="4">
        <Text size="4" weight="bold">לידים — מרכז עבודה</Text>
        <Button
          variant="soft"
          color="gray"
          size="2"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'הצג פעילים בלבד' : 'הצג הכל'}
        </Button>
      </Flex>

      {saveError && (
        <Callout.Root color="red" mb="3" role="alert">
          <Callout.Text>{saveError}</Callout.Text>
        </Callout.Root>
      )}

      <div className="table-wrapper">
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>שם</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>סטטוס</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>סוג שירות</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>מקור</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>שווי עסקה</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>פעולה הבאה</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ width: 40 }}></Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {filtered.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={7}>
                  <Text color="gray" align="center" style={{ display: 'block', padding: '24px' }}>
                    אין לידים להצגה
                  </Text>
                </Table.Cell>
              </Table.Row>
            )}
            {filtered.map((record) => {
              const isNew     = isNewLead(record, fields.createdTime);
              const status    = fields.status      ? record.getCellValue(fields.status)?.name      : null;
              const phone     = fields.phone       ? record.getCellValue(fields.phone)             : null;
              const nextAct   = fields.nextAction  ? record.getCellValue(fields.nextAction)        : '';
              const service   = fields.serviceType ? record.getCellValue(fields.serviceType)?.name : null;
              const source    = fields.leadSource  ? record.getCellValue(fields.leadSource)?.name  : null;
              const dealVal   = fields.dealValue   ? record.getCellValue(fields.dealValue)         : null;
              const name      = fields.name        ? record.getCellValue(fields.name)              : record.name;
              const waUrl     = buildWhatsAppUrl(phone);

              const dealDisplay = dealVal != null
                ? `₪${Number(dealVal).toLocaleString('he-IL')}`
                : '—';

              return (
                <Table.Row key={record.id} style={isNew ? { background: 'var(--indigo-a3)' } : {}}>

                  {/* שם */}
                  <Table.Cell>
                    <Flex align="center" gap="2">
                      {isNew && <Badge color="indigo" size="1">חדש!</Badge>}
                      <Text size="2">{name || '—'}</Text>
                    </Flex>
                  </Table.Cell>

                  {/* סטטוס */}
                  <Table.Cell>
                    <InlineSelect
                      record={record}
                      field={fields.status}
                      choices={STATUSES}
                      currentValue={status}
                      colorMap={STATUS_COLOR}
                    />
                  </Table.Cell>

                  {/* סוג שירות */}
                  <Table.Cell>
                    <InlineSelect
                      record={record}
                      field={fields.serviceType}
                      choices={serviceChoices}
                      currentValue={service}
                    />
                  </Table.Cell>

                  {/* מקור ליד */}
                  <Table.Cell>
                    <InlineSelect
                      record={record}
                      field={fields.leadSource}
                      choices={sourceChoices}
                      currentValue={source}
                    />
                  </Table.Cell>

                  {/* שווי עסקה */}
                  <Table.Cell>
                    <Text color="amber" weight="bold" size="2">{dealDisplay}</Text>
                  </Table.Cell>

                  {/* פעולה הבאה */}
                  <Table.Cell>
                    {editing(record.id, 'nextAction') ? (
                      <TextArea
                        defaultValue={nextAct || ''}
                        autoFocus
                        onBlur={(e) => saveField(record, fields.nextAction, e.target.value.trim().slice(0, MAX_TEXT_LENGTH))}
                        rows={2}
                        size="1"
                        maxLength={MAX_TEXT_LENGTH}
                      />
                    ) : (
                      <Text
                        color={nextAct ? undefined : 'gray'}
                        style={{
                          cursor: fields.nextAction ? 'pointer' : 'default',
                          fontStyle: nextAct ? 'normal' : 'italic',
                          fontSize: '0.82rem',
                        }}
                        onClick={() => fields.nextAction && setEditingCell({ recordId: record.id, field: 'nextAction' })}
                        title={fields.nextAction ? 'לחץ לעריכה' : undefined}
                      >
                        {nextAct || (fields.nextAction ? '+ הוסף פעולה' : '—')}
                      </Text>
                    )}
                  </Table.Cell>

                  {/* WhatsApp */}
                  <Table.Cell>
                    {waUrl ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="whatsapp-btn"
                        title="פתח וואטסאפ"
                      >💬</a>
                    ) : (
                      <Text color="gray" size="1">—</Text>
                    )}
                  </Table.Cell>

                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      </div>
    </div>
  );
}
