import React, { useMemo, useState, useEffect } from 'react';
import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import KpiBar from './components/KpiBar';
import TrendChart from './components/TrendChart';
import LeadFunnel from './components/LeadFunnel';
import LeadSourceChart from './components/LeadSourceChart';
import OperationalTable from './components/OperationalTable';
import CustomersView from './components/CustomersView';
import ZoomMeetingsView from './components/ZoomMeetingsView';
import RevenueView from './components/RevenueView';
import FollowupsView from './components/FollowupsView';
import { getToken, saveToken, clearToken, loadMeta, fetchAllRecords, wrapRecord } from './api/client';
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
  { key: 'revenue',   label: 'הכנסות' },
  { key: 'followups', label: 'פולואפים' },
];

const TABLE_NAMES = ['לידים', 'מכירות', 'פגישות בזום', 'לקוחות', 'תשלומים', 'פולואפים', 'אינטרקציות'];

function AuthScreen({ onAuth }) {
  const [input, setInput] = useState('');
  const [err, setErr] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const t = input.trim();
    if (!t) { setErr('נדרש Personal Access Token'); return; }
    saveToken(t);
    onAuth(t);
  }

  return (
    <Theme appearance="light" accentColor="cyan" radius="medium" dir="rtl">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f4f4f5' }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 32, width: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', border: '1px solid #e4e4e7' }}>
          <h2 style={{ margin: '0 0 6px', fontSize: '1.3rem' }}>מרכז שליטה — BillsAI</h2>
          <p style={{ margin: '0 0 24px', fontSize: '0.875rem', color: '#71717a' }}>הזן Airtable Personal Access Token להתחברות</p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              placeholder="pat..."
              value={input}
              onChange={e => setInput(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d4d4d8', fontSize: '0.9rem', direction: 'ltr', outline: 'none' }}
              autoFocus
            />
            {err && <span style={{ color: '#ef4444', fontSize: '0.82rem' }}>{err}</span>}
            <button
              type="submit"
              style={{ padding: 10, background: '#0891b2', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600 }}
            >
              התחבר
            </button>
          </form>
        </div>
      </div>
    </Theme>
  );
}

