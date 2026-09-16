import fs from 'node:fs';
import path from 'node:path';

const resultDir = '/home/ubuntu/.mcp/tool-results';
const output = '/home/ubuntu/calendly_coach_event_inventory.json';
const mapInputOutput = '/home/ubuntu/calendly_coach_event_map_inputs.txt';
const files = fs.readdirSync(resultDir)
  .filter((file) => file.includes('calendly_meetings-list_events') && file.endsWith('.json'))
  .map((file) => path.join(resultDir, file))
  .sort();

const coachAliases = new Map([
  ['Bruce Jones', 'Bruce Jones'],
  ['Deanna Clauson, Health Coach | The Urban Monk', 'Deanna Clausen'],
  ['Naomi Hyman', 'Naomi Hyman'],
  ['Sarah Besocke', 'Sarah Besocke'],
]);

const events = new Map();
for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const event of payload?.structuredContent?.collection ?? []) {
    const memberships = event.event_memberships ?? [];
    const coach = memberships.map((membership) => coachAliases.get(membership.user_name)).find(Boolean);
    if (!coach || !event.uri || events.has(event.uri)) continue;
    events.set(event.uri, {
      eventUri: event.uri,
      coach,
      eventName: event.name ?? '(unnamed)',
      startTime: event.start_time ?? null,
      status: event.status ?? null,
      hostCount: memberships.length,
    });
  }
}

const byCoach = {};
for (const event of events.values()) {
  const coach = byCoach[event.coach] ?? { totalEvents: 0, eventTypes: {}, events: [] };
  coach.totalEvents += 1;
  coach.eventTypes[event.eventName] = (coach.eventTypes[event.eventName] ?? 0) + 1;
  coach.events.push(event);
  byCoach[event.coach] = coach;
}

for (const coach of Object.values(byCoach)) {
  coach.events.sort((left, right) => String(left.startTime).localeCompare(String(right.startTime)));
}

const inventory = {
  referenceWindow: { startInclusive: '2025-09-16T00:00:00Z', endExclusive: '2026-09-17T00:00:00Z' },
  asOfUtc: new Date().toISOString(),
  sourceFiles: files.length,
  coaches: byCoach,
};
fs.writeFileSync(output, JSON.stringify(inventory, null, 2));
const mapInputs = [...events.values()]
  .filter((event) => event.status === 'active' && event.startTime && event.startTime <= inventory.asOfUtc)
  .sort((left, right) => String(left.startTime).localeCompare(String(right.startTime)))
  .map((event) => JSON.stringify({ eventUri: event.eventUri, coach: event.coach, eventType: event.eventName, startTime: event.startTime }));
fs.writeFileSync(mapInputOutput, `${mapInputs.join('\n')}\n`);
console.log(output);
