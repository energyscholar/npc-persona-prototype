#!/usr/bin/env node
/**
 * Persona System Tests (TDD - Tests First)
 *
 * Tests NPC persona loading and validation:
 * - Load from JSON files
 * - Validate required fields
 * - Archetype defaults
 */

const { strict: assert } = require('assert');
const path = require('path');
const fs = require('fs');

// Import will fail until implementation exists
let persona;
try {
  persona = require('../src/persona');
} catch (e) {
  console.error('Persona module not yet implemented.\n');
  persona = {};
}

const {
  loadPersona,
  validatePersona,
  getArchetypeDefaults,
  ARCHETYPES
} = persona;

// Test runner
function runTests(tests) {
  let passed = 0, failed = 0;
  for (const [name, fn] of Object.entries(tests)) {
    try {
      fn();
      console.log(`\x1b[32m✓\x1b[0m ${name}`);
      passed++;
    } catch (e) {
      console.log(`\x1b[31m✗\x1b[0m ${name}`);
      console.log(`    ${e.message}`);
      failed++;
    }
  }
  console.log(`\n${passed}/${passed + failed} tests passed`);
  return failed === 0;
}

// === LOADING TESTS ===

const loadingTests = {
  'loadPersona loads existing persona file': () => {
    // Requires marcus-chen.json to exist
    const p = loadPersona('marcus-chen');
    assert.ok(p, 'Should return persona');
    assert.equal(p.id, 'marcus-chen');
    assert.equal(p.name, 'Marcus Chen');
  },

  'loadPersona throws for missing persona': () => {
    assert.throws(
      () => loadPersona('nonexistent-npc'),
      /not found|does not exist/i
    );
  },

  'loadPersona returns all expected fields': () => {
    const p = loadPersona('marcus-chen');
    assert.ok(p.id, 'Should have id');
    assert.ok(p.name, 'Should have name');
    assert.ok(p.archetype, 'Should have archetype');
    assert.ok(p.world, 'Should have world');
  }
};

// === VALIDATION TESTS ===

const validationTests = {
  'validatePersona accepts valid persona': () => {
    const valid = {
      id: 'test-npc',
      name: 'Test NPC',
      archetype: 'broker',
      world: 'Regina'
    };
    const result = validatePersona(valid);
    assert.equal(result.valid, true);
  },

  'validatePersona requires id': () => {
    const invalid = { name: 'Test', archetype: 'broker', world: 'Regina' };
    const result = validatePersona(invalid);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('id')));
  },

  'validatePersona requires name': () => {
    const invalid = { id: 'test', archetype: 'broker', world: 'Regina' };
    const result = validatePersona(invalid);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('name')));
  },

  'validatePersona requires archetype': () => {
    const invalid = { id: 'test', name: 'Test', world: 'Regina' };
    const result = validatePersona(invalid);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('archetype')));
  },

  'validatePersona requires world': () => {
    const invalid = { id: 'test', name: 'Test', archetype: 'broker' };
    const result = validatePersona(invalid);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('world')));
  },

  'validatePersona checks archetype is known': () => {
    const invalid = { id: 'test', name: 'Test', archetype: 'invalid-type', world: 'Regina' };
    const result = validatePersona(invalid);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('archetype') || e.includes('unknown')));
  }
};

// === ARCHETYPE TESTS ===

const archetypeTests = {
  'ARCHETYPES contains broker': () => {
    assert.ok(ARCHETYPES.broker, 'Should have broker archetype');
  },

  'ARCHETYPES contains contact': () => {
    assert.ok(ARCHETYPES.contact, 'Should have contact archetype');
  },

  'ARCHETYPES contains official': () => {
    assert.ok(ARCHETYPES.official, 'Should have official archetype');
  },

  'getArchetypeDefaults returns broker defaults': () => {
    const defaults = getArchetypeDefaults('broker');
    assert.ok(defaults.systemPrompt, 'Should have system prompt');
    assert.ok(defaults.systemPrompt.includes('broker') || defaults.systemPrompt.includes('cargo'),
      'Prompt should mention broker role');
  },

  'getArchetypeDefaults returns contact defaults': () => {
    const defaults = getArchetypeDefaults('contact');
    assert.ok(defaults.systemPrompt);
    assert.ok(defaults.systemPrompt.includes('information') || defaults.systemPrompt.includes('secrets'));
  },

  'getArchetypeDefaults returns official defaults': () => {
    const defaults = getArchetypeDefaults('official');
    assert.ok(defaults.systemPrompt);
    assert.ok(defaults.systemPrompt.includes('regulation') || defaults.systemPrompt.includes('official'));
  },

  'getArchetypeDefaults throws for unknown archetype': () => {
    assert.throws(
      () => getArchetypeDefaults('unknown-type'),
      /unknown|not found/i
    );
  }
};

// === RUN ALL TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  PERSONA SYSTEM TESTS');
console.log('══════════════════════════════════════════\n');

console.log('--- Loading Tests ---');
const loading = runTests(loadingTests);

console.log('\n--- Validation Tests ---');
const validation = runTests(validationTests);

console.log('\n--- Archetype Tests ---');
const archetype = runTests(archetypeTests);

const allPassed = loading && validation && archetype;
process.exit(allPassed ? 0 : 1);
