/**
 * Tests for scene ordering system
 *
 * Audit: .claude/plans/scene-ordering-audit.md
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
  if (!fs.existsSync(scenePath)) return null;
  return JSON.parse(fs.readFileSync(scenePath, 'utf8'));
}

// Helper to load act JSON
function loadAct(adventureId, actId) {
  const actPath = path.join(
    __dirname,
    '../data/adventures',
    adventureId,
    'acts',
    `${actId}.json`
  );
  if (!fs.existsSync(actPath)) return null;
  return JSON.parse(fs.readFileSync(actPath, 'utf8'));
}

// TEST S.1: Scenes have order field
test('Scenes have order field', () => {
  const scene = loadScene('high-and-dry', 'scout-office');
  assert.ok(scene, 'scout-office scene should exist');
  assert.strictEqual(typeof scene.order, 'number', 'Scene should have numeric order field');
  assert.ok(scene.order >= 1, 'Order should be >= 1');
});

// TEST S.2: Act files list existing scenes only
test('Act files list existing scenes only', () => {
  const actIds = [
    'act-1-journey',
    'act-2-walston',
    'act-3-mountain',
    'act-4-crisis',
    'act-5-aftermath'
  ];

  for (const actId of actIds) {
    const act = loadAct('high-and-dry', actId);
    assert.ok(act, `Act ${actId} should exist`);
    assert.ok(act.scenes, `Act ${actId} should have scenes array`);

    for (const sceneId of act.scenes) {
      const scene = loadScene('high-and-dry', sceneId);
      assert.ok(scene, `Scene ${sceneId} listed in ${actId} should exist as file`);
    }
  }
});

// TEST S.3: Scene picker respects act file order
test('Scene picker respects act file order', () => {
  const { loadAdventure } = require('../src/story-engine');
  const { getSceneList } = require('../src/adventure-player');

  const adventure = loadAdventure('high-and-dry');
  const sceneList = getSceneList(adventure);

  // First scene should be scout-office (act 1, scene 1)
  assert.strictEqual(sceneList[0], 'scout-office', 'First scene should be scout-office');
});

// TEST S.4: Scenes within act are ordered correctly
test('Scenes within act are ordered correctly', () => {
  const { loadAdventure } = require('../src/story-engine');
  const { getScenesByAct } = require('../src/adventure-player');

  const adventure = loadAdventure('high-and-dry');
  const scenesByAct = getScenesByAct(adventure, {});

  // Check act 1 order
  const act1Key = Object.keys(scenesByAct).find(k => k.includes('act-1'));
  assert.ok(act1Key, 'Should have act 1');

  const act1Scenes = scenesByAct[act1Key];
  assert.ok(act1Scenes.length >= 3, 'Act 1 should have at least 3 scenes');

  // Verify order: scout-office, aboard-autumn-gold, layover-567-908
  const sceneIds = act1Scenes.map(s => s.id);
  const scoutIdx = sceneIds.indexOf('scout-office');
  const aboardIdx = sceneIds.indexOf('aboard-autumn-gold');
  const layoverIdx = sceneIds.indexOf('layover-567-908');

  assert.ok(scoutIdx < aboardIdx, 'scout-office should come before aboard-autumn-gold');
  assert.ok(aboardIdx < layoverIdx, 'aboard-autumn-gold should come before layover-567-908');
});

// TEST S.5: Mountain climb stages visible when expanded
test('Mountain climb stages visible when expanded', () => {
  const { loadAdventure } = require('../src/story-engine');
  const { getScenesByAct } = require('../src/adventure-player');

  const adventure = loadAdventure('high-and-dry');
  const scenesByAct = getScenesByAct(adventure, { expandedScenes: ['mountain-climb'] });

  // Find mountain-climb in act 3
  const act3Key = Object.keys(scenesByAct).find(k => k.includes('act-3'));
  assert.ok(act3Key, 'Should have act 3');

  const mtScene = scenesByAct[act3Key].find(s => s.id === 'mountain-climb');
  assert.ok(mtScene, 'Mountain climb scene should exist in act 3');
  assert.ok(mtScene.stages, 'Mountain climb should have stages');
  assert.ok(mtScene.stages.length >= 6, 'Mountain climb should have at least 6 stages');
});

// TEST S.6: Scene picker format shows correct order
test('Scene picker format shows correct order', () => {
  const { loadAdventure } = require('../src/story-engine');
  const { formatScenePicker } = require('../src/adventure-player');

  const adventure = loadAdventure('high-and-dry');
  const menu = formatScenePicker(adventure, {});
  const lines = menu.split('\n');

  // Find lines containing scene titles
  const scoutIdx = lines.findIndex(l => l.includes('Scout Office'));
  const aboardIdx = lines.findIndex(l => l.includes('Aboard Autumn Gold') || l.includes('Autumn Gold'));
  const layoverIdx = lines.findIndex(l => l.includes('567-908') || l.includes('Layover'));

  assert.ok(scoutIdx > 0, 'Scout Office should appear in menu');
  assert.ok(aboardIdx > 0, 'Aboard Autumn Gold should appear in menu');

  // Scout Office should appear before Aboard Autumn Gold
  assert.ok(
    scoutIdx < aboardIdx,
    `Scout Office (line ${scoutIdx}) should appear before Aboard Autumn Gold (line ${aboardIdx})`
  );
});

// Run tests
async function runTests() {
  console.log('Running scene ordering tests...\n');

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
