import fs from 'node:fs';

const input = '/home/ubuntu/upload/orders_export_1(2).csv';
const output = '/home/ubuntu/shopify_coach_attribution_coverage.json';
const coachPatterns = [
  ['Bruce Jones', /\bbruce\s+jones\b/i],
  ['Deanna Clausen', /\bdeanna\s+claus(?:on|en)\b/i],
  ['Naomi Hyman', /\bnaomi\s+hyman\b/i],
  ['Sarah Besocke', /\bsarah\s+besocke\b/i],
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(field); field = ''; }
    else if (character === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += character;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const [header, ...rawRows] = parseCsv(fs.readFileSync(input, 'utf8'));
const rows = rawRows.filter((row) => row.length > 1).map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ''])));
const orders = new Map();
for (const row of rows) {
  const id = String(row.Id ?? '').trim();
  if (!id || orders.has(id)) continue;
  const attributionText = [row.Tags, row.Notes, row['Note Attributes']].filter(Boolean).join('\n');
  const matches = coachPatterns.filter(([, pattern]) => pattern.test(attributionText)).map(([coach]) => coach);
  orders.set(id, { financialStatus: String(row['Financial Status'] ?? '').toLowerCase(), matches });
}

const coverage = Object.fromEntries(coachPatterns.map(([coach]) => [coach, { orders: 0, paidOrders: 0, statuses: {} }]));
let multipleCoachOrders = 0;
for (const order of orders.values()) {
  if (order.matches.length > 1) multipleCoachOrders += 1;
  for (const coach of order.matches) {
    coverage[coach].orders += 1;
    if (order.financialStatus === 'paid') coverage[coach].paidOrders += 1;
    coverage[coach].statuses[order.financialStatus] = (coverage[coach].statuses[order.financialStatus] ?? 0) + 1;
  }
}

fs.writeFileSync(output, JSON.stringify({
  sourceFile: 'orders_export_1(2).csv',
  uniqueOrders: orders.size,
  multipleCoachOrders,
  coverage,
}, null, 2));
console.log(output);
