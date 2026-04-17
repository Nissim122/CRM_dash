# CLAUDE.md — BillsAI Executive Cockpit (Airtable Extension)

## Project Overview
**"מרכז שליטה למנכ"ל"** — ממשק עבודה חכם שמחליף עבודה ישירה מול טבלאות Airtable.
משלב שתי שכבות:
- **שכבת תובנות (Analytics):** מבט-על של ביצועי העסק — לידים, סגירות, מגמות.
- **שכבת תפעול (Operations):** ניהול שוטף של לידים בטבלה אינטראקטיבית.

זוהי **Airtable Extension** — React app שרץ בתוך סביבת Airtable. **אין backend, אין router, אין שרת חיצוני.**

## Tech Stack
- **Runtime:** Airtable Blocks SDK v2 (`@airtable/blocks`, `@airtable/blocks/ui`)
- **UI:** React 17
- **Charts:** Recharts
- **Styles:** Plain CSS (`frontend/styles.css`) — no Tailwind, no CSS-in-JS
- **Entry point:** `frontend/index.js` → `initializeBlock(() => <App />)` (import from `@airtable/blocks/ui`)

## Project IDs
- **Base ID:** `appdDL145oWw1E2qs`
- **Block ID:** `blkOgY7KAxhNSPFQm`

## Project Structure
```
frontend/
  index.js               — entry point
  App.js                 — root component, loads 3 tables
  styles.css             — global dark-mode RTL styles
  components/
    KpiBar.js            — 5 KPI cards (this month)
    TrendChart.js        — 30-day line chart (Recharts)
    OperationalTable.js  — inline-edit table with WhatsApp button
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
- כל כתיבה דרך `table.updateRecordAsync()` בלבד.
- `useRecords(table)` לרשימות חיות (מתרענן אוטומטית).
- `useBase()` → `base.getTableByNameIfExists('שם הטבלה')`.
- App.js טוען 3 טבלאות: `לידים`, `מכירות`, `פגישות בזום`.

## UI Rules
- **RTL תמיד:** `dir="rtl"` על root. חריג יחיד: `.chart-container { direction: ltr }`.
- **Dark theme:** CSS variables ב-`:root` — `--bg-base`, `--bg-elevated`, `--bg-floating`, `--border`, `--text-primary`, `--text-muted`. אין hex בקומפוננטות.
- **אין emojis בלוגיקה** — רק בטקסטים לתצוגה.
- **Accent:** `#6366f1`. צבעי סטטוס ב-`OperationalTable.js:STATUS_COLORS`.

## Business Logic Rules
- **Active statuses** (table default filter): `נוצר קשר`, `לא נוצר קשר`, `שיתוף פעולה`
- **Closed status** (KPI סגירות): `נרשם כלקוח`
- **New lead threshold:** < 24h מ-`תאריך יצירת רשומה` → badge + row highlight
- **KPI period:** 1 לחודש 00:00 עד עכשיו
- **Revenue:** sum של `מחיר (from מחיר)` (array) מטבלת מכירות

## Running Locally
```bash
npm install
npm start   # runs: block run
```
נדרש: `@airtable/blocks-cli` גלובלי. בטרמינל PowerShell: `cmd /c npm start`.

## Hard Rules
- אין backend, REST API, או DB מחוץ ל-Airtable.
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
