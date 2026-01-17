/**
 * Tests for agm-training-material.md - Structure and content validation
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Load the training material
const TRAINING_MATERIAL_PATH = path.join(__dirname, '../.claude/reference/agm-training-material.md');
let content = '';

try {
  content = fs.readFileSync(TRAINING_MATERIAL_PATH, 'utf-8');
} catch (e) {
  console.error('Could not load agm-training-material.md:', e.message);
  process.exit(1);
}

// Helper to count pattern occurrences
function countMatches(pattern) {
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

// Helper to check section exists
function hasSection(title) {
  return content.includes(`## ${title}`);
}

// ============================================
// Structure Tests
// ============================================

test('Training material file exists and has content', () => {
  assert.ok(content.length > 0, 'File should have content');
  assert.ok(content.length > 50000, 'File should be substantial (>50KB)');
});

test('Has main title and metadata', () => {
  assert.ok(content.includes('# AGM Training Material'), 'Should have main title');
  assert.ok(content.includes('**Created:**'), 'Should have creation date');
  assert.ok(content.includes('**Purpose:**'), 'Should have purpose statement');
});

// ============================================
// Dialogue Pairs Section (20 required)
// ============================================

test('Has Dialogue Pairs Library section', () => {
  assert.ok(hasSection('Dialogue Pairs Library'), 'Should have dialogue pairs section');
});

test('Has at least 20 dialogue pairs', () => {
  // Count numbered dialogue examples (e.g., **1. Arrival Hook**)
  const dialoguePairs = countMatches(/\*\*\d+\.\s+[A-Z][^*]+\*\*/g);
  assert.ok(dialoguePairs >= 20, `Should have at least 20 dialogue pairs, found ${dialoguePairs}`);
});

test('Dialogue pairs cover different scene types', () => {
  assert.ok(content.includes('### Opening Scenes'), 'Should have opening scenes');
  assert.ok(content.includes('### Negotiation Scenes'), 'Should have negotiation scenes');
  assert.ok(content.includes('### Action Scenes'), 'Should have action scenes');
  assert.ok(content.includes('### Emotional Scenes'), 'Should have emotional scenes');
});

test('Dialogue pairs include AGM and PLAYER exchanges', () => {
  const agmLines = countMatches(/^AGM:/gm);
  const playerLines = countMatches(/^PLAYER:/gm);
  assert.ok(agmLines >= 40, `Should have many AGM lines, found ${agmLines}`);
  assert.ok(playerLines >= 30, `Should have many PLAYER lines, found ${playerLines}`);
});

// ============================================
// Skill Narration Section (15 required)
// ============================================

test('Has Skill Check Narration Guide section', () => {
  assert.ok(hasSection('Skill Check Narration Guide'), 'Should have skill narration section');
});

test('Has at least 15 skill narration examples', () => {
  // Count numbered skill examples
  const skillNarrations = content.match(/\*\*\d+\.\s+[A-Z][a-zA-Z\s]+-[A-Z\s]+/g);
  assert.ok(skillNarrations && skillNarrations.length >= 15,
    `Should have at least 15 skill narrations, found ${skillNarrations ? skillNarrations.length : 0}`);
});

test('Skill narrations include difficulty and roll examples', () => {
  assert.ok(content.includes('Difficulty: 8+'), 'Should show difficulty ratings');
  assert.ok(content.includes('Roll:'), 'Should show roll results');
  assert.ok(content.includes('Task:'), 'Should describe tasks');
});

test('Skill narrations cover different skill categories', () => {
  assert.ok(content.includes('### Physical Skills'), 'Should have physical skills');
  assert.ok(content.includes('### Technical Skills'), 'Should have technical skills');
  assert.ok(content.includes('### Social Skills'), 'Should have social skills');
  assert.ok(content.includes('### Pilot Skills'), 'Should have pilot skills');
});

// ============================================
// Anti-Pattern Section (10 required)
// ============================================

test('Has Anti-Pattern Reference section', () => {
  assert.ok(hasSection('Anti-Pattern Reference'), 'Should have anti-pattern section');
});

