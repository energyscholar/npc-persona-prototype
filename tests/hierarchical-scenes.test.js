#!/usr/bin/env node
/**
 * Hierarchical Scenes Tests
 *
 * Tests stage-level navigation within scenes for the mountain climb walkthrough.
 * Tests H.1 - H.10 from the audit spec.
 */

const { strict: assert } = require('assert');

// Import modules under test
const { loadScene } = require('../src/story-engine');
const {
  formatSceneMenuItem,
  formatExpandedScene,
  getScenesByAct
} = require('../src/adventure-player');
const {
  slugifyStage,
  selectStage,
  completeStage,
  isStageCompleted,
  getCompletedStages,
  toggleSceneExpansion,
  isSceneExpanded,
  getStageBySlug
} = require('../src/decision-tracker');
const { parseSceneDirective, DIRECTIVE_TYPES } = require('../src/scene-manager');
const { buildSceneContext, filterByStage } = require('../src/knowledge-extraction/context-injector');

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

// === TEST CASES ===

const hierarchicalTests = {
  // TEST H.1: Scene with stages shows expandable indicator
  'TEST H.1: Scene with stages shows expandable indicator': () => {
    const scene = loadScene('high-and-dry', 'mountain-climb');
    assert(scene.stages && scene.stages.length > 0, 'Scene should have stages');

    const sceneEntry = {
      id: 'mountain-climb',
      title: scene.title,
      completed: false,
      current: false,
      hasStages: true,
      expanded: false,
      stages: scene.stages
    };

    const menuLine = formatSceneMenuItem(sceneEntry);
    assert(menuLine.includes('[>]'), 'Should show expandable indicator [>]');
  },

  // TEST H.2: Scene without stages shows normal indicator
  'TEST H.2: Scene without stages shows normal indicator': () => {
    const scene = loadScene('high-and-dry', 'finding-the-ship');
    assert(!scene.stages || scene.stages.length === 0, 'Scene should not have stages');

    const sceneEntry = {
      id: 'finding-the-ship',
      title: scene.title,
      completed: false,
      current: false,
      hasStages: false,
      expanded: false,
      stages: null
    };

    const menuLine = formatSceneMenuItem(sceneEntry);
    assert(!menuLine.includes('[>]'), 'Should not show expandable indicator');
    assert(menuLine.includes('[ ]'), 'Should show normal indicator [ ]');
  },

  // TEST H.3: Expanded scene shows stages indented
  'TEST H.3: Expanded scene shows stages indented': () => {
    const scene = loadScene('high-and-dry', 'mountain-climb');

    const sceneEntry = {
      id: 'mountain-climb',
      title: scene.title,
      completed: false,
      current: false,
      hasStages: true,
      expanded: true,
      stages: scene.stages.map(s => ({
        id: slugifyStage(s.name),
        name: s.name,
        altitude: s.altitude,
        completed: false,
        current: false
      }))
    };

    const lines = formatExpandedScene(sceneEntry);
    assert(lines.length > 0, 'Should have stage lines');
    assert(lines.some(l => l.includes('Lower Slopes')), 'Should include Lower Slopes');
    assert(lines.some(l => l.includes('a.')), 'Should have letter prefixes');
    assert(lines.every(l => l.startsWith('      ')), 'Stages should be indented');
  },

  // TEST H.4: Stage selection updates storyState.currentStage
  'TEST H.4: Stage selection updates storyState.currentStage': () => {
    const state = {
      currentScene: 'mountain-climb',
      currentStage: null,
      completedStages: {}
    };

    selectStage(state, 'middle-ascent');
    assert.equal(state.currentStage, 'middle-ascent', 'Should update currentStage');
  },

  // TEST H.5: Stage completion tracking
  'TEST H.5: Stage completion tracking': () => {
    const state = {
      currentScene: 'mountain-climb',
      currentStage: 'lower-slopes',
      completedStages: {}
    };

    completeStage(state, 'lower-slopes');
    assert(state.completedStages['mountain-climb'], 'Should create scene entry');
    assert(state.completedStages['mountain-climb'].includes('lower-slopes'),
      'Should include completed stage');

    // Complete another stage
    completeStage(state, 'middle-ascent');
    assert(state.completedStages['mountain-climb'].includes('middle-ascent'),
      'Should include second completed stage');

    // Verify helper functions
    assert(isStageCompleted(state, 'mountain-climb', 'lower-slopes'),
      'isStageCompleted should return true');
    assert(!isStageCompleted(state, 'mountain-climb', 'scramble-zone'),
      'isStageCompleted should return false for incomplete');

    const completed = getCompletedStages(state, 'mountain-climb');
    assert.equal(completed.length, 2, 'Should have 2 completed stages');
  },

  // TEST H.6: Stage directive parsing
  'TEST H.6: Stage directive parsing': () => {
    const directive = parseSceneDirective('[STAGE: scramble-zone]');
    assert(directive !== null, 'Should parse directive');
    assert.equal(directive.type, DIRECTIVE_TYPES.STAGE, 'Type should be STAGE');
    assert.equal(directive.stageId, 'scramble-zone', 'Should extract stage ID');

    // Test case insensitivity
    const directive2 = parseSceneDirective('[stage: Middle-Ascent]');
    assert(directive2 !== null, 'Should parse lowercase');
    assert.equal(directive2.type, DIRECTIVE_TYPES.STAGE);
  },

  // TEST H.7: Context injection filters by current stage
  'TEST H.7: Context injection filters by current stage': () => {
    const narratorPersona = { archetype: 'narrator', id: 'narrator-high-and-dry' };
    const stateWithStage = {
      currentScene: 'mountain-climb',
      currentStage: 'middle-ascent',
      adventure: 'high-and-dry'
    };

    const ctx = buildSceneContext(narratorPersona, stateWithStage);
    // Middle Ascent is 900-1100m
    assert(ctx.includes('900') || ctx.includes('1100') || ctx.includes('Middle'),
      'Should include middle ascent altitude info');
  },

  // TEST H.8: Full scene context when no stage selected
  'TEST H.8: Full scene context when no stage selected': () => {
    const narratorPersona = { archetype: 'narrator', id: 'narrator-high-and-dry' };
    const sceneOnlyState = {
      currentScene: 'mountain-climb',
      currentStage: null,
      adventure: 'high-and-dry'
    };

    const ctx = buildSceneContext(narratorPersona, sceneOnlyState);
    // Should include full range info
    assert(ctx.includes('500') || ctx.includes('1400') || ctx.includes('Crater'),
      'Should include full scene info');
  },

  // TEST H.9: slugifyStage generates correct IDs
  'TEST H.9: slugifyStage generates correct IDs': () => {
    assert.equal(slugifyStage('Lower Slopes'), 'lower-slopes');
    assert.equal(slugifyStage('Scramble Zone'), 'scramble-zone');
    assert.equal(slugifyStage('Middle Ascent'), 'middle-ascent');
    assert.equal(slugifyStage('Final Ascent'), 'final-ascent');
    assert.equal(slugifyStage('Crater Descent'), 'crater-descent');
    assert.equal(slugifyStage(null), '');
    assert.equal(slugifyStage(''), '');
  },

  // TEST H.10: getStageBySlug finds stage in scene
  'TEST H.10: getStageBySlug finds stage in scene': () => {
    const scene = loadScene('high-and-dry', 'mountain-climb');

    const stage = getStageBySlug(scene, 'middle-ascent');
    assert(stage !== null, 'Should find stage');
    assert.equal(stage.name, 'Middle Ascent');
    assert.equal(stage.altitude, '900-1100m');

    const noStage = getStageBySlug(scene, 'nonexistent');
    assert(noStage === null, 'Should return null for nonexistent stage');

    const nullScene = getStageBySlug(null, 'middle-ascent');
    assert(nullScene === null, 'Should handle null scene');
  }
};

