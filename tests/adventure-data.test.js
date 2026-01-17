#!/usr/bin/env node
/**
 * Adventure Data Loader Tests
 *
 * Tests loading of adventure-specific data:
 * - Items, skill checks, timeline
 * - NPC-specific data lookups
 */

const { strict: assert } = require('assert');

// Import module
let adventureData;
try {
  adventureData = require('../src/adventure-data');
} catch (e) {
  console.error('Adventure data module load error:', e.message);
  process.exit(1);
}

const {
  loadItems,
  loadSkillChecks,
  loadTimeline,
  getItem,
  getItemsByRole,
  getSkillCheck,
  getRelevantChecks,
  getNpcTimingKnowledge,
  getTravelDuration,
  getCreature
} = adventureData;

// Test runner
let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    passed++;
  } catch (e) {
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

// =============================================================================
// Load Functions Tests
// =============================================================================

console.log('\n▸ Load Functions');

test('loadItems returns data for high-and-dry', () => {
  const items = loadItems('high-and-dry');
  assert.ok(items, 'Should return items data');
  assert.ok(items.pc_equipment, 'Should have pc_equipment');
  assert.ok(items.creatures, 'Should have creatures');
});

test('loadItems returns null for unknown adventure', () => {
  const items = loadItems('nonexistent');
  assert.strictEqual(items, null, 'Should return null');
});

test('loadSkillChecks returns data for high-and-dry', () => {
  const checks = loadSkillChecks('high-and-dry');
  assert.ok(checks, 'Should return skill checks data');
  assert.ok(checks.difficulty_scale, 'Should have difficulty_scale');
  assert.ok(checks.skill_checks_by_scene, 'Should have skill_checks_by_scene');
});

test('loadTimeline returns data for high-and-dry', () => {
  const timeline = loadTimeline('high-and-dry');
  assert.ok(timeline, 'Should return timeline data');
  assert.ok(timeline.travel_durations, 'Should have travel_durations');
  assert.ok(timeline.npc_timing_knowledge, 'Should have npc_timing_knowledge');
});

// =============================================================================
// Item Lookup Tests
// =============================================================================

console.log('\n▸ Item Lookups');

test('getItem finds circuit-panel-cases', () => {
  const item = getItem('circuit-panel-cases', 'high-and-dry');
  assert.ok(item, 'Should find item');
  assert.ok(item.name.includes('Circuit Panel'), 'Should have correct name');
});

test('getItem returns null for unknown item', () => {
  const item = getItem('nonexistent-item', 'high-and-dry');
  assert.strictEqual(item, null, 'Should return null');
});

test('getItemsByRole returns items for minister-greener', () => {
  const items = getItemsByRole('minister-greener', 'high-and-dry');
  assert.ok(Array.isArray(items), 'Should return array');
  assert.ok(items.length > 0, 'Should have items');
  const hasPayment = items.some(i => i.path.includes('greener_offer'));
  assert.ok(hasPayment, 'Should include greener payment offer');
});

test('getItemsByRole returns empty array for unknown NPC', () => {
  const items = getItemsByRole('unknown-npc', 'high-and-dry');
  assert.ok(Array.isArray(items), 'Should return array');
  assert.strictEqual(items.length, 0, 'Should be empty');
});

// =============================================================================
// Skill Check Tests
// =============================================================================

console.log('\n▸ Skill Check Lookups');

test('getSkillCheck finds mountain_climb.outcrop-climb', () => {
  const check = getSkillCheck('mountain_climb.outcrop-climb', 'high-and-dry');
  assert.ok(check, 'Should find check');
  assert.strictEqual(check.id, 'outcrop-climb', 'Should have correct id');
  assert.strictEqual(check.skill, 'Athletics', 'Should have correct skill');
  assert.ok(check.difficulty.includes('6+'), 'Should have correct difficulty');
});

test('getSkillCheck returns null for unknown check', () => {
  const check = getSkillCheck('nonexistent.check', 'high-and-dry');
  assert.strictEqual(check, null, 'Should return null');
});

test('getRelevantChecks returns checks for mountain-climb scene', () => {
  const checks = getRelevantChecks('mountain-climb', 'high-and-dry');
  assert.ok(Array.isArray(checks), 'Should return array');
  assert.ok(checks.length >= 5, 'Should have at least 5 checks');
  const hasOutcrop = checks.some(c => c.id === 'outcrop-climb');
  assert.ok(hasOutcrop, 'Should include outcrop-climb');
});

test('getRelevantChecks returns empty for unknown scene', () => {
  const checks = getRelevantChecks('unknown-scene', 'high-and-dry');
  assert.ok(Array.isArray(checks), 'Should return array');
  assert.strictEqual(checks.length, 0, 'Should be empty');
});

// =============================================================================
// Timeline Tests
// =============================================================================

console.log('\n▸ Timeline Lookups');

test('getNpcTimingKnowledge returns data for captain-corelli', () => {
  const knowledge = getNpcTimingKnowledge('captain-corelli', 'high-and-dry');
  assert.ok(knowledge, 'Should return knowledge');
  assert.ok(knowledge.knows, 'Should have knows array');
  assert.ok(knowledge.knows.length > 0, 'Should have knowledge items');
  const hasJumpTime = knowledge.knows.some(k => k.includes('168 hours'));
  assert.ok(hasJumpTime, 'Should know about jump duration');
});

test('getNpcTimingKnowledge returns data for minister-greener', () => {
  const knowledge = getNpcTimingKnowledge('minister-greener', 'high-and-dry');
  assert.ok(knowledge, 'Should return knowledge');
  assert.ok(knowledge.knows.some(k => k.includes('Survey')), 'Should know about survey duration');
});

test('getNpcTimingKnowledge returns null for unknown NPC', () => {
  const knowledge = getNpcTimingKnowledge('unknown-npc', 'high-and-dry');
  assert.strictEqual(knowledge, null, 'Should return null');
});

test('getTravelDuration returns flammarion_to_567908 duration', () => {
  const duration = getTravelDuration('flammarion_to_567908', 'high-and-dry');
  assert.ok(duration, 'Should return duration');
  assert.ok(duration.duration.includes('168'), 'Should have correct duration');
});

// =============================================================================
// Creature Tests
// =============================================================================

console.log('\n▸ Creature Lookups');

test('getCreature returns tenshers_wolf stats', () => {
  const creature = getCreature('tenshers_wolf', 'high-and-dry');
  assert.ok(creature, 'Should return creature');
  assert.ok(creature.name.includes('Tensher'), 'Should have correct name');
  assert.strictEqual(creature.hits, 36, 'Should have correct hits');
  assert.ok(creature.notes.includes('Kimbley'), 'Should mention pet name');
});

test('getCreature returns null for unknown creature', () => {
  const creature = getCreature('unknown-creature', 'high-and-dry');
  assert.strictEqual(creature, null, 'Should return null');
});

// =============================================================================
// Summary
// =============================================================================

console.log('\n' + '─'.repeat(40));
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('─'.repeat(40) + '\n');

process.exit(failed > 0 ? 1 : 0);
