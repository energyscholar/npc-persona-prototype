#!/usr/bin/env node
/**
 * World Knowledge Tests (TDD - Tests First)
 *
 * Tests UWP parsing and world summary generation:
 * - UWP string parsing (C544338-7)
 * - Human-readable UWP descriptions
 * - World summary extraction from wiki cache
 *
 * AUDITOR INSTANCE: 5f069a8e-52eb-42c4-a874-17ce01f2100b
 */

const { strict: assert } = require('assert');

// Import will fail until implementation exists
let worldKnowledge;
try {
  worldKnowledge = require('../src/world-knowledge');
} catch (e) {
  console.error('World-knowledge module not yet implemented.\n');
  worldKnowledge = {};
}

const {
  parseUWP,
  describeUWP,
  getWorldSummary,
  getFirstParagraph
} = worldKnowledge;

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

// === UWP PARSING TESTS ===

const parseTests = {
  'parseUWP parses Walston UWP correctly': () => {
    const result = parseUWP('C544338-7');
    assert.equal(result.starport, 'C');
    assert.equal(result.size, '5');
    assert.equal(result.atmosphere, '4');
    assert.equal(result.hydrographics, '4');
    assert.equal(result.population, '3');
    assert.equal(result.government, '3');
    assert.equal(result.lawLevel, '8');
    assert.equal(result.techLevel, '7');
  },

  'parseUWP handles A-class starport': () => {
    const result = parseUWP('A788899-C');
    assert.equal(result.starport, 'A');
    assert.equal(result.techLevel, 'C');
  },

  'parseUWP handles X-class starport (no starport)': () => {
    const result = parseUWP('X000000-0');
    assert.equal(result.starport, 'X');
  },

  'parseUWP handles hex digits': () => {
    // UWP format: Starport-Size-Atmo-Hydro-Pop-Gov-Law-TechLevel
    // Position:      0      1    2    3    4   5   6   8
    const result = parseUWP('AAAA9AB-F');
    assert.equal(result.starport, 'A');    // pos 0
    assert.equal(result.size, 'A');        // pos 1
    assert.equal(result.atmosphere, 'A');  // pos 2
    assert.equal(result.hydrographics, 'A'); // pos 3
    assert.equal(result.population, '9');  // pos 4
    assert.equal(result.government, 'A');  // pos 5
    assert.equal(result.lawLevel, 'B');    // pos 6
    assert.equal(result.techLevel, 'F');   // pos 8
  },

  'parseUWP position mapping is correct': () => {
    // Verify each position maps to correct field
    // Using unique hex digits to verify positions: 0123456-7
    const result = parseUWP('A123456-7');
    assert.equal(result.starport, 'A');
    assert.equal(result.size, '1');
    assert.equal(result.atmosphere, '2');
    assert.equal(result.hydrographics, '3');
    assert.equal(result.population, '4');
    assert.equal(result.government, '5');
    assert.equal(result.lawLevel, '6');
    assert.equal(result.techLevel, '7');
  },

  'parseUWP returns null for invalid input': () => {
    assert.equal(parseUWP(null), null);
    assert.equal(parseUWP(''), null);
    assert.equal(parseUWP('invalid'), null);
    assert.equal(parseUWP('C54433'), null); // Too short
  },

  'parseUWP handles lowercase input': () => {
    const result = parseUWP('c544338-7');
    assert.equal(result.starport, 'C');
    assert.equal(result.techLevel, '7');
  }
};

// === UWP DESCRIPTION TESTS ===

const describeTests = {
  'describeUWP describes starport class': () => {
    const result = describeUWP('A788899-C');
    assert.ok(result.includes('excellent') || result.includes('Excellent'));
  },

  'describeUWP describes routine starport': () => {
    const result = describeUWP('C544338-7');
    assert.ok(result.includes('routine') || result.includes('Routine'));
  },

  'describeUWP mentions thin atmosphere': () => {
    const result = describeUWP('C544338-7');
    assert.ok(result.includes('thin') || result.includes('Thin'));
  },

  'describeUWP mentions tainted atmosphere for code 4': () => {
    const result = describeUWP('C544338-7');
    assert.ok(result.includes('taint') || result.includes('filter'));
  },

  'describeUWP includes population estimate': () => {
    const result = describeUWP('C544338-7');
    // Population 3 = thousands
    assert.ok(result.includes('thousand') || result.includes('000'));
  },

  'describeUWP mentions tech level': () => {
    const result = describeUWP('C544338-7');
    // TL 7 = pre-stellar
    assert.ok(result.includes('7') || result.includes('pre-stellar'));
  },

  'describeUWP returns empty string for invalid UWP': () => {
    const result = describeUWP('invalid');
    assert.equal(result, '');
  },

  'describeUWP handles null input': () => {
    const result = describeUWP(null);
    assert.equal(result, '');
  }
};