export default function App() {
  const [token, setToken]           = useState(() => getToken());
  const [tables, setTables]         = useState({});
  const [allRecords, setAllRecords] = useState({
    leads: [], sales: [], meetings: [], customers: [],
    payments: [], followups: [], interactions: [],
  });
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [period, setPeriod]             = useState('all');
  const [activeView, setActiveView]     = useState('leads');
  const [refreshTick, setRefreshTick]   = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    loadMeta()
      .then(setTables)
      .catch(err => {
        if (err.status === 401) { clearToken(); setToken(''); }
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    if (!token || !Object.keys(tables).length) return;
    let cancelled = false;

    async function load() {
      try {
        const results = await Promise.all(
          TABLE_NAMES.map(name => tables[name] ? fetchAllRecords(tables[name].id) : Promise.resolve([]))
        );
        if (cancelled) return;
        const [leads, sales, meetings, customers, payments, followups, interactions] = results;
        setAllRecords({
          leads:        leads.map(wrapRecord),
          sales:        sales.map(wrapRecord),
          meetings:     meetings.map(wrapRecord),
          customers:    customers.map(wrapRecord),
          payments:     payments.map(wrapRecord),
          followups:    followups.map(wrapRecord),
          interactions: interactions.map(wrapRecord),
        });
        setLoading(false);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [token, tables, refreshTick]);

  const leadsTable        = tables['לידים']        ?? null;
  const salesTable        = tables['מכירות']       ?? null;
  const meetingsTable     = tables['פגישות בזום']  ?? null;
  const customersTable    = tables['לקוחות']       ?? null;
  const paymentsTable     = tables['תשלומים']      ?? null;
  const followupsTable    = tables['פולואפים']     ?? null;
  const interactionsTable = tables['אינטרקציות']   ?? null;

  const records             = allRecords.leads;
  const salesRecords        = allRecords.sales;
  const meetingsRecords     = allRecords.meetings;
  const customersRecords    = allRecords.customers;
  const paymentsRecords     = allRecords.payments;
  const followupsRecords    = allRecords.followups;
  const interactionsRecords = allRecords.interactions;

  const fields = useMemo(() => {
    if (!leadsTable) return {};
    const f = (name) => leadsTable.getFieldByNameIfExists(name);
    return {
      name:          f('שם מלא'),
      status:        f('סטטוס'),
      createdTime:   f('תאריך יצירת רשומה'),
      phone:         f('טלפון'),
      score:         f('ניקוד לפי אינטרקציות'),
      interactions:  f('אינטרקציות'),
      messageSent:   f('נשלחה הודעה לליד ? ') ?? f('נשלחה הודעה לליד ?') ?? f('נשלחה הודעה לליד?'),
      serviceType:   f('סוג שירות'),
      leadSource:    f('מקור ליד'),
      dealValue:     f('שווי עסקה משוער'),
      firstResponseAt: f('זמן תגובה ראשון'),
      responseWait:  f('זמן המתנה לליד'),
      nextAction:    f('פעולה הבאה') ?? f('הערות לליד'),
      proposalDate:  f('הצעה נשלחה בתאריך'),
      proposalFile:  f('הצעת עבודה'),
      noAnswer1:     f('הודעת אין מענה 1'),
      noAnswerDate1: f('תאריך אין מענה ראשון') ?? f('תאריך אין מענה'),
      noAnswer2:     f('הודעת אין מענה 2') ?? f('אין מענה שני'),
      noAnswerDate2: f('תאריך אין מענה שני') ?? f('תאריך אין מענה 2'),
      noAnswer3:     f('אין מענה 3') ?? f('הודעת אין מענה 3') ?? f('אין מענה שלישי'),
      noAnswerDate3: f('תאריך אין מענה שלישי') ?? f('תאריך אין מענה 3'),
    };
  }, [leadsTable]);

  const salesFields = useMemo(() => {
    if (!salesTable) return {};
    const f = (name) => salesTable.getFieldByNameIfExists(name);
    const customersLink = customersTable
      ? (salesTable.fields.find(
          (field) => field.type === 'multipleRecordLinks' && field.options?.linkedTableId === customersTable.id
        ) ?? null)
      : null;
    return {
      price:        f('מחיר (from מחיר)'),
      date:         f('תאריך'),
      products:     f('מוצרים'),
      totalDeal:    f('סכום עסקה כולל'),
      totalPaid:    f('סך הכל שולם') ?? f('תשלום כולל') ?? f('סה"כ שולם'),
      fullyPaid:    f('שולם במלואו ?') ?? f('שולם במלואו?'),
      customersLink,
      leadsLink:    f('לידים') ?? f('ליד'),
    };
  }, [salesTable, customersTable]);

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

  const customersFields = useMemo(() => {
    if (!customersTable) return {};
    const f = (name) => customersTable.getFieldByNameIfExists(name);
    const salesLink = salesTable
      ? (customersTable.fields.find(
          (field) => field.type === 'multipleRecordLinks' && field.options?.linkedTableId === salesTable.id
        ) ?? null)
      : null;
    return {
      lead:          f('לקוח'),
      salesLink,
      total:         f('סה"כ'),
      projectStatus: f('סטטוס פרוייקט'),
      notes:         f('הערות ללקוח'),
      contract:      f('חוזה'),
    };
  }, [customersTable, salesTable]);

  const followupsFields = useMemo(() => {
    if (!followupsTable) return {};
    const f = (name) => followupsTable.getFieldByNameIfExists(name);
    return {
      leadLink:    f('ליד'),
      phone:       f('טלפון'),
      status:      f('סטטוס פולואפ'),
      firstCheck:  f('פולואפ ראשון - יומיים'),
      firstDate:   f('תאריך פולואפ ראשון'),
      secondCheck: f('פולואפ שני - שבוע'),
      secondDate:  f('תאריך פולואפ שני'),
    };
  }, [followupsTable]);

  if (!token) return <AuthScreen onAuth={setToken} />;

  if (loading) {
    return (
      <Theme appearance="light" accentColor="cyan" radius="medium" dir="rtl">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#71717a', fontSize: '1rem' }}>
          טוען נתונים...
        </div>
      </Theme>
    );
  }

  if (error) {
    return (
      <Theme appearance="light" accentColor="cyan" radius="medium" dir="rtl">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
          <p style={{ color: '#ef4444' }}>שגיאה: {error}</p>
          <button
            onClick={() => { clearToken(); setToken(''); }}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d4d4d8', cursor: 'pointer' }}
          >
            חזור למסך ההתחברות
          </button>
        </div>
      </Theme>
    );
  }

  if (!leadsTable) {
    return (
      <Theme appearance="light" accentColor="cyan" radius="medium" dir="rtl">
        <div className="error-state">
          <p>לא נמצאה טבלת "לידים". בדוק את שם הטבלה.</p>
        </div>
      </Theme>
    );
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  return (
    <Theme appearance="light" accentColor="cyan" radius="medium" dir="rtl">
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
              onClick={() => setRefreshTick(t => t + 1)}
              title="רענן נתונים"
            >↻</button>
            <button
              className="fullscreen-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'צא ממסך מלא' : 'מסך מלא'}
            >⛶</button>
            <button
              className="fullscreen-btn"
              onClick={() => { clearToken(); setToken(''); }}
              title="התנתק"
              style={{ fontSize: '0.75rem' }}
            >⏏</button>
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

        {activeView === 'revenue' && (
          <RevenueView
            salesRecords={salesRecords}
            salesFields={salesFields}
            paymentsRecords={paymentsRecords ?? []}
            paymentsFields={paymentsFields}
            customersRecords={customersRecords}
            customersFields={customersFields}
            period={period}
          />
        )}

        {activeView === 'followups' && (
          <FollowupsView
            followupsRecords={followupsRecords ?? []}
            followupsFields={followupsFields}
            followupsTable={followupsTable}
            leadsRecords={records ?? []}
          />
        )}
      </div>
    </Theme>
  );
}
