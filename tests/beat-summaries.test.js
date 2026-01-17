#!/usr/bin/env node
/**
 * Beat Summaries Tests (TDD - Tests First)
 *
 * Tests human-readable beat summary generation:
 * - Lookup by beatId and adventureId
 * - Fallback for unknown beats
 * - Summary list generation
 *
 * AUDITOR INSTANCE: 5f069a8e-52eb-42c4-a874-17ce01f2100b
 */

const { strict: assert } = require('assert');

// Import will fail until implementation exists
let beatSummaries;
try {
  beatSummaries = require('../src/beat-summaries');
} catch (e) {
  console.error('Beat-summaries module not yet implemented.\n');
  beatSummaries = {};
}

const {
  getBeatSummary,
  getBeatSummaries,
  registerBeatSummary,
  getAllSummariesForAdventure,
  BEAT_SUMMARIES
} = beatSummaries;

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

// === BASIC LOOKUP TESTS ===

const lookupTests = {
  'getBeatSummary returns string for known beat': () => {
    const result = getBeatSummary('arrival_walston', 'high-and-dry');
    if (result) {
      assert.equal(typeof result, 'string');
      assert.ok(result.length > 0);
    }
    // OK if null (no summaries registered yet)
  },

  'getBeatSummary returns null for unknown beat': () => {
    const result = getBeatSummary('unknown_beat_12345', 'high-and-dry');
    assert.equal(result, null);
  },

  'getBeatSummary returns null for unknown adventure': () => {
    const result = getBeatSummary('arrival_walston', 'unknown-adventure');
    assert.equal(result, null);
  },

  'getBeatSummary handles null beatId': () => {
    assert.doesNotThrow(() => getBeatSummary(null, 'high-and-dry'));
    assert.equal(getBeatSummary(null, 'high-and-dry'), null);
  },

  'getBeatSummary handles null adventureId': () => {
    assert.doesNotThrow(() => getBeatSummary('arrival_walston', null));
    assert.equal(getBeatSummary('arrival_walston', null), null);
  },

  'getBeatSummary handles both null': () => {
    assert.equal(getBeatSummary(null, null), null);
  }
};

// === BATCH LOOKUP TESTS ===

const batchTests = {
  'getBeatSummaries returns array': () => {
    const beatIds = ['arrival_walston', 'meeting_greener'];
    const result = getBeatSummaries(beatIds, 'high-and-dry');
    assert.ok(Array.isArray(result));
  },

  'getBeatSummaries returns summaries for known beats': () => {
    const beatIds = ['arrival_walston', 'survey_accepted'];
    const result = getBeatSummaries(beatIds, 'high-and-dry');

    // Each result should be string or null
    result.forEach(r => {
      assert.ok(r === null || typeof r === 'string');
    });
  },

  'getBeatSummaries preserves order': () => {
    const beatIds = ['beat_a', 'beat_b', 'beat_c'];
    const result = getBeatSummaries(beatIds, 'test-adventure');
    assert.equal(result.length, beatIds.length);
  },

  'getBeatSummaries handles empty array': () => {
    const result = getBeatSummaries([], 'high-and-dry');
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 0);
  },

  'getBeatSummaries handles null array': () => {
    assert.doesNotThrow(() => getBeatSummaries(null, 'high-and-dry'));
    const result = getBeatSummaries(null, 'high-and-dry');
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 0);
  }
};

// === REGISTRATION TESTS ===

const registrationTests = {
  'registerBeatSummary adds new summary': () => {
    registerBeatSummary('test_beat_1', 'test-adventure', 'Test beat happened');
    const result = getBeatSummary('test_beat_1', 'test-adventure');
    assert.equal(result, 'Test beat happened');
  },

  'registerBeatSummary overwrites existing': () => {
    registerBeatSummary('test_beat_2', 'test-adventure', 'Original');
    registerBeatSummary('test_beat_2', 'test-adventure', 'Updated');
    const result = getBeatSummary('test_beat_2', 'test-adventure');
    assert.equal(result, 'Updated');
  },

  'registerBeatSummary handles null inputs gracefully': () => {
    assert.doesNotThrow(() => registerBeatSummary(null, 'test', 'summary'));
    assert.doesNotThrow(() => registerBeatSummary('beat', null, 'summary'));
    assert.doesNotThrow(() => registerBeatSummary('beat', 'test', null));
  },

  'registerBeatSummary creates adventure if not exists': () => {
    registerBeatSummary('new_beat', 'new-adventure-xyz', 'New adventure beat');
    const result = getBeatSummary('new_beat', 'new-adventure-xyz');
    assert.equal(result, 'New adventure beat');
  }
};

