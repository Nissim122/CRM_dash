const BASE_ID = 'appdDL145oWw1E2qs';
const API_BASE = `https://api.airtable.com/v0/${BASE_ID}`;
const META_URL = `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`;

const ENV_TOKEN = import.meta.env.VITE_AIRTABLE_TOKEN ?? '';

export function getToken() {
  return localStorage.getItem('airtable_token') || ENV_TOKEN;
}

export function saveToken(t) {
  localStorage.setItem('airtable_token', t.trim());
}

export function clearToken() {
  localStorage.removeItem('airtable_token');
}

async function apiFetch(url, init = {}) {
  const headers = { Authorization: `Bearer ${getToken()}` };
  if (init.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    const err = new Error(`Airtable ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function loadMeta() {
  const data = await apiFetch(META_URL);
  const map = {};
  for (const t of data.tables) {
    map[t.name] = buildTableObj(t);
  }
  return map;
}

export async function fetchAllRecords(tableId) {
  const records = [];
  let offset;
  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (offset) params.append('offset', offset);
    const data = await apiFetch(`${API_BASE}/${tableId}?${params}`);
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

async function patchRecord(tableId, recordId, fields) {
  return apiFetch(`${API_BASE}/${tableId}/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });
}

export function wrapRecord(raw) {
  return {
    id: raw.id,
    createdTime: raw.createdTime,
    get name() {
      const first = Object.values(raw.fields)[0];
      if (first == null) return raw.id;
      if (typeof first === 'object' && !Array.isArray(first) && first?.name) return String(first.name);
      return String(first);
    },
    getCellValue(field) {
      if (!field?.name) return null;
      const v = raw.fields[field.name] ?? null;
      if (v == null) return null;
      if (field.type === 'singleSelect' && typeof v === 'string') return { name: v };
      if (field.type === 'multipleSelect' && Array.isArray(v))
        return v.map(x => (typeof x === 'string' ? { name: x } : x));
      if (field.type === 'multipleRecordLinks' && Array.isArray(v))
        return v.map(id => (typeof id === 'string' ? { id } : id));
      return v;
    },
    getCellValueAsString(field) {
      if (!field?.name) return '';
      const v = raw.fields[field.name];
      if (v == null) return '';
      if (Array.isArray(v)) return v.map(x => (typeof x === 'object' && x?.name != null ? x.name : String(x ?? ''))).join(', ');
      if (typeof v === 'object' && v?.name != null) return String(v.name);
      return String(v);
    },
  };
}

function buildTableObj(tableInfo) {
  const fieldById = new Map(tableInfo.fields.map(f => [f.id, f]));
  return {
    id: tableInfo.id,
    name: tableInfo.name,
    fields: tableInfo.fields,
    getFieldByNameIfExists(name) {
      return tableInfo.fields.find(f => f.name === name) ?? null;
    },
    async updateRecordAsync(record, updates) {
      const fields = {};
      for (const [key, val] of Object.entries(updates)) {
        const field = fieldById.get(key);
        fields[field ? field.name : key] = val;
      }
      return patchRecord(tableInfo.id, record.id, fields);
    },
  };
}
