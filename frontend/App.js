import React, { useMemo, useState } from 'react';
import { useBase, useRecords, useWatchable } from '@airtable/blocks/ui';
import { viewport } from '@airtable/blocks';
import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import KpiBar from './components/KpiBar';
import TrendChart from './components/TrendChart';
import OperationalTable from './components/OperationalTable';
import CustomersView from './components/CustomersView';
import './styles.css';

const PERIODS = [
  { key: 'week',  label: 'שבוע' },
  { key: 'month', label: 'חודש' },
  { key: 'year',  label: 'שנה'  },
];

const VIEWS = [
  { key: 'leads',     label: 'לידים' },
  { key: 'customers', label: 'לקוחות' },
];

export default function App() {
  const base = useBase();
  const [period, setPeriod]       = useState('month');
  const [activeView, setActiveView] = useState('leads');
  useWatchable(viewport, ['isFullscreen']);

  const leadsTable     = base.getTableByNameIfExists('לידים');
  const salesTable     = base.getTableByNameIfExists('מכירות');
  const meetingsTable  = base.getTableByNameIfExists('פגישות בזום');
  const customersTable = base.getTableByNameIfExists('לקוחות');

  const records          = useRecords(leadsTable);
  const salesRecords     = useRecords(salesTable);
  const meetingsRecords  = useRecords(meetingsTable);
  const customersRecords = useRecords(customersTable);

  const fields = useMemo(() => {
    if (!leadsTable) return {};
    const f = (name) => leadsTable.getFieldByNameIfExists(name);
    return {
      name:        f('שם מלא'),
      status:      f('סטטוס'),
      createdTime: f('תאריך יצירת רשומה'),
      phone:       f('טלפון'),
      score:       f('ניקוד לפי אינטרקציות'),
      serviceType: f('סוג שירות'),
      leadSource:  f('מקור ליד'),
      dealValue:   f('שווי עסקה משוער'),
      // פעולה הבאה — uses dedicated field if exists, otherwise falls back to הערות לליד
      nextAction:  f('פעולה הבאה') ?? f('הערות לליד'),
    };
  }, [leadsTable]);

  const salesFields = useMemo(() => {
    if (!salesTable) return {};
    return {
      price: salesTable.getFieldByNameIfExists('מחיר (from מחיר)'),
      date:  salesTable.getFieldByNameIfExists('תאריך'),
    };
  }, [salesTable]);

  const meetingsFields = useMemo(() => {
    if (!meetingsTable) return {};
    return {
      isToday: meetingsTable.getFieldByNameIfExists('האם פגישה היום'),
    };
  }, [meetingsTable]);

  const customersFields = useMemo(() => {
    if (!customersTable) return {};
    return {
      lead:  customersTable.getFieldByNameIfExists('לקוח'),
      sales: customersTable.getFieldByNameIfExists('מכירות'),
      total: customersTable.getFieldByNameIfExists('סה"כ'),
    };
  }, [customersTable]);

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
            <TrendChart records={records} fields={fields} period={period} />
            <OperationalTable records={records} fields={fields} table={leadsTable} />
          </>
        )}

        {activeView === 'customers' && (
          <CustomersView
            customersRecords={customersRecords}
            customersFields={customersFields}
            salesRecords={salesRecords}
            salesFields={salesFields}
            leadsRecords={records}
            leadsFields={fields}
            period={period}
          />
        )}
      </div>
    </Theme>
  );
}
