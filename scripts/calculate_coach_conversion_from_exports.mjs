import crypto from 'node:crypto';
import fs from 'node:fs';

const calendlyInput = '/home/ubuntu/coach_conversion_calendly/events-export.csv';
const shopifyInput = '/home/ubuntu/upload/orders_export_1(2).csv';
const output = '/home/ubuntu/coach_conversion_calculation.json';
const windowStart = new Date('2025-09-16T00:00:00.000Z');
const windowEnd = new Date('2026-09-17T00:00:00.000Z');
const attributionWindowDays = 180;
const maturityCutoff = new Date(windowEnd.getTime() - attributionWindowDays * 86400000);
const coachNames = ['Bruce Jones', 'Deanna Clausen', 'Naomi Hyman', 'Sarah Besocke'];

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

function emailHash(value) {
  return crypto.createHash('sha256').update(String(value ?? '').trim().toLowerCase()).digest('hex');
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
  if (/follow-up|follow up|1 on 1|coaching|onboarding|graduation|check-in|check in|action plan|test review|explore tier test review|explore test review/.test(value)) return 'follow_up_or_service';
  if (/gut health consultation|30 minute gut consultation|oral health consultation|personalized plan|sleep consultation|fmt consultation|toxicity test review/.test(value)) return 'sales_consult';
  return 'other';
}

function classifyProduct(name) {
  const value = String(name ?? '').toLowerCase();
  if (/sage program|catalyst|fmt program|deep sleep solution sage/.test(value)) return 'big_ticket';
  if (/explore testing tier|orobiome explore tier|explore tier.*upgrade path/.test(value)) return 'explore';
  if (/orobiome testing package|fit 22|gut permeability|deep sleep testing kit|home sick home|interconnected supported|full gut testing upgrade|gut test kit|oral testing and consultation/.test(value)) return 'basic';
  return 'other';
}

function withinWindow(date) {
  return date && date >= windowStart && date < windowEnd;
}

function withinDays(later, earlier, days) {
  return later > earlier && later.getTime() - earlier.getTime() <= days * 86400000;
}

function rate(numerator, denominator) {
  return denominator ? Number(((numerator / denominator) * 100).toFixed(1)) : null;
}

function latestEligibleConsult(consults, orderDate) {
  return consults
    .filter((consult) => consult.date <= orderDate && orderDate.getTime() - consult.date.getTime() <= attributionWindowDays * 86400000)
    .sort((left, right) => right.date - left.date)[0] ?? null;
}

const appointments = new Map();
const appointmentHistory = new Map();
const rawAppointmentCounts = { rows: 0, excludedCanceled: 0, excludedNoShow: 0, excludedOutOfWindow: 0, excludedUnassignedHost: 0 };
for (const row of readCsv(calendlyInput)) {
  rawAppointmentCounts.rows += 1;
  const date = parseDate(row['Start Date & Time']);
  const coach = normalizeCoach(row['User Name']);
  if (isTruthy(row.Canceled)) { rawAppointmentCounts.excludedCanceled += 1; continue; }
  if (isTruthy(row['Marked as No-Show'])) { rawAppointmentCounts.excludedNoShow += 1; continue; }
  const eventClass = classifyEvent(row['Event Type Name']);
  const hash = emailHash(row['Invitee Email']);
  const event = { coach, eventClass, date };
  const history = appointmentHistory.get(hash) ?? [];
  history.push(event);
  appointmentHistory.set(hash, history);
  if (!withinWindow(date)) { rawAppointmentCounts.excludedOutOfWindow += 1; continue; }
  if (!coach) { rawAppointmentCounts.excludedUnassignedHost += 1; continue; }
  const list = appointments.get(hash) ?? [];
  list.push(event);
  appointments.set(hash, list);
}

for (const list of appointments.values()) list.sort((left, right) => left.date - right.date);
for (const list of appointmentHistory.values()) list.sort((left, right) => left.date - right.date);
for (const [customerHash, list] of appointments.entries()) {
  const relationshipHistory = appointmentHistory.get(customerHash) ?? [];
  const firstRelationshipEvent = relationshipHistory.find((item) => item.eventClass === 'sales_consult' || item.eventClass === 'follow_up_or_service');
  for (const item of list) item.isInitialSalesConsult = item.eventClass === 'sales_consult' && item === firstRelationshipEvent;
}

