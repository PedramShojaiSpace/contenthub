import crypto from 'node:crypto';
import fs from 'node:fs';

const calendlyInput = '/home/ubuntu/coach_conversion_calendly/events-export.csv';
const shopifyInput = '/home/ubuntu/upload/orders_export_1(2).csv';
const output = '/home/ubuntu/coach_conversion_source_normalization.json';

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

function readCsv(file) {
  const [header, ...rawRows] = parseCsv(fs.readFileSync(file, 'utf8'));
  return rawRows.filter((row) => row.length > 1).map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ''])));
}

function hashEmail(value) {
  return crypto.createHash('sha256').update(String(value ?? '').trim().toLowerCase()).digest('hex');
}

function isTruthy(value) {
  return ['true', 'yes', '1'].includes(String(value ?? '').trim().toLowerCase());
}

function normalizeCoach(value) {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized.includes('bruce jones')) return 'Bruce Jones';
  if (normalized.includes('deanna claus')) return 'Deanna Clausen';
  if (normalized.includes('naomi hyman')) return 'Naomi Hyman';
  if (normalized.includes('sarah besocke') || (normalized.includes('sarah') && normalized.includes('besock'))) return 'Sarah Besocke';
  return null;
}

function classifyEvent(eventType) {
  const value = String(eventType ?? '').toLowerCase();
  if (value.includes('explore tier test review') || value.includes('explore test review')) return 'explore_review';
  if (/gut health consultation|30 minute gut consultation|oral health consultation|personalized plan|sleep consultation|fmt consultation|toxicity test review|oral health test review|test review with coach/.test(value)) return 'sales_consult';
  if (/follow-up|follow up|1 on 1|coaching|onboarding|graduation|check-in|check in|action plan/.test(value)) return 'follow_up_or_service';
  return 'other';
}

function classifyProduct(name) {
  const value = String(name ?? '').toLowerCase();
  if (/sage program|catalyst|fmt program|deep sleep solution sage/.test(value)) return 'big_ticket';
  if (/explore testing tier|orobiome explore tier|explore tier.*upgrade path/.test(value)) return 'explore';
  if (/orobiome testing package|fit 22|gut permeability|deep sleep testing kit|home sick home|interconnected supported|full gut testing upgrade|gut test kit|oral testing and consultation/.test(value)) return 'basic';
  return 'other';
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const calendlyRows = readCsv(calendlyInput);
const shopifyRows = readCsv(shopifyInput);
const windowStart = '2025-09-16T00:00:00.000Z';
const windowEnd = '2026-09-17T00:00:00.000Z';
const appointmentSummary = { rawRows: calendlyRows.length, inWindowRows: 0, byCoach: {}, byClass: {}, unassignedHostLabels: {}, excluded: { canceled: 0, noShow: 0, unassignedCoach: 0, outOfWindow: 0, invalidDate: 0 } };
const appointmentHashes = new Set();
for (const row of calendlyRows) {
  const coach = normalizeCoach(row['User Name']);
  const date = parseDate(row['Start Date & Time']);
  const canceled = isTruthy(row.Canceled);
  const noShow = isTruthy(row['Marked as No-Show']);
  if (!date) { appointmentSummary.excluded.invalidDate += 1; continue; }
  if (date < windowStart || date >= windowEnd) { appointmentSummary.excluded.outOfWindow += 1; continue; }
  appointmentSummary.inWindowRows += 1;
  if (canceled) { appointmentSummary.excluded.canceled += 1; continue; }
  if (noShow) { appointmentSummary.excluded.noShow += 1; continue; }
  if (!coach) {
    appointmentSummary.excluded.unassignedCoach += 1;
    const label = String(row['User Name'] ?? '').trim() || '(blank)';
    appointmentSummary.unassignedHostLabels[label] = (appointmentSummary.unassignedHostLabels[label] ?? 0) + 1;
    continue;
  }
  const eventClass = classifyEvent(row['Event Type Name']);
  appointmentSummary.byCoach[coach] ??= { activeNonNoShow: 0, classes: {}, uniqueInviteeHashes: new Set() };
  appointmentSummary.byCoach[coach].activeNonNoShow += 1;
  appointmentSummary.byCoach[coach].classes[eventClass] = (appointmentSummary.byCoach[coach].classes[eventClass] ?? 0) + 1;
  const inviteeHash = hashEmail(row['Invitee Email']);
  appointmentSummary.byCoach[coach].uniqueInviteeHashes.add(inviteeHash);
  appointmentHashes.add(inviteeHash);
  appointmentSummary.byClass[eventClass] = (appointmentSummary.byClass[eventClass] ?? 0) + 1;
}

for (const coach of Object.values(appointmentSummary.byCoach)) {
  coach.uniqueInviteeHashes = coach.uniqueInviteeHashes.size;
}

const orderMap = new Map();
for (const row of shopifyRows) {
  const orderId = String(row.Id ?? '').trim();
  if (!orderId) continue;
  const current = orderMap.get(orderId) ?? {
    financialStatus: String(row['Financial Status'] ?? '').trim().toLowerCase(),
    emailHash: hashEmail(row.Email),
    paidAt: parseDate(row['Paid at'] || row['Created at']),
    classes: new Set(),
  };
  current.classes.add(classifyProduct(row['Lineitem name']));
  orderMap.set(orderId, current);
}

const orderSummary = { uniqueOrders: orderMap.size, includedOrders: 0, withAppointmentEmailMatch: 0, byFinancialStatus: {}, tierOrderCounts: { basic: 0, explore: 0, big_ticket: 0, other: 0 } };
for (const order of orderMap.values()) {
  orderSummary.byFinancialStatus[order.financialStatus] = (orderSummary.byFinancialStatus[order.financialStatus] ?? 0) + 1;
  const included = ['paid', 'partially_refunded'].includes(order.financialStatus);
  if (!included) continue;
  orderSummary.includedOrders += 1;
  if (appointmentHashes.has(order.emailHash)) orderSummary.withAppointmentEmailMatch += 1;
  for (const tier of ['basic', 'explore', 'big_ticket']) {
    if (order.classes.has(tier)) orderSummary.tierOrderCounts[tier] += 1;
  }
  if (![...order.classes].some((tier) => ['basic', 'explore', 'big_ticket'].includes(tier))) orderSummary.tierOrderCounts.other += 1;
}

fs.writeFileSync(output, JSON.stringify({
  analysisWindow: { startInclusive: windowStart, endExclusive: windowEnd },
  appointmentSummary,
  orderSummary,
}, null, 2));
console.log(output);