test('Has at least 10 anti-patterns', () => {
  // Count anti-pattern headers
  const antiPatterns = countMatches(/### \d+\.\s+[A-Z][a-zA-Z\s]+/g);
  // Filter for ones in the anti-pattern section
  const antiPatternSection = content.split('## Anti-Pattern Reference')[1]?.split('## Decision Flowcharts')[0] || '';
  const antiPatternCount = (antiPatternSection.match(/### \d+\./g) || []).length;
  assert.ok(antiPatternCount >= 10, `Should have at least 10 anti-patterns, found ${antiPatternCount}`);
});

test('Anti-patterns have BAD and GOOD examples', () => {
  const badExamples = countMatches(/\*\*BAD:\*\*/g);
  const goodExamples = countMatches(/\*\*GOOD:\*\*/g);
  assert.ok(badExamples >= 10, `Should have at least 10 BAD examples, found ${badExamples}`);
  assert.ok(goodExamples >= 10, `Should have at least 10 GOOD examples, found ${goodExamples}`);
});

test('Anti-patterns include principles', () => {
  const principles = countMatches(/\*\*Principle:\*\*/g);
  assert.ok(principles >= 10, `Should have at least 10 principles, found ${principles}`);
});

// ============================================
// Flowcharts Section (3 required)
// ============================================

test('Has Decision Flowcharts section', () => {
  assert.ok(hasSection('Decision Flowcharts'), 'Should have flowcharts section');
});

test('Has at least 3 flowcharts', () => {
  const flowcharts = content.match(/### \d+\.\s+[A-Z][a-zA-Z\s]+Flow/g);
  assert.ok(flowcharts && flowcharts.length >= 3,
    `Should have at least 3 flowcharts, found ${flowcharts ? flowcharts.length : 0}`);
});

test('Flowcharts use ASCII art elements', () => {
  // Check for box-drawing characters
  assert.ok(content.includes('┌'), 'Should have box corners');
  assert.ok(content.includes('│'), 'Should have vertical lines');
  assert.ok(content.includes('▼'), 'Should have arrows');
  assert.ok(content.includes('└'), 'Should have box corners');
});

// ============================================
// Voice Cards Section (8 required)
// ============================================

test('Has NPC Voice Cards section', () => {
  assert.ok(hasSection('NPC Voice Cards'), 'Should have voice cards section');
});

test('Has at least 8 voice cards', () => {
  // Voice card section has headers like "### Minister Alan Greener", "### Kira (Vargr Chauffeur)"
  const voiceCardSection = content.split('## NPC Voice Cards')[1]?.split('## Scene Templates')[0] || '';
  const voiceCards = voiceCardSection.match(/### [A-Z][a-zA-Z\s()]+/g);
  assert.ok(voiceCards && voiceCards.length >= 8,
    `Should have at least 8 voice cards, found ${voiceCards ? voiceCards.length : 0}`);
});

test('Voice cards include key phrases', () => {
  assert.ok(content.includes('Key Phrases:'), 'Should have key phrases');
});

test('Voice cards include wants/offers/wont', () => {
  // Count in the voice card section only
  // Note: Tensher's Wolf and The Narrator use alternative formats
  const voiceCardSection = content.split('## NPC Voice Cards')[1]?.split('## Scene Templates')[0] || '';
  const wants = (voiceCardSection.match(/Wants:/g) || []).length;
  const offers = (voiceCardSection.match(/Offers:/g) || []).length;
  assert.ok(wants >= 6, `Should have wants in voice cards, found ${wants}`);
  assert.ok(offers >= 6, `Should have offers in voice cards, found ${offers}`);
});

// ============================================
// Templates Section (4 required)
// ============================================

test('Has Scene Templates section', () => {
  assert.ok(hasSection('Scene Templates'), 'Should have templates section');
});

test('Has at least 4 templates', () => {
  const templates = content.match(/### Template \d+:/g);
  assert.ok(templates && templates.length >= 4,
    `Should have at least 4 templates, found ${templates ? templates.length : 0}`);
});

test('Templates include structure boxes', () => {
  assert.ok(content.includes('SETUP'), 'Should have SETUP sections');
  assert.ok(content.includes('RESOLUTION'), 'Should have RESOLUTION sections');
});

// ============================================
// Transcripts Section (3 required)
// ============================================

test('Has Example Play Transcripts section', () => {
  assert.ok(hasSection('Example Play Transcripts'), 'Should have transcripts section');
});

test('Has at least 3 transcripts', () => {
  const transcripts = content.match(/### Transcript \d+:/g);
  assert.ok(transcripts && transcripts.length >= 3,
    `Should have at least 3 transcripts, found ${transcripts ? transcripts.length : 0}`);
});

test('Transcripts include TECHNIQUE annotations', () => {
  const techniques = countMatches(/TECHNIQUE:/g);
  assert.ok(techniques >= 15, `Should have technique annotations, found ${techniques}`);
});

test('Transcripts are from High and Dry adventure', () => {
  assert.ok(content.includes('Greener'), 'Should reference Greener');
  assert.ok(content.includes('Kira'), 'Should reference Kira');
  assert.ok(content.includes('Highndry'), 'Should reference Highndry');
  assert.ok(content.includes('Barvinn'), 'Should reference Barvinn');
});

// ============================================
// Combat Guide Section
// ============================================

test('Has Traveller Combat Narration Guide section', () => {
  assert.ok(hasSection('Traveller Combat Narration Guide'), 'Should have combat guide section');
});

test('Combat guide covers philosophy', () => {
  assert.ok(content.includes('### Philosophy'), 'Should have philosophy section');
  assert.ok(content.includes('TRAVELLER COMBAT IS LETHAL'), 'Should emphasize lethality');
});

test('Combat guide covers pre-combat checklist', () => {
  assert.ok(content.includes('### Pre-Combat Checklist'), 'Should have pre-combat checklist');
  assert.ok(content.includes('Telegraph danger'), 'Should mention telegraphing');
  assert.ok(content.includes('Offer alternatives'), 'Should mention alternatives');
});

test('Combat guide covers combat flow', () => {
  assert.ok(content.includes('### Combat Flow'), 'Should have combat flow');
  assert.ok(content.includes('ROUND STRUCTURE'), 'Should explain round structure');
});

test('Combat guide has attack narration examples', () => {
  assert.ok(content.includes('### Attack Narration Examples'), 'Should have attack examples');
  assert.ok(content.includes('Successful Attack'), 'Should show successful attacks');
  assert.ok(content.includes('Failed Attack'), 'Should show failed attacks');
});

test('Combat guide covers NPC morale', () => {
  assert.ok(content.includes('### NPC Morale'), 'Should have NPC morale section');
  assert.ok(content.includes('WHEN TO CHECK NPC MORALE'), 'Should explain morale triggers');
});

test('Combat guide covers exit strategies', () => {
  assert.ok(content.includes('### Combat Exit Strategies'), 'Should have exit strategies');
  assert.ok(content.includes('WAYS TO END COMBAT'), 'Should list alternatives to killing');
});

test('Combat guide has example scene', () => {
  assert.ok(content.includes('### Example Combat Scene'), 'Should have example scene');
  assert.ok(content.includes('Ambush Near the Ship'), 'Should have specific example');
});

test('Combat guide lists donts', () => {
  assert.ok(content.includes('### Combat Don\'ts'), 'Should have don\'ts section');
  assert.ok(content.includes('AVOID THESE COMBAT MISTAKES'), 'Should list mistakes');
});

// ============================================
// Quick Reference
// ============================================

test('Has Quick Reference Card', () => {
  assert.ok(hasSection('Quick Reference Card'), 'Should have quick reference');
});

test('Quick reference covers key directives', () => {
  assert.ok(content.includes('[SKILL_CHECK:'), 'Should show skill check directive');
  assert.ok(content.includes('[SCENE:'), 'Should show scene directive');
  assert.ok(content.includes('[DECISION:'), 'Should show decision directive');
});

// ============================================
// Content Quality Tests
// ============================================

test('Uses proper AGM directive format', () => {
  // Check directive formats are used correctly
  assert.ok(content.includes('[SKILL_CHECK:'), 'Should use SKILL_CHECK directive');
  assert.ok(content.includes('[DECISION:'), 'Should use DECISION directive');
  assert.ok(content.includes('[BEAT_COMPLETE:'), 'Should use BEAT_COMPLETE directive');
  assert.ok(content.includes('[SCENE:'), 'Should use SCENE directive');
});

test('References High and Dry adventure elements', () => {
  assert.ok(content.includes('Mount Salbarii'), 'Should reference volcano');
  assert.ok(content.includes('Walston'), 'Should reference Walston');
  assert.ok(content.includes('Highndry'), 'Should reference the ship');
  assert.ok(content.includes('Tensher'), 'Should reference wolf');
});

test('Includes "What do you do?" prompts', () => {
  const prompts = countMatches(/What do you do\?/g);
  assert.ok(prompts >= 10, `Should have many action prompts, found ${prompts}`);
});

// Run tests
async function runTests() {
  console.log('Running agm-training-material tests...\n');
  let passed = 0;
  let failed = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (e) {
      console.log(`  ✗ ${name}`);
      console.log(`    ${e.message}`);
      failed++;
    }
  }

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

if (require.main === module) {
  runTests().then(success => process.exit(success ? 0 : 1));
}

module.exports = { runTests };
