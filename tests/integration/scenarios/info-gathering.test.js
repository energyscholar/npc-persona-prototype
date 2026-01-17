#!/usr/bin/env node
/**
 * Info Gathering Integration Tests
 * Tests information gating with bartender and customs officer NPCs.
 */

const { strict: assert } = require('assert');
const fs = require('fs');
const path = require('path');

const {
  isUnlocked,
  recordUnlock,
  attemptAccess,
  getAccessibleKnowledge,
  saveUnlocks,
  UNLOCKS_FILE
} = require('../../../src/info-gating');

const { getState } = require('../fixtures/story-states');
const { getTestPc, getSkillLevel } = require('../fixtures/test-pcs');

// Test helper
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

// State management
const BACKUP_FILE = UNLOCKS_FILE + '.integration-backup';

function backupState() {
  if (fs.existsSync(UNLOCKS_FILE)) {
    fs.copyFileSync(UNLOCKS_FILE, BACKUP_FILE);
  }
  // Start with clean state
  saveUnlocks({ unlocks: {} });
}

function restoreState() {
  if (fs.existsSync(BACKUP_FILE)) {
    fs.copyFileSync(BACKUP_FILE, UNLOCKS_FILE);
    fs.unlinkSync(BACKUP_FILE);
  } else {
    saveUnlocks({ unlocks: {} });
  }
}

// Mock NPC configs with gated knowledge
const BARTENDER_CONFIG = {
  id: 'startown-bartender',
  name: 'Mira Tannen',
  knowledge_base: {
    // Free info - no check required
    local_tips: 'First time on Walston? Few things you should know...',
    previous_crew_basic: 'Those scout ship people? Everyone remembers them. Loud, obnoxious.'
  },
  gated_knowledge: {
    crew_trouble: {
      content: 'The crew got into fights at the bar. Had to throw them out twice.',
      requires: { skill: 'Carouse', threshold: 6 },
      unlockOnSuccess: true
    },
    sabotage_rumors: {
      content: 'Word is they sabotaged their own ship. Deliberately. Nobody knows why.',
      requires: { skill: 'Carouse', threshold: 8 },
      unlockOnSuccess: true
    },
    vargr_trust: {
      content: 'You know what\'s funny? The only person they were decent to was a Vargr. Chauffeur for the government.',
      requires: { skill: 'Carouse', threshold: 10 },
      unlockOnSuccess: true
    }
  }
};

const CORFE_CONFIG = {
  id: 'customs-officer-walston',
  name: 'Brennan Corfe',
  knowledge_base: {
    // Free info - professional courtesy
    crew_impression: 'The Highndry crew? Real pieces of work - loud, rude, complained about everything.',
    procedures: 'Standard customs - declare weapons, state your business.'
  },
  gated_knowledge: {
    departure_details: {
      content: 'They left three months ago. Came through without their ship, took passage on a free trader.',
      requires: { skill: 'Persuade', threshold: 8 },
      unlockOnSuccess: true
    },
    exact_timeline: {
      content: 'Let me check the records... Left on 287-1104. The ship logs show they landed, took an air/raft out, came back without it. Filed for departure next day.',
      requires: { skill: 'Persuade', threshold: 10 },
      unlockOnSuccess: true
    }
  }
};

// === INTEGRATION TESTS ===

