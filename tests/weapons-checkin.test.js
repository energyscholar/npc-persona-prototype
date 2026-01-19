/**
 * Weapons Check-In System Tests
 *
 * Audit: .claude/plans/vectorized-cuddling-teacup.md
 *
 * Tests weapons legality, storage, confiscation, and encounter logic
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Helper to create test session
function createTestSession(inventory = []) {
  return {
    storyState: {
      inventory: inventory,
      flags: {},
      currentScene: 'test-scene'
    }
  };
}

// Helper to create test weapons
function createTestWeapons() {
  return [
    {
      id: 'autopistol-standard',
      name: 'Autopistol',
      type: 'weapon',
      subtype: 'firearm',
      legal_at_law_level: 5
    },
    {
      id: 'blade-combat',
      name: 'Combat Blade',
      type: 'weapon',
      subtype: 'blade',
      legal_at_law_level: 8
    }
  ];
}

// Helper to load JSON file
function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// ============================================================
// W.1: PC weapons defined with legal_at_law_level
// ============================================================

test('W.1a: alex-ryder.json has personal_weapons array', () => {
  const pcData = loadJson(path.join(__dirname, '../data/pcs/alex-ryder.json'));
  assert.ok(pcData.personal_weapons, 'Should have personal_weapons');
  assert.ok(Array.isArray(pcData.personal_weapons), 'personal_weapons should be array');
  assert.ok(pcData.personal_weapons.length > 0, 'Should have at least one weapon');
});

test('W.1b: each weapon has required fields', () => {
  const pcData = loadJson(path.join(__dirname, '../data/pcs/alex-ryder.json'));
  for (const weapon of pcData.personal_weapons) {
    assert.ok(weapon.id, 'Weapon should have id');
    assert.ok(weapon.name, 'Weapon should have name');
    assert.strictEqual(weapon.type, 'weapon', 'Type should be weapon');
    assert.ok(weapon.subtype, 'Weapon should have subtype');
    assert.strictEqual(typeof weapon.legal_at_law_level, 'number', 'legal_at_law_level should be number');
  }
});

test('W.1c: autopistol is illegal at law level 8', () => {
  const pcData = loadJson(path.join(__dirname, '../data/pcs/alex-ryder.json'));
  const autopistol = pcData.personal_weapons.find(w => w.subtype === 'firearm');
  assert.ok(autopistol, 'Should have a firearm');
  assert.ok(autopistol.legal_at_law_level < 8, 'Firearm should be illegal at LL8');
});

test('W.1d: blade is legal at law level 8', () => {
  const pcData = loadJson(path.join(__dirname, '../data/pcs/alex-ryder.json'));
  const blade = pcData.personal_weapons.find(w => w.subtype === 'blade');
  assert.ok(blade, 'Should have a blade');
  assert.ok(blade.legal_at_law_level >= 8, 'Blade should be legal at LL8');
});

// ============================================================
// W.2: getIllegalItems function
// ============================================================

test('W.2a: getIllegalItems returns weapons below law level threshold', () => {
  const { getIllegalItems } = require('../src/inventory');
  const weapons = createTestWeapons();
  const session = createTestSession(weapons);

  const illegal = getIllegalItems(session, 8);

  assert.strictEqual(illegal.length, 1, 'Should return 1 illegal weapon');
  assert.strictEqual(illegal[0].id, 'autopistol-standard', 'Should be autopistol');
});

test('W.2b: getIllegalItems does not return weapons at or above law level', () => {
  const { getIllegalItems } = require('../src/inventory');
  const weapons = createTestWeapons();
  const session = createTestSession(weapons);

  const illegal = getIllegalItems(session, 8);

  assert.ok(!illegal.find(w => w.id === 'blade-combat'), 'Should not include blade');
});

test('W.2c: getIllegalItems does not return stored items', () => {
  const { getIllegalItems } = require('../src/inventory');
  const weapons = createTestWeapons();
  weapons[0].location = 'starport-customs';
  const session = createTestSession(weapons);

  const illegal = getIllegalItems(session, 8);

  assert.strictEqual(illegal.length, 0, 'Should return empty array');
});

test('W.2d: getIllegalItems returns empty array when no illegal weapons', () => {
  const { getIllegalItems } = require('../src/inventory');
  const session = createTestSession([]);

  const illegal = getIllegalItems(session, 8);

  assert.deepStrictEqual(illegal, [], 'Should return empty array');
});

// ============================================================
// W.3: shouldTriggerEncounter function
// ============================================================

test('W.3a: shouldTriggerEncounter returns true when PC has illegal weapons', () => {
  const { shouldTriggerEncounter } = require('../src/gated-encounters');
  const weapons = createTestWeapons();
  const session = createTestSession(weapons);
  const encounter = { trigger: { prerequisite: { has_illegal_weapons: true } } };
  const worldData = { law_level: 8 };

  const result = shouldTriggerEncounter(session, encounter, worldData);

  assert.strictEqual(result, true, 'Should trigger encounter');
});

test('W.3b: shouldTriggerEncounter returns false when PC has no illegal weapons', () => {
  const { shouldTriggerEncounter } = require('../src/gated-encounters');
  const session = createTestSession([]);
  const encounter = { trigger: { prerequisite: { has_illegal_weapons: true } } };
  const worldData = { law_level: 8 };

  const result = shouldTriggerEncounter(session, encounter, worldData);

  assert.strictEqual(result, false, 'Should not trigger encounter');
});

test('W.3c: shouldTriggerEncounter returns true when no prerequisites', () => {
  const { shouldTriggerEncounter } = require('../src/gated-encounters');
  const session = createTestSession([]);
  const encounter = { trigger: { type: 'scene_entry' } };

  const result = shouldTriggerEncounter(session, encounter, {});

  assert.strictEqual(result, true, 'Should trigger with no prereqs');
});

test('W.3d: shouldTriggerEncounter checks has_flag prerequisite', () => {
  const { shouldTriggerEncounter } = require('../src/gated-encounters');
  const session = createTestSession([]);
  session.storyState.flags = { weapons_checked: true };
  const encounter = { trigger: { prerequisite: { has_flag: 'weapons_checked' } } };

  const result = shouldTriggerEncounter(session, encounter, {});

  assert.strictEqual(result, true, 'Should trigger when flag is set');
});

// ============================================================
// W.4: storeItem function
// ============================================================

test('W.4a: storeItem sets location field on item', () => {
  const { storeItem } = require('../src/inventory');
  const weapons = createTestWeapons();
  const session = createTestSession(weapons);

  storeItem(session, 'autopistol-standard', 'starport-customs');

  const item = session.storyState.inventory.find(i => i.id === 'autopistol-standard');
  assert.strictEqual(item.location, 'starport-customs', 'Location should be set');
});

test('W.4b: storeItem sets stored_at timestamp', () => {
  const { storeItem } = require('../src/inventory');
  const weapons = createTestWeapons();
  const session = createTestSession(weapons);

  storeItem(session, 'autopistol-standard', 'starport-customs');

  const item = session.storyState.inventory.find(i => i.id === 'autopistol-standard');
  assert.ok(item.stored_at, 'Should have stored_at');
  assert.ok(new Date(item.stored_at) instanceof Date, 'Should be valid date');
});

test('W.4c: storeItem handles non-existent item gracefully', () => {
  const { storeItem } = require('../src/inventory');
  const session = createTestSession([]);

  // Should not throw
  storeItem(session, 'nonexistent', 'location');
  assert.ok(true, 'Should not throw');
});

// ============================================================
// W.5: retrieveItem function
// ============================================================

test('W.5a: retrieveItem clears location field', () => {
  const { retrieveItem } = require('../src/inventory');
  const weapons = createTestWeapons();
  weapons[0].location = 'starport-customs';
  weapons[0].stored_at = new Date().toISOString();
  const session = createTestSession(weapons);

  retrieveItem(session, 'autopistol-standard');

  const item = session.storyState.inventory.find(i => i.id === 'autopistol-standard');
  assert.strictEqual(item.location, undefined, 'Location should be cleared');
});

test('W.5b: retrieveItem clears stored_at timestamp', () => {
  const { retrieveItem } = require('../src/inventory');
  const weapons = createTestWeapons();
  weapons[0].location = 'starport-customs';
  weapons[0].stored_at = new Date().toISOString();
  const session = createTestSession(weapons);

  retrieveItem(session, 'autopistol-standard');

  const item = session.storyState.inventory.find(i => i.id === 'autopistol-standard');
  assert.strictEqual(item.stored_at, undefined, 'stored_at should be cleared');
});

test('W.5c: retrieveItem handles non-existent item gracefully', () => {
  const { retrieveItem } = require('../src/inventory');
  const session = createTestSession([]);

  retrieveItem(session, 'nonexistent');
  assert.ok(true, 'Should not throw');
});

// ============================================================
// W.6: confiscateItem function
// ============================================================

test('W.6a: confiscateItem sets confiscated flag to true', () => {
  const { confiscateItem } = require('../src/inventory');
  const weapons = createTestWeapons();
  const session = createTestSession(weapons);

  confiscateItem(session, 'autopistol-standard');

  const item = session.storyState.inventory.find(i => i.id === 'autopistol-standard');
  assert.strictEqual(item.confiscated, true, 'Should be confiscated');
});

test('W.6b: confiscateItem sets confiscated_at timestamp', () => {
  const { confiscateItem } = require('../src/inventory');
  const weapons = createTestWeapons();
  const session = createTestSession(weapons);

  confiscateItem(session, 'autopistol-standard');

  const item = session.storyState.inventory.find(i => i.id === 'autopistol-standard');
  assert.ok(item.confiscated_at, 'Should have confiscated_at');
});

test('W.6c: confiscateItem handles non-existent item gracefully', () => {
  const { confiscateItem } = require('../src/inventory');
  const session = createTestSession([]);

  confiscateItem(session, 'nonexistent');
  assert.ok(true, 'Should not throw');
});

// ============================================================
// W.7: applyEncounterOutcome - weapons_checked
// ============================================================

test('W.7a: weapons_checked stores illegal weapons', () => {
  const { applyEncounterOutcome } = require('../src/gated-encounters');
  const weapons = createTestWeapons();
  const session = createTestSession(weapons);
  const encounter = {
    outcomes: {
      weapons_checked: {
        flags: { weapons_checked_at_starport: true },
        store_items: { location: 'starport-customs', filter: 'illegal_weapons' }
      }
    }
  };

  applyEncounterOutcome(session, encounter, 'weapons_checked');

  const autopistol = session.storyState.inventory.find(i => i.id === 'autopistol-standard');
  assert.strictEqual(autopistol.location, 'starport-customs', 'Should be stored');
});

test('W.7b: weapons_checked sets flag', () => {
  const { applyEncounterOutcome } = require('../src/gated-encounters');
  const weapons = createTestWeapons();
  const session = createTestSession(weapons);
  const encounter = {
    outcomes: {
      weapons_checked: {
        flags: { weapons_checked_at_starport: true },
        store_items: { location: 'starport-customs', filter: 'illegal_weapons' }
      }
    }
  };

  applyEncounterOutcome(session, encounter, 'weapons_checked');

  assert.strictEqual(session.storyState.flags.weapons_checked_at_starport, true, 'Flag should be set');
});

test('W.7c: weapons_checked does not store legal weapons', () => {
  const { applyEncounterOutcome } = require('../src/gated-encounters');
  const weapons = createTestWeapons();
  const session = createTestSession(weapons);
  const encounter = {
    outcomes: {
      weapons_checked: {
        flags: { weapons_checked_at_starport: true },
        store_items: { location: 'starport-customs', filter: 'illegal_weapons' }
      }
    }
  };

  applyEncounterOutcome(session, encounter, 'weapons_checked');

  const blade = session.storyState.inventory.find(i => i.id === 'blade-combat');
  assert.strictEqual(blade.location, undefined, 'Blade should not be stored');
});

// ============================================================
// W.8: applyEncounterOutcome - weapons_confiscated
// ============================================================

test('W.8a: weapons_confiscated marks illegal weapons as confiscated', () => {
  const { applyEncounterOutcome } = require('../src/gated-encounters');
  const weapons = createTestWeapons();
  const session = createTestSession(weapons);
  const encounter = {
    outcomes: {
      weapons_confiscated: {
        flags: { weapons_confiscated: true, legal_issue: true },
        remove_items: { filter: 'illegal_weapons' },
        fine: { amount: 500 }
      }
    }
  };

  applyEncounterOutcome(session, encounter, 'weapons_confiscated');

  const autopistol = session.storyState.inventory.find(i => i.id === 'autopistol-standard');
  assert.strictEqual(autopistol.confiscated, true, 'Should be confiscated');
});

test('W.8b: weapons_confiscated sets legal_issue flag', () => {
  const { applyEncounterOutcome } = require('../src/gated-encounters');
  const weapons = createTestWeapons();
  const session = createTestSession(weapons);
  const encounter = {
    outcomes: {
      weapons_confiscated: {
        flags: { weapons_confiscated: true, legal_issue: true },
        remove_items: { filter: 'illegal_weapons' },
        fine: { amount: 500 }
      }
    }
  };

  applyEncounterOutcome(session, encounter, 'weapons_confiscated');

  assert.strictEqual(session.storyState.flags.legal_issue, true, 'Flag should be set');
});

test('W.8c: weapons_confiscated sets pending fine', () => {
  const { applyEncounterOutcome } = require('../src/gated-encounters');
  const weapons = createTestWeapons();
  const session = createTestSession(weapons);
  const encounter = {
    outcomes: {
      weapons_confiscated: {
        flags: { weapons_confiscated: true, legal_issue: true },
        remove_items: { filter: 'illegal_weapons' },
        fine: { amount: 500 }
      }
    }
  };

  applyEncounterOutcome(session, encounter, 'weapons_confiscated');

  assert.deepStrictEqual(session.storyState.pendingFine, { amount: 500 }, 'Fine should be set');
});

// ============================================================
// W.9: Departure reminder logic
// ============================================================

test('W.9a: getItemsAtLocation returns stored weapons', () => {
  const { getItemsAtLocation } = require('../src/inventory');
  const weapons = createTestWeapons();
  weapons[0].location = 'starport-customs';
  const session = createTestSession(weapons);

  const stored = getItemsAtLocation(session, 'starport-customs');

  assert.strictEqual(stored.length, 1, 'Should return 1 item');
  assert.strictEqual(stored[0].id, 'autopistol-standard', 'Should be autopistol');
});

test('W.9b: getItemsAtLocation returns empty array when no items', () => {
  const { getItemsAtLocation } = require('../src/inventory');
  const weapons = createTestWeapons();
  const session = createTestSession(weapons);

  const stored = getItemsAtLocation(session, 'starport-customs');

  assert.strictEqual(stored.length, 0, 'Should return empty array');
});

// ============================================================
// W.10: Corelli pre-landing dialogue
// ============================================================

test('W.10a: captain-corelli.json has situational_dialogue', () => {
  const npcData = loadJson(path.join(__dirname, '../data/npcs/captain-corelli.json'));
  assert.ok(npcData.situational_dialogue, 'Should have situational_dialogue');
});

test('W.10b: has approaching_walston dialogue entry', () => {
  const npcData = loadJson(path.join(__dirname, '../data/npcs/captain-corelli.json'));
  assert.ok(npcData.situational_dialogue.approaching_walston, 'Should have approaching_walston');
});

test('W.10c: approaching_walston has correct trigger', () => {
  const npcData = loadJson(path.join(__dirname, '../data/npcs/captain-corelli.json'));
  const entry = npcData.situational_dialogue.approaching_walston;
  assert.strictEqual(entry.trigger.scene, 'starport-arrival', 'Should trigger at starport-arrival');
});

test('W.10d: approaching_walston has condition for illegal weapons', () => {
  const npcData = loadJson(path.join(__dirname, '../data/npcs/captain-corelli.json'));
  const entry = npcData.situational_dialogue.approaching_walston;
  assert.strictEqual(entry.condition.pc_has_illegal_weapons, true, 'Should check for illegal weapons');
});

test('W.10e: dialogue mentions law level', () => {
  const npcData = loadJson(path.join(__dirname, '../data/npcs/captain-corelli.json'));
  const entry = npcData.situational_dialogue.approaching_walston;
  assert.ok(entry.dialogue.toLowerCase().includes('law level'), 'Should mention law level');
});

// ============================================================
// W.11: weapons-checkin.json encounter file
// ============================================================

test('W.11a: encounter file exists', () => {
  const filePath = path.join(__dirname, '../data/adventures/high-and-dry/encounters/weapons-checkin.json');
  assert.ok(fs.existsSync(filePath), 'File should exist');
});

test('W.11b: encounter has required structure', () => {
  const encounter = loadJson(path.join(__dirname, '../data/adventures/high-and-dry/encounters/weapons-checkin.json'));
  assert.strictEqual(encounter.id, 'weapons-checkin', 'Should have correct id');
  assert.strictEqual(encounter.scene, 'starport-arrival', 'Should have correct scene');
  assert.ok(encounter.choices, 'Should have choices');
  assert.ok(encounter.outcomes, 'Should have outcomes');
});

test('W.11c: has declare_and_check choice', () => {
  const encounter = loadJson(path.join(__dirname, '../data/adventures/high-and-dry/encounters/weapons-checkin.json'));
  assert.ok(encounter.choices.declare_and_check, 'Should have declare_and_check');
  assert.strictEqual(encounter.choices.declare_and_check.outcome, 'weapons_checked', 'Should map to weapons_checked');
});

test('W.11d: has attempt_concealment choice with skill check', () => {
  const encounter = loadJson(path.join(__dirname, '../data/adventures/high-and-dry/encounters/weapons-checkin.json'));
  assert.ok(encounter.choices.attempt_concealment, 'Should have attempt_concealment');
  assert.ok(encounter.choices.attempt_concealment.skill_check, 'Should have skill_check');
  assert.strictEqual(encounter.choices.attempt_concealment.skill_check.difficulty, 10, 'Difficulty should be 10');
});

test('W.11e: has three outcomes', () => {
  const encounter = loadJson(path.join(__dirname, '../data/adventures/high-and-dry/encounters/weapons-checkin.json'));
  assert.ok(encounter.outcomes.weapons_checked, 'Should have weapons_checked outcome');
  assert.ok(encounter.outcomes.weapons_smuggled, 'Should have weapons_smuggled outcome');
  assert.ok(encounter.outcomes.weapons_confiscated, 'Should have weapons_confiscated outcome');
});

// ============================================================
// W.12: starport-arrival.json scene
// ============================================================

test('W.12a: scene includes weapons-checkin encounter', () => {
  const scene = loadJson(path.join(__dirname, '../data/adventures/high-and-dry/scenes/starport-arrival.json'));
  assert.ok(scene.encounters.includes('weapons-checkin'), 'Should include weapons-checkin');
});

test('W.12b: scene has world_context with law_level', () => {
  const scene = loadJson(path.join(__dirname, '../data/adventures/high-and-dry/scenes/starport-arrival.json'));
  assert.ok(scene.world_context, 'Should have world_context');
  assert.strictEqual(scene.world_context.law_level, 8, 'law_level should be 8');
});

test('W.12c: objectives include weapons declaration', () => {
  const scene = loadJson(path.join(__dirname, '../data/adventures/high-and-dry/scenes/starport-arrival.json'));
  const hasWeaponsObjective = scene.objectives.some(obj => obj.toLowerCase().includes('weapon'));
  assert.ok(hasWeaponsObjective, 'Should have weapons objective');
});

// ============================================================
// Run tests
// ============================================================

async function runTests() {
  console.log('Running weapons check-in tests...\n');

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
