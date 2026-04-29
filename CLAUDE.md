# CLAUDE.md — BillsAI Executive Cockpit (Standalone Web App)

## Project Overview
**"מרכז שליטה למנכ"ל"** — ממשק עבודה חכם שמחליף עבודה ישירה מול טבלאות Airtable.
משלב שתי שכבות:
- **שכבת תובנות (Analytics):** מבט-על של ביצועי העסק — לידים, סגירות, מגמות.
- **שכבת תפעול (Operations):** ניהול שוטף של לידים בטבלה אינטראקטיבית.

זהו **אתר עצמאי** — React app שרץ בדפדפן, מתקשר עם Airtable דרך REST API. **אין backend, אין router, אין שרת חיצוני.**

## Tech Stack
- **Build:** Vite 5
- **UI:** React 18 + Radix UI Themes (`@radix-ui/themes`)
- **Charts:** Recharts
- **Styles:** Plain CSS (`frontend/styles.css`) — no Tailwind, no CSS-in-JS
- **Entry point:** `frontend/index.jsx` → `createRoot(document.getElementById('root')).render(<App />)`
- **API:** Airtable REST API — `https://api.airtable.com/v0/{baseId}` + Personal Access Token (PAT)
- **Auth:** PAT נשמר ב-`localStorage`; fallback ל-`VITE_AIRTABLE_TOKEN` env var

## Project IDs
- **Base ID:** `appdDL145oWw1E2qs`

## Project Structure
```
index.html               — entry HTML
frontend/
  index.jsx              — entry point (React 18 createRoot)
  App.jsx                — root component, loads 7 tables
  styles.css             — global RTL styles + CSS variables
  api/
    client.js            — Airtable REST API client (getToken, fetchAllRecords, wrapRecord, buildTableObj)
  components/
    KpiBar.jsx           — 5 KPI cards
    TrendChart.jsx       — line chart (Recharts)
    LeadFunnel.jsx       — funnel chart
    LeadSourceChart.jsx  — source breakdown chart
    OperationalTable.jsx — inline-edit leads table with WhatsApp button
    CustomersView.jsx    — customers + sales + payments
    ZoomMeetingsView.jsx — zoom meetings timeline
    RevenueView.jsx      — revenue charts + sales table
    FollowupsView.jsx    — follow-up management
```

## Airtable Tables & Fields (verified via API)

### לידים — primary table (`tblR0BglgfPgOGGNv`)
| שם שדה                  | סוג                | הערות |
|-------------------------|--------------------|-------|
| שם מלא                  | multilineText      | |
| טלפון                   | phoneNumber        | |
| אימייל                  | email              | |
| סטטוס                   | singleSelect       | ראה ערכים למטה |
| אינטרקציות              | multipleRecordLinks| → טבלת אינטרקציות |
| ניקוד לפי אינטרקציות   | rollup             | סכום ניקוד מאינטרקציות |
| פגישות בזום             | multipleRecordLinks| → טבלת פגישות בזום |
| תאריך הרשמה             | date               | |
| הערות לליד              | multilineText      | שדה ההערות הנכון |
| תאריך יצירת רשומה       | createdTime        | אוטומטי |
| לקוחות                  | multipleRecordLinks| → טבלת לקוחות |

**ערכי סטטוס (סדר נכון):**
- `נוצר קשר` — ליד פעיל, בוצע קשר
- `לא נוצר קשר` — ממתין לקשר ראשוני
- `נרשם כלקוח` — **סגירה** — נספר ב-KPI סגירות
- `שיתוף פעולה` — סוג נוסף של סגירה/שיתוף
- `לא רלוונטי` — מבוטל

### לקוחות (`tbl86UN2v2hZvajsf`)
- לקוח → link to לידים (יחיד)
- מכירות → link to מכירות
- סה"כ (rollup הכנסות)
- חוזה (attachments)

### אינטרקציות (`tblKwduLGNM5h9zsW`)
- ליד → link to לידים
- פעולה → link to פעולות
- הוספה לדירוג (lookup מפעולות)

### פעולות (`tblHt5bkKUVASL8oH`)
- פעולה (singleSelect): פתיחת מייל / שיחה עם צאטבוט / קביעת פגישה / הגעה לפגישה / קניית אוטומציה / הגעה לשיחת הטמעה / שיתוף פעולה / השארת פרטים באתר
- הוספת דירוג (number)

### מוצרים (`tbl7YcEIBZ0fD8MtR`)
- מוצר (singleLineText)
- מחיר (currency ₪)
- מכירות שנעשו למוצר → link to מכירות

### מכירות (`tbl3uhTyye5SHiwXa`)
- מוצרים → link to מוצרים
- תאריך (date)
- מחיר (from מחיר) (multipleLookupValues — מחזיר מערך)
- לקוחות → link to לקוחות