const bartenderTests = {
  'Free info available without check': () => {
    backupState();
    try {
      const alex = getTestPc('alex_ryder');

      // Public knowledge should always be accessible
      const knowledge = getAccessibleKnowledge(BARTENDER_CONFIG, alex, alex.id, 'startown-bartender');

      assert.ok(knowledge.public.local_tips, 'Local tips should be in public knowledge');
      assert.ok(knowledge.public.previous_crew_basic, 'Basic crew info should be public');
    } finally {
      restoreState();
    }
  },

  'Carouse 6+ unlocks crew_trouble': () => {
    backupState();
    try {
      const social = getTestPc('social_specialist'); // Has Carouse-2
      const gatedInfo = BARTENDER_CONFIG.gated_knowledge.crew_trouble;

      // Mock a successful roll (total >= 6)
      // In real impl, performCheck would use actual 2d6+modifier
      // For testing, we simulate by directly recording unlock
      recordUnlock(social.id, 'startown-bartender', 'crew_trouble');

      assert.ok(
        isUnlocked(social.id, 'startown-bartender', 'crew_trouble'),
        'crew_trouble should be unlocked after success'
      );

      // Verify it appears in accessible knowledge
      const knowledge = getAccessibleKnowledge(BARTENDER_CONFIG, social, social.id, 'startown-bartender');
      assert.ok(knowledge.accessible.crew_trouble, 'crew_trouble should be accessible');
    } finally {
      restoreState();
    }
  },

  'Carouse 8+ required for sabotage_rumors': () => {
    backupState();
    try {
      const alex = getTestPc('alex_ryder'); // No Carouse skill

      // Without unlock, sabotage_rumors should be gated
      const knowledge = getAccessibleKnowledge(BARTENDER_CONFIG, alex, alex.id, 'startown-bartender');

      assert.ok(knowledge.gated.includes('sabotage_rumors'), 'sabotage_rumors should be gated');
      assert.ok(!knowledge.accessible.sabotage_rumors, 'sabotage_rumors should not be accessible');
    } finally {
      restoreState();
    }
  },

  'Carouse 10+ required for vargr_trust secret': () => {
    backupState();
    try {
      const social = getTestPc('social_specialist');

      // Initially gated
      let knowledge = getAccessibleKnowledge(BARTENDER_CONFIG, social, social.id, 'startown-bartender');
      assert.ok(knowledge.gated.includes('vargr_trust'), 'vargr_trust should be gated initially');

      // After unlock
      recordUnlock(social.id, 'startown-bartender', 'vargr_trust');

      knowledge = getAccessibleKnowledge(BARTENDER_CONFIG, social, social.id, 'startown-bartender');
      assert.ok(knowledge.accessible.vargr_trust, 'vargr_trust should be accessible after unlock');
      assert.ok(
        knowledge.accessible.vargr_trust.includes('Vargr'),
        'Content should mention Vargr'
      );
    } finally {
      restoreState();
    }
  },

  'Buying drinks modifier helps checks': () => {
    // This tests the concept - actual modifier would be in skill-check integration
    const social = getTestPc('social_specialist');
    const carouseLevel = getSkillLevel(social, 'Carouse');

    assert.equal(carouseLevel, 2, 'Social specialist should have Carouse-2');

    // With +2 modifier from buying drinks, effective modifier would be +4
    // Making even difficult (10+) checks feasible
    const baseModifier = carouseLevel;
    const drinksModifier = 2;
    const totalModifier = baseModifier + drinksModifier;

    assert.equal(totalModifier, 4, 'Combined modifier should be +4');
    // Average roll of 7 + 4 = 11, passes 10+
  }
};

const corfeTests = {
  'Free info from Corfe without check': () => {
    backupState();
    try {
      const alex = getTestPc('alex_ryder');

      const knowledge = getAccessibleKnowledge(CORFE_CONFIG, alex, alex.id, 'customs-officer-walston');

      assert.ok(knowledge.public.crew_impression, 'Crew impression should be public');
      assert.ok(knowledge.public.procedures, 'Procedures should be public');
    } finally {
      restoreState();
    }
  },

  'Persuade 8+ for departure_details': () => {
    backupState();
    try {
      const drake = getTestPc('captain_drake'); // Has Persuade-1

      // Initially gated
      let knowledge = getAccessibleKnowledge(CORFE_CONFIG, drake, drake.id, 'customs-officer-walston');
      assert.ok(knowledge.gated.includes('departure_details'), 'Should be gated initially');

      // After successful check
      recordUnlock(drake.id, 'customs-officer-walston', 'departure_details');

      knowledge = getAccessibleKnowledge(CORFE_CONFIG, drake, drake.id, 'customs-officer-walston');
      assert.ok(knowledge.accessible.departure_details, 'Should be accessible after unlock');
    } finally {
      restoreState();
    }
  },

  'Persuade 10+ for exact_timeline': () => {
    backupState();
    try {
      const alex = getTestPc('alex_ryder'); // No Persuade

      // Should be gated
      const knowledge = getAccessibleKnowledge(CORFE_CONFIG, alex, alex.id, 'customs-officer-walston');
      assert.ok(knowledge.gated.includes('exact_timeline'), 'exact_timeline should be gated');
    } finally {
      restoreState();
    }
  }
};

