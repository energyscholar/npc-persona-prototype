/**
 * Tests for narrative elements system - Stage-level objectives, obstacles, discoveries
 *
 * Audit: .claude/plans/narrative-elements-audit.md
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Helper to load scene JSON
function loadScene(adventureId, sceneId) {
  const scenePath = path.join(
    __dirname,
    '../data/adventures',
    adventureId,
    'scenes',
    `${sceneId}.json`
  );
  return JSON.parse(fs.readFileSync(scenePath, 'utf8'));
}

// TEST N.1: Stage has objective field
test('Stage has objective field', () => {
  const scene = loadScene('high-and-dry', 'mountain-climb');
  assert.ok(scene.stages, 'Scene should have stages array');
  assert.ok(scene.stages.length > 0, 'Scene should have at least one stage');

  const stage = scene.stages[0];
  assert.ok(stage.objective, 'Stage should have objective field');
  assert.strictEqual(typeof stage.objective, 'string', 'Objective should be string');
  assert.ok(stage.objective.length > 0, 'Objective should not be empty');
});

// TEST N.2: Stage has obstacle structure
test('Stage has obstacle structure', () => {
  const scene = loadScene('high-and-dry', 'mountain-climb');
  const stage = scene.stages[0];

  assert.ok(stage.obstacle, 'Stage should have obstacle');
  assert.ok(stage.obstacle.type, 'Obstacle should have type');
  assert.ok(stage.obstacle.description, 'Obstacle should have description');
  assert.ok(stage.obstacle.resolution, 'Obstacle should have resolution');

  // Validate type is from allowed list
  const validTypes = ['terrain', 'environmental', 'social', 'mechanical', 'combat'];
  assert.ok(
    validTypes.includes(stage.obstacle.type),
    `Obstacle type should be one of: ${validTypes.join(', ')}`
  );
});

// TEST N.3: Discoveries have required fields
test('Discoveries have required fields', () => {
  const scene = loadScene('high-and-dry', 'mountain-climb');
  const stage = scene.stages[0];

  assert.ok(stage.discoveries, 'Stage should have discoveries array');
  assert.ok(stage.discoveries.length > 0, 'Stage should have at least one discovery');

  const disc = stage.discoveries[0];
  assert.ok(disc.id, 'Discovery should have id');
  assert.ok(disc.type, 'Discovery should have type');
  assert.ok(disc.trigger, 'Discovery should have trigger');
  assert.ok(disc.content, 'Discovery should have content');

  // Validate type
  const validTypes = ['lore', 'tactical', 'social', 'item', 'secret'];
  assert.ok(
    validTypes.includes(disc.type),
    `Discovery type should be one of: ${validTypes.join(', ')}`
  );

  // Validate trigger
  const validTriggers = ['automatic', 'investigate', 'skill_check', 'npc_interaction'];
  assert.ok(
    validTriggers.includes(disc.trigger),
    `Discovery trigger should be one of: ${validTriggers.join(', ')}`
  );
});

// TEST N.4: Skill checks have outcomes
test('Skill checks have outcomes', () => {
  const scene = loadScene('high-and-dry', 'mountain-climb');

  // Find a stage with skill_checks
  const stageWithChecks = scene.stages.find(s => s.skill_checks && s.skill_checks.length > 0);
  assert.ok(stageWithChecks, 'At least one stage should have skill_checks');

  const check = stageWithChecks.skill_checks[0];
  assert.ok(check.ref, 'Skill check should have ref');
  assert.ok(check.on_success, 'Skill check should have on_success');
  assert.ok(check.on_failure, 'Skill check should have on_failure');
});

// TEST N.5: recordObstacleResolution tracks resolution
test('recordObstacleResolution tracks resolution', () => {
  const { recordObstacleResolution, getStageProgress } = require('../src/narrative-tracker');

  const state = {};
  recordObstacleResolution(state, 'mountain-climb', 'lower-slopes', 'shortcut');

  const progress = getStageProgress(state, 'mountain-climb', 'lower-slopes');
  assert.strictEqual(progress.obstacleResolved, 'shortcut');
});

// TEST N.6: recordDiscovery tracks discoveries
test('recordDiscovery tracks discoveries', () => {
  const { recordDiscovery, getStageProgress } = require('../src/narrative-tracker');

  const state = {};
  recordDiscovery(state, 'mountain-climb', 'lower-slopes', 'shortcut-visible');

  const progress = getStageProgress(state, 'mountain-climb', 'lower-slopes');
  assert.ok(progress.discoveries.includes('shortcut-visible'));

  // Add another discovery
  recordDiscovery(state, 'mountain-climb', 'lower-slopes', 'rock-assessment');
  const progress2 = getStageProgress(state, 'mountain-climb', 'lower-slopes');
  assert.strictEqual(progress2.discoveries.length, 2);
});

// TEST N.7: buildSceneContext includes stage narrative
test('buildSceneContext includes stage narrative elements', () => {
  const { buildSceneContext } = require('../src/knowledge-extraction/context-injector');

  const narrator = { archetype: 'narrator' };
  const storyState = {
    adventure: 'high-and-dry',
    currentScene: 'mountain-climb',
    currentStage: 'lower-slopes'
  };

  const ctx = buildSceneContext(narrator, storyState);

  // Should include stage-level narrative elements
  // At minimum should mention objective or obstacle when stage is set
  assert.ok(
    ctx.includes('OBJECTIVE') || ctx.includes('OBSTACLE') || ctx.includes('STAGE'),
    'Context should include stage narrative elements when currentStage is set'
  );
});

// TEST N.8: buildSceneContext includes prior progress
test('buildSceneContext includes prior progress', () => {
  const { buildSceneContext } = require('../src/knowledge-extraction/context-injector');

  const narrator = { archetype: 'narrator' };
  const storyState = {
    adventure: 'high-and-dry',
    currentScene: 'mountain-climb',
    currentStage: 'middle-ascent',
    stageProgress: {
      'mountain-climb': {
        'lower-slopes': {
          completed: true,
          obstacleResolved: 'shortcut',
          discoveries: ['shortcut-visible']
        }
      }
    }
  };

  const ctx = buildSceneContext(narrator, storyState);

  // Should reference prior progress
  assert.ok(
    ctx.includes('Completed') || ctx.includes('PRIOR') || ctx.includes('already') || ctx.includes('Lower Slopes'),
    'Context should include reference to completed stages'
  );
});

// Run tests
async function runTests() {
  console.log('Running narrative elements tests...\n');

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
