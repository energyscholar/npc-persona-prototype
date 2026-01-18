/**
 * Tests for narrator/NPC voice mixing system
 *
 * Audit: .claude/plans/narrator-npc-voice-mixing-audit.md
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Helper to load NPC JSON
function loadNpc(npcId) {
  const npcPath = path.join(__dirname, '../data/npcs', `${npcId}.json`);
  if (!fs.existsSync(npcPath)) return null;
  return JSON.parse(fs.readFileSync(npcPath, 'utf8'));
}

// TEST V.1: NPCs have voice field
test('NPCs have voice field', () => {
  const customs = loadNpc('customs-officer-walston');
  assert.ok(customs, 'Customs officer NPC should exist');
  assert.ok(customs.voice, 'NPC should have voice field');
  assert.ok(customs.voice.style, 'Voice should have style');
  assert.ok(customs.voice.sample_lines, 'Voice should have sample_lines');
  assert.ok(customs.voice.sample_lines.length > 0, 'Should have at least one sample line');
});

// TEST V.2: Voice profile loads
test('Voice profile loads', () => {
  const { getVoiceProfile } = require('../src/voice-profiles');
  const voice = getVoiceProfile('customs-officer-walston');
  assert.ok(voice, 'Should return voice profile');
  assert.ok(voice.tone, 'Voice should have tone');
  assert.ok(voice.style, 'Voice should have style');
});

// TEST V.3: Dialogue formatting works
test('Dialogue formatting works', () => {
  const { formatNpcDialogue } = require('../src/voice-profiles');
  const formatted = formatNpcDialogue('customs-officer-walston', 'Papers.');
  assert.ok(formatted, 'Should return formatted dialogue');
  assert.ok(formatted.includes('**'), 'Should include bold markers');
  assert.ok(formatted.includes('Papers.'), 'Should include dialogue');
});

// TEST V.4: Scene NPC context builds
test('Scene NPC context builds', () => {
  const { buildNpcVoiceContext } = require('../src/scene-npc-context');
  const ctx = buildNpcVoiceContext(['customs-officer-walston']);
  assert.ok(ctx, 'Should build context');
  assert.ok(
    ctx.toLowerCase().includes('customs') || ctx.toLowerCase().includes('officer'),
    'Context should mention customs officer'
  );
});

// TEST V.5: Multiple NPCs in context
test('Multiple NPCs in context', () => {
  const { buildNpcVoiceContext } = require('../src/scene-npc-context');
  const ctx = buildNpcVoiceContext(['minister-greener', 'customs-officer-walston']);
  assert.ok(ctx, 'Should build context for multiple NPCs');
  // Should mention both NPCs
  const lower = ctx.toLowerCase();
  assert.ok(
    lower.includes('greener') || lower.includes('minister'),
    'Should mention Minister Greener'
  );
  assert.ok(
    lower.includes('customs') || lower.includes('officer'),
    'Should mention Customs Officer'
  );
});

// TEST V.6: Scene provides NPC list
test('Scene provides NPC list', () => {
  const { getNpcsForScene } = require('../src/scene-npc-context');
  const npcs = getNpcsForScene('high-and-dry', 'starport-arrival');
  assert.ok(npcs, 'Should return NPC list');
  assert.ok(Array.isArray(npcs), 'Should be an array');
  assert.ok(
    npcs.includes('customs-officer-walston'),
    'Starport arrival should include customs officer'
  );
});

// Run tests
async function runTests() {
  console.log('Running voice mixing tests...\n');

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✓ ${t.name}`);
      passed++;
    } catch (err) {
      console.log(`✗ ${t.name}`);
      console.log(`  ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