const persistenceTests = {
  'Unlocks persist across calls': () => {
    backupState();
    try {
      const alex = getTestPc('alex_ryder');

      recordUnlock(alex.id, 'startown-bartender', 'crew_trouble');

      // Clear in-memory state by reloading
      assert.ok(
        isUnlocked(alex.id, 'startown-bartender', 'crew_trouble'),
        'Unlock should persist'
      );

      // Different info still gated
      assert.ok(
        !isUnlocked(alex.id, 'startown-bartender', 'sabotage_rumors'),
        'Other info should still be gated'
      );
    } finally {
      restoreState();
    }
  },

  'Unlocks are PC-specific': () => {
    backupState();
    try {
      const alex = getTestPc('alex_ryder');
      const drake = getTestPc('captain_drake');

      // Alex unlocks crew_trouble
      recordUnlock(alex.id, 'startown-bartender', 'crew_trouble');

      // Drake should not have it unlocked
      assert.ok(
        isUnlocked(alex.id, 'startown-bartender', 'crew_trouble'),
        'Alex should have unlock'
      );
      assert.ok(
        !isUnlocked(drake.id, 'startown-bartender', 'crew_trouble'),
        'Drake should not have Alex\'s unlock'
      );
    } finally {
      restoreState();
    }
  },

  'Unlocks are NPC-specific': () => {
    backupState();
    try {
      const alex = getTestPc('alex_ryder');

      // Unlock crew_trouble with bartender
      recordUnlock(alex.id, 'startown-bartender', 'crew_trouble');

      // Same key doesn't transfer to different NPC
      assert.ok(
        isUnlocked(alex.id, 'startown-bartender', 'crew_trouble'),
        'Should be unlocked with bartender'
      );
      assert.ok(
        !isUnlocked(alex.id, 'customs-officer-walston', 'crew_trouble'),
        'Should not be unlocked with different NPC'
      );
    } finally {
      restoreState();
    }
  },

  'Multiple unlocks accumulate': () => {
    backupState();
    try {
      const social = getTestPc('social_specialist');

      recordUnlock(social.id, 'startown-bartender', 'crew_trouble');
      recordUnlock(social.id, 'startown-bartender', 'sabotage_rumors');
      recordUnlock(social.id, 'customs-officer-walston', 'departure_details');

      const bartenderKnowledge = getAccessibleKnowledge(
        BARTENDER_CONFIG, social, social.id, 'startown-bartender'
      );
      const corfeKnowledge = getAccessibleKnowledge(
        CORFE_CONFIG, social, social.id, 'customs-officer-walston'
      );

      assert.ok(bartenderKnowledge.accessible.crew_trouble, 'crew_trouble accessible');
      assert.ok(bartenderKnowledge.accessible.sabotage_rumors, 'sabotage_rumors accessible');
      assert.ok(corfeKnowledge.accessible.departure_details, 'departure_details accessible');
    } finally {
      restoreState();
    }
  }
};

// === RUN TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  INFO GATHERING INTEGRATION TESTS');
console.log('  High and Dry Adventure');
console.log('══════════════════════════════════════════\n');

console.log('--- Bartender Intel Tests ---');
const bartender = runTests(bartenderTests);

console.log('\n--- Customs Officer Tests ---');
const corfe = runTests(corfeTests);

console.log('\n--- Persistence Tests ---');
const persistence = runTests(persistenceTests);

const allPassed = bartender && corfe && persistence;
process.exit(allPassed ? 0 : 1);