### פגישות בזום (`tbl404YFzBrlDQAFb`)
- שם לקוח → link to לידים
- זמן התחלת פגישה (dateTime)
- האם פגישה היום (formula → "היום" / "לא היום")
- קישור לפגישה (url)
- סטטוס תזכורת (singleSelect)

### הודעות (`tblPOJVWl1vmDh0HW`)
- תוכן ההודעה (multilineText)
- מזהה יחודי להודעה (number)

### כללי (`tblqXA7sNdzUqSb9P`)
- Name / Notes

## Functional Spec

### א. KPI Bar (5 כרטיסים — חודש נוכחי)
1. **לידים החודש** — לפי `תאריך יצירת רשומה`
2. **נרשמו כלקוחות** — סטטוס `נרשם כלקוח`
3. **הכנסות החודש** — סכום `מחיר (from מחיר)` ממכירות החודש
4. **פגישות היום** — `האם פגישה היום` = "היום"
5. **לידים פעילים** — סטטוסים: `נוצר קשר`, `לא נוצר קשר`, `שיתוף פעולה`

### ב. Trend Chart
- גרף קווי — לידים לפי יום — 30 ימים אחרונים
- ציר X: תאריך | ציר Y: כמות | צבע: `#6366f1`

### ג. Operational Table
- **ברירת מחדל:** רק לידים פעילים (`נוצר קשר`, `לא נוצר קשר`, `שיתוף פעולה`)
- **עמודות:** שם מלא | סטטוס | ניקוד | טלפון | הערות לליד | תאריך יצירה
- **Inline edit:** סטטוס (onChange) + הערות (onBlur) — שמירה ישירה ל-Airtable
- **WhatsApp:** strip non-digits, `0X` → `972X`, הודעה מוכנה
- **Badge "חדש!":** ליד בן פחות מ-24 שעות → הדגשת שורה + תג

## Always Do First
- כל כתיבה דרך `table.updateRecordAsync(record, { [field.name]: value })` בלבד — שולח PATCH ל-REST API.
- נתונים נטענים ב-`App.jsx` דרך `fetchAllRecords()` ומועברים כ-props; אין hooks חיים.
- רשומות עטופות ב-`wrapRecord()` — משתמש ב-`getCellValue(field)` ו-`getCellValueAsString(field)`.
- `App.jsx` טוען 7 טבלאות: `לידים`, `מכירות`, `פגישות בזום`, `לקוחות`, `תשלומים`, `פולואפים`, `אינטרקציות`.

## UI Rules
- **RTL תמיד:** `dir="rtl"` על root. חריג יחיד: `.chart-container { direction: ltr }`.
- **Dark theme:** CSS variables ב-`:root` — `--bg-base`, `--bg-elevated`, `--bg-floating`, `--border`, `--text-primary`, `--text-muted`. אין hex בקומפוננטות.
- **אין emojis בלוגיקה** — רק בטקסטים לתצוגה.
- **Accent:** `#6366f1`. צבעי סטטוס ב-`OperationalTable.jsx:STATUS_COLORS`.

## Business Logic Rules
- **Active statuses** (table default filter): `נוצר קשר`, `לא נוצר קשר`, `שיתוף פעולה`
- **Closed status** (KPI סגירות): `נרשם כלקוח`
- **New lead threshold:** < 24h מ-`תאריך יצירת רשומה` → badge + row highlight
- **KPI period:** 1 לחודש 00:00 עד עכשיו
- **Revenue:** sum של `מחיר (from מחיר)` (array) מטבלת מכירות

## Running Locally
```bash
npm install
npm run dev   # Vite dev server — http://localhost:5173
npm run build # production build → dist/
```
בטרמינל PowerShell: `cmd /c npm run dev`.

## Hard Rules
- אין backend או DB מחוץ ל-Airtable — כל הנתונים דרך REST API.
- אין `transition-all` ב-CSS.
- אין הוספת פיצ'רים מעבר לאפיון ללא אישור.
- אין שימוש ב-`record.id` כטקסט תצוגה.
- Inline edit שומר `onBlur` (textarea) או `onChange` (select) — אין כפתור שמירה נפרד.

## Workflow Rules
- **אין לשאול אישור לפני ביצוע** — כשיש הרשאת עריכה ותכנון הסתיים, מבצעים מיד.
- **אין תגובות אישור** — אחרי תכנון, ישר קוד.
- **Interactive states:** כל אלמנט לחיץ חייב hover ו-focus-visible.
- **Animations:** אנimate רק `transform` ו-`opacity`. לעולם לא `transition-all`.
- **Depth:** ממשק עם שכבות — base → elevated → floating. לא הכל באותו z-plane.
- **CSS variables בלבד בקומפוננטות** — אין hex ישיר, רק `var(--...)`.
- **שגיאות כתיבה ל-Airtable** — תמיד `try/catch` סביב `updateRecordAsync` עם הודעה למשתמש.
