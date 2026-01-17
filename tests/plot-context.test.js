#!/usr/bin/env node
/**
 * Plot Context Tests (TDD - Tests First)
 *
 * Tests plot/story context building:
 * - Scope filtering (scene/act/adventure)
 * - Beat reactions
 * - Flag awareness
 *
 * Design Pattern: Builder Pattern
 * - Constructs complex context string step by step
 * - Each component (scope, reactions, flags) added conditionally
 *
 * AUDITOR INSTANCE: 5f069a8e-52eb-42c4-a874-17ce01f2100b
 */

const { strict: assert } = require('assert');

// Import will fail until implementation exists
let plotContext;
try {
  plotContext = require('../src/plot-context');
} catch (e) {
  console.error('Plot-context module not yet implemented.\n');
  plotContext = {};
}

const { buildPlotContext } = plotContext;

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

// === NULL INPUT TESTS ===

const nullInputTests = {
  'buildPlotContext returns empty string for null storyState': () => {
    const result = buildPlotContext(null, { id: 'npc' });
    assert.equal(result, '');
  },

  'buildPlotContext returns empty string for null npcConfig': () => {
    const result = buildPlotContext({ adventure: 'test' }, null);
    assert.equal(result, '');
  },

  'buildPlotContext returns empty string for both null': () => {
    const result = buildPlotContext(null, null);
    assert.equal(result, '');
  },

  'buildPlotContext handles undefined inputs': () => {
    assert.doesNotThrow(() => buildPlotContext(undefined, undefined));
  }
};

// === SCOPE TESTS ===

const scopeTests = {
  'scene scope does not include adventure/act': () => {
    const storyState = {
      adventure: 'high-and-dry',
      currentAct: 'act-1',
      currentScene: 'meeting-greener',
      completedBeats: []
    };
    const npcConfig = { plotAwareness: { scope: 'scene' } };

    const result = buildPlotContext(storyState, npcConfig);
    assert.ok(!result.includes('high-and-dry'), 'Should not include adventure name');
    assert.ok(!result.includes('act-1'), 'Should not include act name');
  },

  'act scope includes adventure and act': () => {
    const storyState = {
      adventure: 'high-and-dry',
      currentAct: 'act-2-walston',
      completedBeats: []
    };
    const npcConfig = { plotAwareness: { scope: 'act' } };

    const result = buildPlotContext(storyState, npcConfig);
    assert.ok(result.includes('high-and-dry'), 'Should include adventure');
    assert.ok(result.includes('act-2-walston'), 'Should include act');
  },

  'adventure scope includes adventure and act': () => {
    const storyState = {
      adventure: 'high-and-dry',
      currentAct: 'act-3-mountain',
      completedBeats: []
    };
    const npcConfig = { plotAwareness: { scope: 'adventure' } };

    const result = buildPlotContext(storyState, npcConfig);
    assert.ok(result.includes('high-and-dry'));
    assert.ok(result.includes('act-3-mountain'));
  },

  'default scope is scene': () => {
    const storyState = {
      adventure: 'test-adventure',
      currentAct: 'test-act',
      completedBeats: []
    };
    const npcConfig = {}; // No plotAwareness defined

    const result = buildPlotContext(storyState, npcConfig);
    // Default scene scope should not include adventure/act
    assert.ok(!result.includes('test-adventure'));
  },

  'scene is included when present': () => {
    const storyState = {
      adventure: 'test',
      currentScene: 'startown-investigation',
      completedBeats: []
    };
    const npcConfig = { plotAwareness: { scope: 'scene' } };

    const result = buildPlotContext(storyState, npcConfig);
    assert.ok(result.includes('startown-investigation'));
  }
};

// === BEAT REACTION TESTS ===

const beatReactionTests = {
  'includes beat reaction when beat completed': () => {
    const storyState = {
      completedBeats: ['survey_accepted']
    };
    const npcConfig = {
      plotAwareness: {
        beatReactions: {
          'survey_accepted': 'Good, they agreed to help'
        }
      }
    };

    const result = buildPlotContext(storyState, npcConfig);
    assert.ok(result.includes('Good, they agreed to help'));
  },

  'does not include reaction for incomplete beat': () => {
    const storyState = {
      completedBeats: []
    };
    const npcConfig = {
      plotAwareness: {
        beatReactions: {
          'survey_accepted': 'This should not appear'
        }
      }
    };

    const result = buildPlotContext(storyState, npcConfig);
    assert.ok(!result.includes('This should not appear'));
  },

  'includes multiple beat reactions': () => {
    const storyState = {
      completedBeats: ['survey_accepted', 'eruption_begins']
    };
    const npcConfig = {
      plotAwareness: {
        beatReactions: {
          'survey_accepted': 'They agreed',
          'eruption_begins': 'Volcano active!'
        }
      }
    };

    const result = buildPlotContext(storyState, npcConfig);
    assert.ok(result.includes('They agreed'));
    assert.ok(result.includes('Volcano active!'));
  },

  'handles empty completedBeats array': () => {
    const storyState = { completedBeats: [] };
    const npcConfig = {
      plotAwareness: { beatReactions: { 'any': 'reaction' } }
    };

    assert.doesNotThrow(() => buildPlotContext(storyState, npcConfig));
  },

  'handles missing completedBeats': () => {
    const storyState = {};
    const npcConfig = {
      plotAwareness: { beatReactions: { 'any': 'reaction' } }
    };

    assert.doesNotThrow(() => buildPlotContext(storyState, npcConfig));
  }
};

