#!/usr/bin/env node
/**
 * Wiki Cache Tests (TDD - Tests First)
 *
 * Tests wiki cache access:
 * - O(1) lookups by hex, name, slug
 * - Content extraction
 * - Graceful handling of missing data
 *
 * AUDITOR INSTANCE: 5f069a8e-52eb-42c4-a874-17ce01f2100b
 */

const { strict: assert } = require('assert');
const path = require('path');
const fs = require('fs');

// Import will fail until implementation exists
let wikiCache;
try {
  wikiCache = require('../src/wiki-cache');
} catch (e) {
  console.error('Wiki-cache module not yet implemented.\n');
  wikiCache = {};
}

const {
  WIKI_CACHE_PATH,
  isInitialized,
  initialize,
  getByHex,
  getByName,
  getBySlug,
  getTextContent,
  getRawHtml,
  getAllHexes,
  search
} = wikiCache;

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

// === INITIALIZATION TESTS ===

const initTests = {
  'WIKI_CACHE_PATH is defined': () => {
    assert.ok(WIKI_CACHE_PATH, 'WIKI_CACHE_PATH should be defined');
  },

  'initialize does not throw': () => {
    assert.doesNotThrow(() => initialize());
  },

  'isInitialized returns boolean': () => {
    const result = isInitialized();
    assert.equal(typeof result, 'boolean');
  },

  'initialize is idempotent': () => {
    initialize();
    initialize();
    assert.ok(true, 'Multiple initialize calls should not throw');
  }
};

// === LOOKUP BY HEX TESTS ===

const hexTests = {
  'getByHex returns object for known hex': () => {
    initialize();
    const result = getByHex('1232'); // Walston
    if (result) {
      assert.equal(typeof result, 'object');
      assert.ok(result.hasOwnProperty('name') || result.hasOwnProperty('hex'));
    }
    // OK if null (wiki cache not present)
  },

  'getByHex returns null for unknown hex': () => {
    initialize();
    const result = getByHex('9999');
    assert.equal(result, null);
  },

  'getByHex handles null input': () => {
    initialize();
    assert.doesNotThrow(() => getByHex(null));
    assert.equal(getByHex(null), null);
  },

  'getByHex is O(1) lookup': () => {
    initialize();
    // Should return in < 10ms even for large cache
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      getByHex('1232');
    }
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 100, `100 lookups took ${elapsed}ms, should be < 100ms`);
  }
};

// === LOOKUP BY NAME TESTS ===

const nameTests = {
  'getByName returns object for known name': () => {
    initialize();
    const result = getByName('Walston');
    if (result) {
      assert.equal(typeof result, 'object');
    }
  },

  'getByName is case-insensitive': () => {
    initialize();
    const lower = getByName('walston');
    const upper = getByName('WALSTON');
    const mixed = getByName('Walston');

    // All should return same result (or all null if cache missing)
    if (lower || upper || mixed) {
      assert.deepEqual(lower, upper);
      assert.deepEqual(upper, mixed);
    }
  },

  'getByName returns null for unknown name': () => {
    initialize();
    const result = getByName('NonexistentSystem12345');
    assert.equal(result, null);
  },

  'getByName handles null input': () => {
    initialize();
    assert.equal(getByName(null), null);
  }
};

// === LOOKUP BY SLUG TESTS ===

const slugTests = {
  'getBySlug returns object for known slug': () => {
    initialize();
    const result = getBySlug('walston');
    if (result) {
      assert.equal(typeof result, 'object');
    }
  },

  'getBySlug returns null for unknown slug': () => {
    initialize();
    const result = getBySlug('nonexistent-system-12345');
    assert.equal(result, null);
  },

  'getBySlug handles null input': () => {
    initialize();
    assert.equal(getBySlug(null), null);
  }
};

// === CONTENT EXTRACTION TESTS ===

const contentTests = {
  'getTextContent returns string': () => {
    initialize();
    const result = getTextContent('1232'); // Walston
    if (result) {
      assert.equal(typeof result, 'string');
      assert.ok(result.length > 0);
    }
  },

  'getTextContent returns null for unknown hex': () => {
    initialize();
    const result = getTextContent('9999');
    assert.equal(result, null);
  },

  'getRawHtml returns string with HTML': () => {
    initialize();
    const result = getRawHtml('1232');
    if (result) {
      assert.equal(typeof result, 'string');
      // Should contain some HTML tags
      assert.ok(result.includes('<') || result.length === 0);
    }
  },

  'getRawHtml returns null for unknown hex': () => {
    initialize();
    const result = getRawHtml('9999');
    assert.equal(result, null);
  }
};

// === UTILITY TESTS ===

const utilityTests = {
  'getAllHexes returns array': () => {
    initialize();
    const result = getAllHexes();
    assert.ok(Array.isArray(result));
  },

  'getAllHexes contains known hexes': () => {
    initialize();
    const hexes = getAllHexes();
    if (hexes.length > 0) {
      // Should contain Walston's hex if cache is present
      assert.ok(hexes.includes('1232') || hexes.length === 0);
    }
  },

  'search returns array': () => {
    initialize();
    const result = search('Walston');
    assert.ok(Array.isArray(result));
  },

  'search finds matching systems': () => {
    initialize();
    const results = search('Walston');
    if (results.length > 0) {
      assert.ok(results.some(r =>
        (r.name && r.name.includes('Walston')) ||
        (r.hex === '1232')
      ));
    }
  },

  'search handles empty query': () => {
    initialize();
    const result = search('');
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 0);
  }
};

// === GRACEFUL DEGRADATION TESTS ===

const gracefulTests = {
  'module works without wiki cache present': () => {
    // If wiki cache directory doesn't exist, module should still work
    assert.doesNotThrow(() => {
      initialize();
      getByHex('1232');
      getByName('Walston');
    });
  },

  'all functions return null/empty for missing cache': () => {
    // This test verifies graceful degradation
    // All lookups should return null, not throw
    initialize();

    // These should not throw even if cache is missing
    const hex = getByHex('1232');
    const name = getByName('Walston');
    const text = getTextContent('1232');

    // Results are either valid objects or null
    assert.ok(hex === null || typeof hex === 'object');
    assert.ok(name === null || typeof name === 'object');
    assert.ok(text === null || typeof text === 'string');
  }
};

// === RUN ALL TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  WIKI CACHE TESTS');
console.log('══════════════════════════════════════════\n');

console.log('--- Initialization Tests ---');
const init = runTests(initTests);

console.log('\n--- Lookup by Hex Tests ---');
const hex = runTests(hexTests);

console.log('\n--- Lookup by Name Tests ---');
const name = runTests(nameTests);

console.log('\n--- Lookup by Slug Tests ---');
const slug = runTests(slugTests);

console.log('\n--- Content Extraction Tests ---');
const content = runTests(contentTests);

console.log('\n--- Utility Tests ---');
const utility = runTests(utilityTests);

console.log('\n--- Graceful Degradation Tests ---');
const graceful = runTests(gracefulTests);

const allPassed = init && hex && name && slug && content && utility && graceful;
process.exit(allPassed ? 0 : 1);