const orders = new Map();
for (const row of readCsv(shopifyInput)) {
  const orderId = String(row.Id ?? '').trim();
  const paidAt = parseDate(row['Paid at'] || row['Created at']);
  if (!orderId || !withinWindow(paidAt) || String(row['Financial Status'] ?? '').trim().toLowerCase() !== 'paid') continue;
  const order = orders.get(orderId) ?? { customerHash: emailHash(row.Email), paidAt, tiers: new Set() };
  order.tiers.add(classifyProduct(row['Lineitem name']));
  orders.set(orderId, order);
}

const customerOrders = new Map();
for (const order of orders.values()) {
  const list = customerOrders.get(order.customerHash) ?? [];
  list.push(order);
  customerOrders.set(order.customerHash, list);
}
for (const list of customerOrders.values()) list.sort((left, right) => left.paidAt - right.paidAt);

const report = Object.fromEntries(coachNames.map((coach) => [coach, {
  salesConsultAppointments: 0,
  uniqueSalesConsultInvitees: new Set(),
  maturedConsultInvitees: new Set(),
  consultToPaidProgram: { denominator: new Set(), numerator: new Set() },
  consultToBasic: { denominator: new Set(), numerator: new Set() },
  consultToExplore: { denominator: new Set(), numerator: new Set() },
  maturedConsultToExplore: { denominator: new Set(), numerator: new Set() },
  basicToHighTicket: { denominator: new Set(), numerator: new Set() },
  maturedBasicToHighTicket: { denominator: new Set(), numerator: new Set() },
  exploreToBigTicket: { denominator: new Set(), numerator: new Set() },
  maturedExploreToBigTicket: { denominator: new Set(), numerator: new Set() },
}]));

let multicoachConsultInvitees = 0;
for (const [customerHash, items] of appointments.entries()) {
  const consultations = items.filter((item) => item.isInitialSalesConsult);
  const coaches = new Set(consultations.map((item) => item.coach));
  if (coaches.size > 1) multicoachConsultInvitees += 1;
  for (const consultation of consultations) {
    report[consultation.coach].salesConsultAppointments += 1;
    report[consultation.coach].uniqueSalesConsultInvitees.add(customerHash);
    if (consultation.date <= maturityCutoff) report[consultation.coach].maturedConsultInvitees.add(customerHash);
  }
}

for (const [customerHash, customerOrderList] of customerOrders.entries()) {
  const consults = (appointments.get(customerHash) ?? []).filter((item) => item.isInitialSalesConsult);
  if (!consults.length) continue;
  const firstBasic = customerOrderList.find((order) => order.tiers.has('basic'));
  const firstExplore = customerOrderList.find((order) => order.tiers.has('explore'));
  const firstPaidProgram = customerOrderList.find((order) => order.tiers.has('basic') || order.tiers.has('explore') || order.tiers.has('big_ticket'));

  if (firstPaidProgram) {
    const owner = latestEligibleConsult(consults, firstPaidProgram.paidAt);
    if (owner) {
      report[owner.coach].consultToPaidProgram.denominator.add(customerHash);
      report[owner.coach].consultToPaidProgram.numerator.add(customerHash);
    }
  }

  if (firstBasic) {
    const owner = latestEligibleConsult(consults, firstBasic.paidAt);
    if (owner) {
      report[owner.coach].consultToBasic.denominator.add(customerHash);
      report[owner.coach].consultToBasic.numerator.add(customerHash);
      report[owner.coach].basicToHighTicket.denominator.add(customerHash);
      const upgraded = customerOrderList.some((order) => withinDays(order.paidAt, firstBasic.paidAt, attributionWindowDays) && (order.tiers.has('explore') || order.tiers.has('big_ticket')));
      if (upgraded) report[owner.coach].basicToHighTicket.numerator.add(customerHash);
      if (firstBasic.paidAt <= maturityCutoff) {
        report[owner.coach].maturedBasicToHighTicket.denominator.add(customerHash);
        if (upgraded) report[owner.coach].maturedBasicToHighTicket.numerator.add(customerHash);
      }
    }
  }

  if (firstExplore) {
    const owner = latestEligibleConsult(consults, firstExplore.paidAt);
    if (owner) {
      report[owner.coach].consultToExplore.denominator.add(customerHash);
      report[owner.coach].consultToExplore.numerator.add(customerHash);
      if (owner.date <= maturityCutoff) {
        report[owner.coach].maturedConsultToExplore.denominator.add(customerHash);
        report[owner.coach].maturedConsultToExplore.numerator.add(customerHash);
      }
      report[owner.coach].exploreToBigTicket.denominator.add(customerHash);
      const upgraded = customerOrderList.some((order) => withinDays(order.paidAt, firstExplore.paidAt, attributionWindowDays) && order.tiers.has('big_ticket'));
      if (upgraded) report[owner.coach].exploreToBigTicket.numerator.add(customerHash);
      if (firstExplore.paidAt <= maturityCutoff) {
        report[owner.coach].maturedExploreToBigTicket.denominator.add(customerHash);
        if (upgraded) report[owner.coach].maturedExploreToBigTicket.numerator.add(customerHash);
      }
    }
  }
}