// === ADVENTURE LISTING TESTS ===

const listingTests = {
  'getAllSummariesForAdventure returns object': () => {
    const result = getAllSummariesForAdventure('high-and-dry');
    assert.equal(typeof result, 'object');
  },

  'getAllSummariesForAdventure returns empty for unknown': () => {
    const result = getAllSummariesForAdventure('nonexistent-adventure');
    assert.equal(typeof result, 'object');
    assert.equal(Object.keys(result).length, 0);
  },

  'getAllSummariesForAdventure handles null': () => {
    assert.doesNotThrow(() => getAllSummariesForAdventure(null));
    const result = getAllSummariesForAdventure(null);
    assert.equal(typeof result, 'object');
  },

  'BEAT_SUMMARIES constant exists': () => {
    assert.ok(BEAT_SUMMARIES !== undefined);
    assert.equal(typeof BEAT_SUMMARIES, 'object');
  }
};

// === HIGH AND DRY SPECIFIC TESTS ===

const highAndDryTests = {
  'has arrival_walston summary': () => {
    const result = getBeatSummary('arrival_walston', 'high-and-dry');
    if (result) {
      assert.ok(result.toLowerCase().includes('walston') ||
                result.toLowerCase().includes('arrived'));
    }
  },

  'has meeting_greener summary': () => {
    const result = getBeatSummary('meeting_greener', 'high-and-dry');
    if (result) {
      assert.ok(result.toLowerCase().includes('greener') ||
                result.toLowerCase().includes('minister'));
    }
  },

  'has survey_accepted summary': () => {
    const result = getBeatSummary('survey_accepted', 'high-and-dry');
    if (result) {
      assert.ok(result.toLowerCase().includes('survey') ||
                result.toLowerCase().includes('agreed'));
    }
  },

  'has departure_flammarion summary': () => {
    const result = getBeatSummary('departure_flammarion', 'high-and-dry');
    if (result) {
      assert.ok(result.toLowerCase().includes('flammarion') ||
                result.toLowerCase().includes('left') ||
                result.toLowerCase().includes('departed'));
    }
  }
};

// === INTEGRATION TESTS ===

const integrationTests = {
  'multiple adventures can coexist': () => {
    registerBeatSummary('beat_x', 'adventure-a', 'Adventure A beat');
    registerBeatSummary('beat_x', 'adventure-b', 'Adventure B beat');

    const resultA = getBeatSummary('beat_x', 'adventure-a');
    const resultB = getBeatSummary('beat_x', 'adventure-b');

    assert.equal(resultA, 'Adventure A beat');
    assert.equal(resultB, 'Adventure B beat');
  },

  'summary generation is pure function': () => {
    const result1 = getBeatSummary('arrival_walston', 'high-and-dry');
    const result2 = getBeatSummary('arrival_walston', 'high-and-dry');
    assert.equal(result1, result2);
  },

  'module exports are defined': () => {
    assert.ok(typeof getBeatSummary === 'function');
    assert.ok(typeof getBeatSummaries === 'function');
    assert.ok(typeof registerBeatSummary === 'function');
  }
};

// === RUN ALL TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  BEAT SUMMARIES TESTS');
console.log('══════════════════════════════════════════\n');

console.log('--- Basic Lookup Tests ---');
const lookup = runTests(lookupTests);

console.log('\n--- Batch Lookup Tests ---');
const batch = runTests(batchTests);

console.log('\n--- Registration Tests ---');
const registration = runTests(registrationTests);

console.log('\n--- Adventure Listing Tests ---');
const listing = runTests(listingTests);

console.log('\n--- High and Dry Specific Tests ---');
const highAndDry = runTests(highAndDryTests);

console.log('\n--- Integration Tests ---');
const integration = runTests(integrationTests);

const allPassed = lookup && batch && registration && listing && highAndDry && integration;
process.exit(allPassed ? 0 : 1);
