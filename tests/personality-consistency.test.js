/**
 * Tests for NPC personality consistency
 *
 * Audit: .claude/plans/agm-orchestration-audit.md
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Helper to load NPC
function loadNpc(npcId) {
  const npcPath = path.join(__dirname, '../data/npcs', `${npcId}.json`);
  if (!fs.existsSync(npcPath)) return null;
  return JSON.parse(fs.readFileSync(npcPath, 'utf8'));
}

// Ready-tier NPCs (from audit spec)
const READY_NPCS = [
  'minister-greener',
  'customs-officer-walston',
  'startown-bartender',
  'vargr-chauffeur'
];

// TEST P.1: Ready-tier NPCs have voice field
test('Ready-tier NPCs have voice field', () => {
  for (const npcId of READY_NPCS) {
    const npc = loadNpc(npcId);
    assert.ok(npc, `NPC ${npcId} should exist`);
    assert.ok(npc.voice, `NPC ${npcId} should have voice field`);
  }
});

// TEST P.2: voice has required fields
test('voice has required fields', () => {
  for (const npcId of READY_NPCS) {
    const npc = loadNpc(npcId);
    assert.ok(npc.voice.style, `NPC ${npcId} voice should have style`);
    assert.ok(npc.voice.tone, `NPC ${npcId} voice should have tone`);
  }
});

// TEST P.3: speech_patterns defined
test('speech_patterns defined', () => {
  for (const npcId of READY_NPCS) {
    const npc = loadNpc(npcId);
    assert.ok(npc.voice.speech_patterns, `NPC ${npcId} should have speech_patterns`);
    assert.ok(
      npc.voice.speech_patterns.length >= 2,
      `NPC ${npcId} should have at least 2 speech patterns`
    );
  }
});

// TEST P.4: Different NPCs have different voices
test('Different NPCs have different voices', () => {
  const greener = loadNpc('minister-greener');
  const bartender = loadNpc('startown-bartender');

  // They should have different styles or tones
  const greenerVoice = `${greener.voice.style}-${greener.voice.tone}`;
  const bartenderVoice = `${bartender.voice.style}-${bartender.voice.tone}`;

  assert.notStrictEqual(
    greenerVoice,
    bartenderVoice,
    'Greener and bartender should have different voice profiles'
  );
});

// TEST P.5: NPCs have verbal_tics or signature phrases
test('NPCs have verbal_tics or signature phrases', () => {
  let npcWithTics = 0;

  for (const npcId of READY_NPCS) {
    const npc = loadNpc(npcId);
    // Check for verbal_tics or sample_lines as distinguishing elements
    if (
      (npc.voice.verbal_tics && npc.voice.verbal_tics.length > 0) ||
      (npc.voice.sample_lines && npc.voice.sample_lines.length > 0)
    ) {
      npcWithTics++;
    }
  }

  assert.ok(
    npcWithTics >= READY_NPCS.length - 1,
    'At least most NPCs should have verbal_tics or sample_lines'
  );
});

// TEST P.6: Sample dialogue exists for ready NPCs
test('Sample dialogue exists for ready NPCs', () => {
  for (const npcId of READY_NPCS) {
    const npc = loadNpc(npcId);
    // Check for sample_dialogue or voice.sample_lines
    const hasSamples =
      (npc.sample_dialogue && npc.sample_dialogue.length >= 2) ||
      (npc.voice.sample_lines && npc.voice.sample_lines.length >= 2);

    assert.ok(hasSamples, `NPC ${npcId} should have at least 2 sample dialogue lines`);
  }
});

// Run tests
async function runTests() {
  console.log('Running personality consistency tests...\n');

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
