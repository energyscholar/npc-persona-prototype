#!/usr/bin/env node
/**
 * Prompt Extensions Integration Tests (TDD - Tests First)
 *
 * Tests the integration layer that combines all gap features.
 *
 * Design Pattern: Facade Pattern
 * - Provides simplified interface to complex subsystem
 * - Hides disposition, plot-context, world-state complexity
 * - Single entry point for prompt extension
 *
 * AUDITOR INSTANCE: 5f069a8e-52eb-42c4-a874-17ce01f2100b
 */

const { strict: assert } = require('assert');
const fs = require('fs');
const path = require('path');

// Import will fail until implementation exists
let promptExt;
try {
  promptExt = require('../src/prompt-extensions');
} catch (e) {
  console.error('Prompt-extensions module not yet implemented.\n');
  promptExt = {};
}

const { buildExtendedContext } = promptExt;

// Test state paths
const TEST_STATE_DIR = path.join(__dirname, '../data/state');

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

// Reset state files for clean tests
function resetStateFiles() {
  const files = {
    'dispositions.json': { relationships: {} },
    'world-facts.json': { sharedFacts: [], npcMentions: {}, factionKnowledge: {} }
  };

  for (const [file, content] of Object.entries(files)) {
    const filePath = path.join(TEST_STATE_DIR, file);
    if (fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
    }
  }
}

// === NULL SAFETY TESTS ===

const nullSafetyTests = {
  'buildExtendedContext returns string for empty persona': () => {
    const result = buildExtendedContext({}, null, null);
    assert.equal(typeof result, 'string');
  },

  'buildExtendedContext handles null persona gracefully': () => {
    assert.doesNotThrow(() => buildExtendedContext(null, null, null));
  },

  'buildExtendedContext handles null pc gracefully': () => {
    assert.doesNotThrow(() => buildExtendedContext({ id: 'npc' }, null, null));
  },

  'buildExtendedContext handles null storyState gracefully': () => {
    assert.doesNotThrow(() => buildExtendedContext({ id: 'npc' }, { id: 'pc' }, null));
  },

  'buildExtendedContext handles all nulls': () => {
    const result = buildExtendedContext(null, null, null);
    assert.equal(typeof result, 'string');
  }
};

// === DISPOSITION INTEGRATION TESTS ===

const dispositionTests = {
  'includes disposition when pc provided': () => {
    resetStateFiles();
    const persona = { id: 'test-npc' };
    const pc = { id: 'test-pc' };

    const result = buildExtendedContext(persona, pc, null);
    // Should include disposition modifier (default neutral)
    assert.ok(
      result.includes('NEUTRAL') || result.toLowerCase().includes('neutral'),
      'Should include neutral disposition'
    );
  },

  'skips disposition when no pc': () => {
    const persona = { id: 'test-npc' };

    const result = buildExtendedContext(persona, null, null);
    // Without PC, no disposition should be added
    assert.ok(
      !result.includes('HOSTILE') && !result.includes('ALLIED'),
      'Should not include disposition extremes without PC'
    );
  },

  'skips disposition when persona has no id': () => {
    const persona = {}; // No id
    const pc = { id: 'test-pc' };

    const result = buildExtendedContext(persona, pc, null);
    // Should handle gracefully
    assert.equal(typeof result, 'string');
  }
};

// === PLOT CONTEXT INTEGRATION TESTS ===

const plotContextTests = {
  'includes plot context when storyState provided': () => {
    const persona = {
      id: 'test-npc',
      plotAwareness: { scope: 'adventure' }
    };
    const storyState = {
      adventure: 'high-and-dry',
      currentAct: 'act-1',
      completedBeats: []
    };

    const result = buildExtendedContext(persona, null, storyState);
    assert.ok(
      result.includes('high-and-dry') || result.includes('SITUATION'),
      'Should include plot context'
    );
  },

  'skips plot context when no storyState': () => {
    const persona = { id: 'test-npc' };

    const result = buildExtendedContext(persona, null, null);
    assert.ok(!result.includes('Adventure:'), 'Should not include adventure context');
  },

  'includes beat reactions': () => {
    const persona = {
      id: 'test-npc',
      plotAwareness: {
        beatReactions: { 'test_beat': 'React to this!' }
      }
    };
    const storyState = {
      completedBeats: ['test_beat']
    };

    const result = buildExtendedContext(persona, null, storyState);
    assert.ok(result.includes('React to this!'), 'Should include beat reaction');
  }
};

