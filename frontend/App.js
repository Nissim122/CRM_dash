import React, { useMemo, useState, useEffect } from 'react';
import { useBase, useRecords, useWatchable } from '@airtable/blocks/ui';
import { viewport } from '@airtable/blocks';
import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import KpiBar from './components/KpiBar';
import TrendChart from './components/TrendChart';
import LeadFunnel from './components/LeadFunnel';
import LeadSourceChart from './components/LeadSourceChart';
import OperationalTable from './components/OperationalTable';
import CustomersView from './components/CustomersView';
import ZoomMeetingsView from './components/ZoomMeetingsView';
import './styles.css';

const PERIODS = [
  { key: 'week',  label: 'שבוע' },
  { key: 'month', label: 'חודש' },
  { key: 'year',  label: 'שנה'  },
  { key: 'all',   label: 'תמיד' },
];

const VIEWS = [
  { key: 'leads',     label: 'לידים' },
  { key: 'customers', label: 'לקוחות' },
  { key: 'meetings',  label: 'פגישות זום' },
];

export default function App() {
  const base = useBase();
  const [period, setPeriod]       = useState('month');
  const [activeView, setActiveView] = useState('leads');
  useWatchable(viewport, ['isFullscreen']);
  useEffect(() => { viewport.enterFullscreenIfPossible(); }, []);

  const leadsTable     = base.getTableByNameIfExists('לידים');
  const salesTable     = base.getTableByNameIfExists('מכירות');
  const meetingsTable  = base.getTableByNameIfExists('פגישות בזום');
  const customersTable = base.getTableByNameIfExists('לקוחות');
  const paymentsTable  = base.getTableByNameIfExists('תשלומים');

  const records          = useRecords(leadsTable);
  const salesRecords     = useRecords(salesTable);
  const meetingsRecords  = useRecords(meetingsTable);
  const customersRecords = useRecords(customersTable);
  const paymentsRecords  = useRecords(paymentsTable ?? null);

  const interactionsTable   = base.getTableByNameIfExists('אינטרקציות');
  const interactionsRecords = useRecords(interactionsTable);

  const fields = useMemo(() => {
    if (!leadsTable) return {};
    const f = (name) => leadsTable.getFieldByNameIfExists(name);
    return {
      name:             f('שם מלא'),
      status:           f('סטטוס'),
      createdTime:      f('תאריך יצירת רשומה'),
      phone:            f('טלפון'),
      score:            f('ניקוד לפי אינטרקציות'),
      interactions:     f('אינטרקציות'),
      messageSent:      f('נשלחה הודעה לליד ? ') ?? f('נשלחה הודעה לליד ?') ?? f('נשלחה הודעה לליד?'),
      serviceType:      f('סוג שירות'),
      leadSource:       f('מקור ליד'),
      dealValue:        f('שווי עסקה משוער'),
      firstResponseAt:  f('זמן תגובה ראשון'),
      responseWait:     f('זמן המתנה לליד'),
      nextAction:       f('פעולה הבאה') ?? f('הערות לליד'),
      proposalDate:     f('הצעה נשלחה בתאריך'),
      proposalFile:     f('הצעת עבודה'),
      noAnswer1:        f('הודעת אין מענה 1'),
      noAnswerDate1:    f('תאריך אין מענה ראשון') ?? f('תאריך אין מענה'),
      noAnswer2:        f('הודעת אין מענה 2') ?? f('אין מענה שני'),
      noAnswerDate2:    f('תאריך אין מענה שני') ?? f('תאריך אין מענה 2'),
      noAnswer3:        f('אין מענה 3') ?? f('הודעת אין מענה 3') ?? f('אין מענה שלישי'),
      noAnswerDate3:    f('תאריך אין מענה שלישי') ?? f('תאריך אין מענה 3'),
    };
  }, [leadsTable]);

  const salesFields = useMemo(() => {
    if (!salesTable) return {};
    const f = (name) => salesTable.getFieldByNameIfExists(name);
    return {
      price:      f('מחיר (from מחיר)'),
      date:       f('תאריך'),
      products:   f('מוצרים'),
      totalDeal:  f('סכום עסקה כולל'),
      totalPaid:  f('סך הכל שולם') ?? f('תשלום כולל') ?? f('סה"כ שולם'),
      fullyPaid:  f('שולם במלואו ?') ?? f('שולם במלואו?'),
    };
  }, [salesTable]);

  const paymentsFields = useMemo(() => {
    if (!paymentsTable) return {};
    const f = (name) => paymentsTable.getFieldByNameIfExists(name);
    return {
      projectLink:   f('פרוייקט לקוח'),
      paymentNumber: f('מספר תשלום'),
      amount:        f('סכום תשלום'),
      status:        f('סטטוס'),
      dueDate:       f('תאריך יעד'),
    };
  }, [paymentsTable]);

  const meetingsFields = useMemo(() => {
    if (!meetingsTable) return {};
    return {
      isToday: meetingsTable.getFieldByNameIfExists('האם פגישה היום'),
    };
  }, [meetingsTable]);

  const customersFields = useMemo(() => {
    if (!customersTable) return {};
    const f = (name) => customersTable.getFieldByNameIfExists(name);
    return {
      lead:          f('לקוח'),
      sales:         f('מכירות') ?? f('מכירות שנעשו ללקוח') ?? f('מכירות שנעשו'),
      total:         f('סה"כ'),
      projectStatus: f('סטטוס פרוייקט'),
      notes:         f('הערות ללקוח'),
      contract:      f('חוזה'),
    };
  }, [customersTable]);

  useEffect(() => {
    if (customersTable) console.log('[DEBUG] customers fields:', customersTable.fields.map((f) => f.name));
    if (salesTable)     console.log('[DEBUG] sales fields:',     salesTable.fields.map((f) => f.name));
  }, [customersTable, salesTable]);

  if (!leadsTable) {
    return (
      <Theme appearance="dark" accentColor="indigo" radius="medium" dir="rtl">
        <div className="error-state">
          <p>לא נמצאה טבלת "לידים". בדוק את שם הטבלה.</p>
        </div>
      </Theme>
    );
  }

  return (
    <Theme appearance="dark" accentColor="indigo" radius="medium" dir="rtl">
      <div className="app" dir="rtl">
        <header className="app-header">
          <div className="header-brand">
            <h1 className="app-title">מרכז שליטה</h1>
            <span className="app-subtitle">BillsAI</span>
          </div>

          <nav className="main-nav">
            {VIEWS.map(({ key, label }) => (
              <button
                key={key}
                className={`nav-btn${activeView === key ? ' nav-btn--active' : ''}`}
                onClick={() => setActiveView(key)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="header-left">
            <div className="period-switcher">
              {PERIODS.map(({ key, label }) => (
                <button
                  key={key}
                  className={`period-btn${period === key ? ' period-btn--active' : ''}`}
                  onClick={() => setPeriod(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              className="fullscreen-btn"
              onClick={() => viewport.isFullscreen ? viewport.exitFullscreen() : viewport.enterFullscreenIfPossible()}
              title={viewport.isFullscreen ? 'צא ממסך מלא' : 'מסך מלא'}
            >⛶</button>
          </div>
        </header>

        {activeView === 'leads' && (
          <>
            <KpiBar records={records} fields={fields} period={period} />
            <div className="analytics-row">
              <TrendChart records={records} fields={fields} period={period} />
              <LeadFunnel records={records} fields={fields} period={period} />
              <LeadSourceChart records={records} fields={fields} period={period} />
            </div>
            <OperationalTable records={records} fields={fields} table={leadsTable} interactionsTable={interactionsTable} interactionsRecords={interactionsRecords} />
          </>
        )}

        {activeView === 'customers' && (
          <CustomersView
            customersRecords={customersRecords}
            customersFields={customersFields}
            customersTable={customersTable}
            salesRecords={salesRecords}
            salesFields={salesFields}
            leadsRecords={records}
            leadsFields={fields}
            paymentsRecords={paymentsRecords ?? []}
            paymentsFields={paymentsFields}
            period={period}
          />
        )}

        {activeView === 'meetings' && (
          <ZoomMeetingsView
            meetingsRecords={meetingsRecords}
            meetingsTable={meetingsTable}
            leadsRecords={records}
            period={period}
          />
        )}
      </div>
    </Theme>
  );
}