// === WORLD SUMMARY TESTS ===

const summaryTests = {
  'getWorldSummary returns object with expected fields': () => {
    const result = getWorldSummary('Walston');
    if (result) {
      assert.ok(result.hasOwnProperty('name'));
      assert.ok(result.hasOwnProperty('uwp'));
      assert.ok(result.hasOwnProperty('description'));
    }
    // OK if null (wiki cache not connected)
  },

  'getWorldSummary returns null for unknown world': () => {
    const result = getWorldSummary('NonexistentWorld12345');
    assert.equal(result, null);
  },

  'getWorldSummary handles null input': () => {
    assert.doesNotThrow(() => getWorldSummary(null));
    assert.equal(getWorldSummary(null), null);
  },

  'getWorldSummary description is reasonable length': () => {
    const result = getWorldSummary('Walston');
    if (result && result.description) {
      // Should be under 500 tokens (~2000 chars) for prompt injection
      assert.ok(result.description.length < 2000,
        `Description too long: ${result.description.length} chars`);
    }
  },

  'getWorldSummary by hex returns same as by name': () => {
    const byName = getWorldSummary('Walston');
    const byHex = getWorldSummary('1232'); // Walston's hex
    if (byName && byHex) {
      assert.equal(byName.name, byHex.name);
    }
  }
};

// === FIRST PARAGRAPH EXTRACTION TESTS ===

const paragraphTests = {
  'getFirstParagraph extracts first paragraph': () => {
    const text = 'First paragraph here.\n\nSecond paragraph here.';
    const result = getFirstParagraph(text);
    assert.equal(result, 'First paragraph here.');
  },

  'getFirstParagraph handles single paragraph': () => {
    const text = 'Only one paragraph.';
    const result = getFirstParagraph(text);
    assert.equal(result, 'Only one paragraph.');
  },

  'getFirstParagraph returns empty for null': () => {
    assert.equal(getFirstParagraph(null), '');
    assert.equal(getFirstParagraph(undefined), '');
  },

  'getFirstParagraph handles empty string': () => {
    assert.equal(getFirstParagraph(''), '');
  },

  'getFirstParagraph trims whitespace': () => {
    const text = '  Padded paragraph.  \n\nSecond.';
    const result = getFirstParagraph(text);
    assert.equal(result, 'Padded paragraph.');
  },

  'getFirstParagraph respects maxLength': () => {
    const text = 'This is a very long first paragraph that should be truncated.';
    const result = getFirstParagraph(text, 20);
    assert.ok(result.length <= 23, 'Should truncate with ellipsis');
    assert.ok(result.endsWith('...'));
  }
};

// === INTEGRATION TESTS ===

const integrationTests = {
  'full flow: parse, describe, summarize': () => {
    const uwp = 'C544338-7';
    const parsed = parseUWP(uwp);
    const described = describeUWP(uwp);

    if (parsed) {
      assert.equal(parsed.starport, 'C');
    }
    if (described) {
      assert.ok(described.length > 0);
    }
  },

  'world knowledge is self-contained': () => {
    // Module should not throw on load
    assert.doesNotThrow(() => {
      const wk = require('../src/world-knowledge');
    });
  }
};

// === RUN ALL TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  WORLD KNOWLEDGE TESTS');
console.log('══════════════════════════════════════════\n');

console.log('--- UWP Parsing Tests ---');
const parse = runTests(parseTests);

console.log('\n--- UWP Description Tests ---');
const describe = runTests(describeTests);

console.log('\n--- World Summary Tests ---');
const summary = runTests(summaryTests);

console.log('\n--- First Paragraph Tests ---');
const paragraph = runTests(paragraphTests);

console.log('\n--- Integration Tests ---');
const integration = runTests(integrationTests);

const allPassed = parse && describe && summary && paragraph && integration;
process.exit(allPassed ? 0 : 1);