// === FLAG AWARENESS TESTS ===

const flagTests = {
  'includes known flags': () => {
    const storyState = {
      completedBeats: [],
      flags: {
        'survey_payment': 4000,
        'volcano_status': 'dormant'
      }
    };
    const npcConfig = {
      plotAwareness: {
        knowsAbout: ['survey_payment']
      }
    };

    const result = buildPlotContext(storyState, npcConfig);
    assert.ok(result.includes('survey_payment'));
    assert.ok(result.includes('4000'));
  },

  'excludes unknown flags': () => {
    const storyState = {
      completedBeats: [],
      flags: {
        'secret_info': 'hidden'
      }
    };
    const npcConfig = {
      plotAwareness: {
        knowsAbout: ['public_info']
      }
    };

    const result = buildPlotContext(storyState, npcConfig);
    assert.ok(!result.includes('secret_info'));
    assert.ok(!result.includes('hidden'));
  },

  'handles missing flags in storyState': () => {
    const storyState = { completedBeats: [] };
    const npcConfig = {
      plotAwareness: { knowsAbout: ['any_flag'] }
    };

    assert.doesNotThrow(() => buildPlotContext(storyState, npcConfig));
  },

  'handles empty knowsAbout array': () => {
    const storyState = {
      completedBeats: [],
      flags: { 'flag': 'value' }
    };
    const npcConfig = {
      plotAwareness: { knowsAbout: [] }
    };

    const result = buildPlotContext(storyState, npcConfig);
    assert.ok(!result.includes('flag'));
  }
};

// === PC IDENTITY TESTS ===

const pcIdentityTests = {
  'includes PC name when provided': () => {
    const storyState = { completedBeats: [] };
    const npcConfig = { plotAwareness: { scope: 'adventure' } };
    const pc = { name: 'Alex Ryder' };

    const result = buildPlotContext(storyState, npcConfig, pc);
    assert.ok(result.includes('Alex Ryder'));
  },

  'includes PC background when provided': () => {
    const storyState = { completedBeats: [] };
    const npcConfig = { plotAwareness: { scope: 'adventure' } };
    const pc = {
      name: 'Alex Ryder',
      background: 'Former scout service, mustered out after one term'
    };

    const result = buildPlotContext(storyState, npcConfig, pc);
    assert.ok(result.includes('scout service') || result.includes('mustered out'));
  },

  'includes PC motivations when provided': () => {
    const storyState = { completedBeats: [] };
    const npcConfig = { plotAwareness: { scope: 'adventure' } };
    const pc = {
      name: 'Alex Ryder',
      motivations: ['Claim the Highndry', 'Start a new life']
    };

    const result = buildPlotContext(storyState, npcConfig, pc);
    assert.ok(result.includes('Highndry') || result.includes('new life'));
  },

  'handles null PC gracefully': () => {
    const storyState = { completedBeats: [] };
    const npcConfig = { plotAwareness: { scope: 'adventure' } };

    assert.doesNotThrow(() => buildPlotContext(storyState, npcConfig, null));
  },

  'handles PC with only name': () => {
    const storyState = { completedBeats: [] };
    const npcConfig = {};
    const pc = { name: 'Minimal PC' };

    assert.doesNotThrow(() => buildPlotContext(storyState, npcConfig, pc));
  }
};

// === GAME DATE TESTS ===

const gameDateTests = {
  'includes game date when provided': () => {
    const storyState = {
      completedBeats: [],
      gameDate: '015-1105'
    };
    const npcConfig = { plotAwareness: { scope: 'adventure' } };

    const result = buildPlotContext(storyState, npcConfig);
    assert.ok(result.includes('015-1105'));
  },

  'handles missing gameDate': () => {
    const storyState = { completedBeats: [] };
    const npcConfig = { plotAwareness: { scope: 'adventure' } };

    assert.doesNotThrow(() => buildPlotContext(storyState, npcConfig));
  },

  'date appears in context section': () => {
    const storyState = {
      completedBeats: [],
      gameDate: '001-1105'
    };
    const npcConfig = { plotAwareness: { scope: 'adventure' } };

    const result = buildPlotContext(storyState, npcConfig);
    if (result.includes('001-1105')) {
      assert.ok(result.includes('Date') || result.includes('date'));
    }
  }
};

// === BEAT SUMMARY TESTS ===