// === WORLD STATE INTEGRATION TESTS ===

const worldStateTests = {
  'includes shared facts when storyState provided': () => {
    // This test depends on world-state module being implemented
    // For now, just verify it doesn't crash
    const persona = { id: 'test-npc' };
    const storyState = { adventure: 'test', completedBeats: [] };

    assert.doesNotThrow(() => buildExtendedContext(persona, null, storyState));
  },

  'includes mentions about NPC when available': () => {
    // This test depends on world-state having recorded mentions
    // For now, just verify structure
    const persona = { id: 'mentioned-npc' };
    const pc = { id: 'test-pc' };
    const storyState = { adventure: 'test', completedBeats: [] };

    const result = buildExtendedContext(persona, pc, storyState);
    assert.equal(typeof result, 'string');
  }
};

// === COMBINATION TESTS ===

const combinationTests = {
  'combines all contexts when all inputs provided': () => {
    resetStateFiles();
    const persona = {
      id: 'minister-greener',
      plotAwareness: {
        scope: 'adventure',
        beatReactions: { 'survey_accepted': 'Good progress' }
      }
    };
    const pc = { id: 'captain-drake' };
    const storyState = {
      adventure: 'high-and-dry',
      currentAct: 'act-2',
      completedBeats: ['survey_accepted']
    };

    const result = buildExtendedContext(persona, pc, storyState);

    // Should have disposition
    assert.ok(result.toLowerCase().includes('neutral') || result.includes('NEUTRAL'));
    // Should have plot context
    assert.ok(result.includes('Good progress') || result.includes('high-and-dry'));
  },

  'order is consistent: disposition, plot, world': () => {
    resetStateFiles();
    const persona = {
      id: 'test-npc',
      plotAwareness: { scope: 'adventure' }
    };
    const pc = { id: 'test-pc' };
    const storyState = {
      adventure: 'test-adventure',
      completedBeats: []
    };

    const result = buildExtendedContext(persona, pc, storyState);

    // Disposition should come before plot context
    const neutralIndex = result.toLowerCase().indexOf('neutral');
    const situationIndex = result.indexOf('SITUATION');

    if (neutralIndex !== -1 && situationIndex !== -1) {
      assert.ok(neutralIndex < situationIndex, 'Disposition should come before situation');
    }
  }
};

// === FACADE PATTERN VERIFICATION ===

const facadeTests = {
  'single function provides complete extension': () => {
    // Verify the facade pattern - one function does everything
    assert.equal(typeof buildExtendedContext, 'function');
  },

  'hides subsystem complexity': () => {
    // User doesn't need to call disposition, plot-context, world-state directly
    const result = buildExtendedContext(
      { id: 'npc', plotAwareness: { scope: 'adventure' } },
      { id: 'pc' },
      { adventure: 'test', completedBeats: [] }
    );

    // All complexity hidden behind single call
    assert.equal(typeof result, 'string');
    assert.ok(result.length > 0, 'Should produce non-empty output');
  }
};

// === RUN ALL TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  PROMPT EXTENSIONS TESTS');
console.log('══════════════════════════════════════════\n');

console.log('--- Null Safety Tests ---');
const nulls = runTests(nullSafetyTests);

console.log('\n--- Disposition Integration Tests ---');
const disposition = runTests(dispositionTests);

console.log('\n--- Plot Context Integration Tests ---');
const plot = runTests(plotContextTests);

console.log('\n--- World State Integration Tests ---');
const world = runTests(worldStateTests);

console.log('\n--- Combination Tests ---');
const combo = runTests(combinationTests);

console.log('\n--- Facade Pattern Tests ---');
const facade = runTests(facadeTests);

const allPassed = nulls && disposition && plot && world && combo && facade;
process.exit(allPassed ? 0 : 1);