// === ADDITIONAL HELPER TESTS ===

const helperTests = {
  // Toggle expansion
  'toggleSceneExpansion toggles state': () => {
    const state = { expandedScenes: [] };

    const result1 = toggleSceneExpansion(state, 'mountain-climb');
    assert.equal(result1, true, 'First toggle should expand');
    assert(isSceneExpanded(state, 'mountain-climb'), 'Should be expanded');

    const result2 = toggleSceneExpansion(state, 'mountain-climb');
    assert.equal(result2, false, 'Second toggle should collapse');
    assert(!isSceneExpanded(state, 'mountain-climb'), 'Should not be expanded');
  },

  // Menu item indicators
  'formatSceneMenuItem shows correct indicators': () => {
    // Completed scene
    const completedScene = {
      id: 'test',
      title: 'Test',
      completed: true,
      current: false,
      hasStages: false
    };
    assert(formatSceneMenuItem(completedScene).includes('[✓]'), 'Completed should show checkmark');

    // Current scene
    const currentScene = {
      id: 'test',
      title: 'Test',
      completed: false,
      current: true,
      hasStages: false
    };
    assert(formatSceneMenuItem(currentScene).includes('*'), 'Current should show asterisk');

    // Expanded staged scene
    const expandedScene = {
      id: 'test',
      title: 'Test',
      completed: false,
      current: false,
      hasStages: true,
      expanded: true
    };
    assert(formatSceneMenuItem(expandedScene).includes('[v]'), 'Expanded should show [v]');
  },

  // filterByStage filters correctly
  'filterByStage filters stage-specific facts': () => {
    const facts = [
      { source: 'mountain-climb.json:stages[0]', content: 'Lower Slopes: 500-900m', priority: 2 },
      { source: 'mountain-climb.json:stages[1]', content: 'Middle Ascent: 900-1100m', priority: 2 },
      { source: 'mountain-climb.json:altitude_sickness', content: 'DM-2 penalty', priority: 1 }
    ];

    const middleFacts = filterByStage(facts, 'middle-ascent');
    // Should include altitude_sickness (non-stage) and middle-ascent stage
    assert(middleFacts.some(f => f.content.includes('DM-2')), 'Should include non-stage facts');
    assert(middleFacts.some(f => f.content.includes('900')), 'Should include middle ascent');
  }
};

// === RUN ALL TESTS ===

function main() {
  console.log('=== Hierarchical Scenes Tests ===\n');

  console.log('--- Core Tests (H.1-H.10) ---');
  const corePassed = runTests(hierarchicalTests);

  console.log('\n--- Helper Tests ---');
  const helperPassed = runTests(helperTests);

  const allPassed = corePassed && helperPassed;

  console.log('\n' + '='.repeat(50));
  console.log(allPassed ? '\x1b[32mAll tests passed!\x1b[0m' : '\x1b[31mSome tests failed.\x1b[0m');

  process.exit(allPassed ? 0 : 1);
}

main();