const beatSummaryTests = {
  'includes completed beat summaries': () => {
    const storyState = {
      adventure: 'high-and-dry',
      completedBeats: ['arrival_walston', 'meeting_greener']
    };
    const npcConfig = { plotAwareness: { scope: 'adventure' } };

    const result = buildPlotContext(storyState, npcConfig);
    // Should include some indication of what happened
    assert.ok(result.includes('HAPPENED') || result.includes('happened') ||
              result.includes('completed') || result.includes('beat'));
  },

  'includes do-not-re-narrate instruction when beats exist': () => {
    const storyState = {
      adventure: 'high-and-dry',
      completedBeats: ['arrival_walston']
    };
    const npcConfig = { plotAwareness: { scope: 'adventure' } };

    const result = buildPlotContext(storyState, npcConfig);
    if (storyState.completedBeats.length > 0) {
      assert.ok(result.includes('not') || result.includes('continue') ||
                result.includes('narrat'));
    }
  },

  'handles empty completedBeats for summaries': () => {
    const storyState = {
      adventure: 'high-and-dry',
      completedBeats: []
    };
    const npcConfig = { plotAwareness: { scope: 'adventure' } };

    assert.doesNotThrow(() => buildPlotContext(storyState, npcConfig));
  },

  'handles missing adventure for summaries': () => {
    const storyState = {
      completedBeats: ['some_beat']
    };
    const npcConfig = { plotAwareness: { scope: 'adventure' } };

    assert.doesNotThrow(() => buildPlotContext(storyState, npcConfig));
  }
};

// === NARRATOR-SPECIFIC TESTS ===

const narratorTests = {
  'narrator archetype gets full context': () => {
    const storyState = {
      adventure: 'high-and-dry',
      currentAct: 'act-2-walston',
      currentScene: 'journey_to_ship',
      gameDate: '015-1105',
      completedBeats: ['arrival_walston', 'meeting_greener', 'survey_accepted'],
      flags: { survey_payment: 4000 }
    };
    const narratorConfig = {
      archetype: 'narrator',
      plotAwareness: {
        scope: 'adventure',
        knowsAbout: ['survey_payment']
      }
    };
    const pc = {
      name: 'Alex Ryder',
      background: 'Former scout service',
      motivations: ['Claim the Highndry']
    };

    const result = buildPlotContext(storyState, narratorConfig, pc);

    // Narrator should see everything
    assert.ok(result.includes('high-and-dry'));
    assert.ok(result.includes('act-2-walston'));
  },

  'narrator gets adventure and act in scope': () => {
    const storyState = {
      adventure: 'high-and-dry',
      currentAct: 'act-2',
      completedBeats: []
    };
    const narratorConfig = {
      plotAwareness: { scope: 'adventure' }
    };

    const result = buildPlotContext(storyState, narratorConfig);
    assert.ok(result.includes('high-and-dry'));
    assert.ok(result.includes('act-2'));
  }
};

// === INTEGRATION TESTS ===

const integrationTests = {
  'combines scope, reactions, and flags': () => {
    const storyState = {
      adventure: 'high-and-dry',
      currentAct: 'act-2',
      currentScene: 'negotiation',
      completedBeats: ['arrived_walston'],
      flags: { 'payment_offered': 3000 }
    };
    const npcConfig = {
      plotAwareness: {
        scope: 'adventure',
        knowsAbout: ['payment_offered'],
        beatReactions: {
          'arrived_walston': 'Welcome to Walston'
        }
      }
    };

    const result = buildPlotContext(storyState, npcConfig);
    assert.ok(result.includes('high-and-dry'), 'Should include adventure');
    assert.ok(result.includes('Welcome to Walston'), 'Should include reaction');
    assert.ok(result.includes('3000'), 'Should include flag value');
  },

  'returns string type': () => {
    const result = buildPlotContext(
      { completedBeats: [] },
      { plotAwareness: { scope: 'scene' } }
    );
    assert.equal(typeof result, 'string');
  }
};

// === RUN ALL TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  PLOT CONTEXT TESTS');
console.log('══════════════════════════════════════════\n');

console.log('--- Null Input Tests ---');
const nulls = runTests(nullInputTests);

console.log('\n--- Scope Tests ---');
const scopes = runTests(scopeTests);

console.log('\n--- Beat Reaction Tests ---');
const beats = runTests(beatReactionTests);

console.log('\n--- Flag Awareness Tests ---');
const flags = runTests(flagTests);

console.log('\n--- PC Identity Tests ---');
const pcIdentity = runTests(pcIdentityTests);

console.log('\n--- Game Date Tests ---');
const gameDate = runTests(gameDateTests);

console.log('\n--- Beat Summary Tests ---');
const beatSummary = runTests(beatSummaryTests);

console.log('\n--- Narrator-Specific Tests ---');
const narrator = runTests(narratorTests);

console.log('\n--- Integration Tests ---');
const integration = runTests(integrationTests);

const allPassed = nulls && scopes && beats && flags && pcIdentity && gameDate && beatSummary && narrator && integration;
process.exit(allPassed ? 0 : 1);