const coachResults = {};
for (const coach of coachNames) {
  const metrics = report[coach];
  const consultDenominator = metrics.uniqueSalesConsultInvitees.size;
  coachResults[coach] = {
    salesConsultAppointments: metrics.salesConsultAppointments,
    uniqueSalesConsultInvitees: consultDenominator,
    consultToPaidProgram: {
      denominator: consultDenominator,
      numerator: metrics.consultToPaidProgram.numerator.size,
      ratePct: rate(metrics.consultToPaidProgram.numerator.size, consultDenominator),
    },
    consultToBasic: {
      denominator: consultDenominator,
      numerator: metrics.consultToBasic.numerator.size,
      ratePct: rate(metrics.consultToBasic.numerator.size, consultDenominator),
    },
    basicToHighTicket: {
      denominator: metrics.basicToHighTicket.denominator.size,
      numerator: metrics.basicToHighTicket.numerator.size,
      ratePct: rate(metrics.basicToHighTicket.numerator.size, metrics.basicToHighTicket.denominator.size),
    },
    maturedBasicToHighTicket: {
      denominator: metrics.maturedBasicToHighTicket.denominator.size,
      numerator: metrics.maturedBasicToHighTicket.numerator.size,
      ratePct: rate(metrics.maturedBasicToHighTicket.numerator.size, metrics.maturedBasicToHighTicket.denominator.size),
    },
    consultToExplore: {
      denominator: consultDenominator,
      numerator: metrics.consultToExplore.numerator.size,
      ratePct: rate(metrics.consultToExplore.numerator.size, consultDenominator),
    },
    maturedConsultToExplore: {
      denominator: metrics.maturedConsultInvitees.size,
      numerator: metrics.maturedConsultToExplore.numerator.size,
      ratePct: rate(metrics.maturedConsultToExplore.numerator.size, metrics.maturedConsultInvitees.size),
    },
    exploreToBigTicket: {
      denominator: metrics.exploreToBigTicket.denominator.size,
      numerator: metrics.exploreToBigTicket.numerator.size,
      ratePct: rate(metrics.exploreToBigTicket.numerator.size, metrics.exploreToBigTicket.denominator.size),
    },
    maturedExploreToBigTicket: {
      denominator: metrics.maturedExploreToBigTicket.denominator.size,
      numerator: metrics.maturedExploreToBigTicket.numerator.size,
      ratePct: rate(metrics.maturedExploreToBigTicket.numerator.size, metrics.maturedExploreToBigTicket.denominator.size),
    },
  };
}

const results = {
  methodology: {
    analysisWindowUtc: { startInclusive: windowStart.toISOString(), endExclusive: windowEnd.toISOString() },
    paymentInclusion: 'Shopify orders with Financial Status = paid only; partially refunded and refunded orders excluded.',
    appointmentInclusion: 'Calendly records in-window, not canceled, not marked no-show, hosted by a named coach, using sales-consultation event types.',
    coachCredit: `Named coach's first identifiable sales-stage consultation after no prior consultation, coaching, follow-up, review, onboarding, or action-plan event in the supplied Calendly history; initial relevant paid order must occur within ${attributionWindowDays} days.`,
    maturityCutoffUtc: maturityCutoff.toISOString(),
    highTicketDefinition: 'Explore tier or big-ticket tier.',
    bigTicketDefinition: 'SAGE Program, Catalyst, FMT Program, or Deep Sleep Solution SAGE variants.',
  },
  sourceCoverage: {
    rawAppointmentCounts,
    includedPaidShopifyOrders: orders.size,
    uniqueAppointmentInvitees: appointments.size,
    appointmentToPaidOrderEmailMatches: [...customerOrders.keys()].filter((hash) => appointments.has(hash)).length,
    multicoachConsultInvitees,
    missingCoachCoverage: coachResults['Sarah Besocke'].uniqueSalesConsultInvitees === 0 ? ['Sarah Besocke'] : [],
  },
  coachResults,
};

fs.writeFileSync(output, JSON.stringify(results, null, 2));
console.log(output);
