import fs from 'node:fs';

const input = '/home/ubuntu/upload/orders_export_1(2).csv';
const output = '/home/ubuntu/coach_conversion_shopify_export_profile.json';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function number(value) {
  const parsed = Number.parseFloat(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

const [header, ...rawRows] = parseCsv(fs.readFileSync(input, 'utf8'));
const rows = rawRows.filter((row) => row.length > 1).map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ''])));
const orderMap = new Map();
const productMap = new Map();

for (const row of rows) {
  const id = row.Id?.trim();
  if (!id) continue;
  const status = row['Financial Status']?.trim().toLowerCase() || 'unknown';
  const source = row.Source?.trim() || 'unknown';
  if (!orderMap.has(id)) {
    orderMap.set(id, {
      status,
      source,
      total: number(row.Total),
      refunded: number(row['Refunded Amount']),
    });
  }
  const key = `${row['Lineitem name']?.trim() || '(unnamed)'}\u0000${row['Lineitem sku']?.trim() || ''}`;
  const current = productMap.get(key) || { name: row['Lineitem name']?.trim() || '(unnamed)', sku: row['Lineitem sku']?.trim() || null, quantity: 0, grossLineValueAfterLineDiscount: 0 };
  const quantity = Math.max(0, Number.parseInt(row['Lineitem quantity'], 10) || 0);
  current.quantity += quantity;
  current.grossLineValueAfterLineDiscount += number(row['Lineitem price']) * quantity - number(row['Lineitem discount']);
  productMap.set(key, current);
}

const byStatus = {};
const bySource = {};
for (const order of orderMap.values()) {
  const status = byStatus[order.status] || { orders: 0, total: 0, refunded: 0 };
  status.orders += 1;
  status.total += order.total;
  status.refunded += order.refunded;
  byStatus[order.status] = status;
  bySource[order.source] = (bySource[order.source] || 0) + 1;
}

const profile = {
  sourceFile: 'orders_export_1(2).csv',
  columns: header,
  rawLineRows: rows.length,
  uniqueOrders: orderMap.size,
  uniqueOrdersByFinancialStatus: Object.fromEntries(Object.entries(byStatus).map(([key, value]) => [key, { ...value, total: value.total.toFixed(2), refunded: value.refunded.toFixed(2) }])),
  uniqueOrdersBySource: bySource,
  products: [...productMap.values()]
    .sort((left, right) => right.quantity - left.quantity || left.name.localeCompare(right.name))
    .map((product) => ({ ...product, grossLineValueAfterLineDiscount: product.grossLineValueAfterLineDiscount.toFixed(2) })),
};

const piiTerms = /email|name|address|phone|company|city|zip|province|country|customer|billing|shipping/i;
const categoricalFields = header.filter((column) => !piiTerms.test(column));
const attributionFieldSummary = {};
for (const column of categoricalFields) {
  const values = new Map();
  let nonEmptyRows = 0;
  for (const row of rows) {
    const value = String(row[column] ?? '').trim();
    if (!value) continue;
    nonEmptyRows += 1;
    if (values.size <= 50) values.set(value, (values.get(value) || 0) + 1);
  }
  if (nonEmptyRows > 0 && values.size <= 50) {
    attributionFieldSummary[column] = {
      nonEmptyRows,
      values: Object.fromEntries([...values.entries()].sort(([a], [b]) => a.localeCompare(b))),
    };
  }
}
profile.nonPiiCategoricalFieldSummary = attributionFieldSummary;

fs.writeFileSync(output, JSON.stringify(profile, null, 2));
console.log(output);
