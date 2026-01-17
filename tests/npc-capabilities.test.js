#!/usr/bin/env node
/**
 * NPC Capabilities Tests (TDD - Tests First)
 *
 * Tests role-based capability system:
 * - Role to capability mapping
 * - Permission checks for actions
 * - Custom capability overrides
 *
 * AUDITOR INSTANCE: 5f069a8e-52eb-42c4-a874-17ce01f2100b
 */

const { strict: assert } = require('assert');

// Import will fail until implementation exists
let npcCapabilities;
try {
  npcCapabilities = require('../src/npc-capabilities');
} catch (e) {
  console.error('NPC-capabilities module not yet implemented.\n');
  npcCapabilities = {};
}

const {
  ROLE_CAPABILITIES,
  getCapabilities,
  hasCapability,
  canPerformAction,
  getActionDefinition,
  registerActionDefinition
} = npcCapabilities;

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

// === ROLE CAPABILITY MAPPING TESTS ===

const roleMappingTests = {
  'ROLE_CAPABILITIES is defined': () => {
    assert.ok(ROLE_CAPABILITIES !== undefined);
    assert.equal(typeof ROLE_CAPABILITIES, 'object');
  },

  'captain has command and navigate capabilities': () => {
    const caps = ROLE_CAPABILITIES['captain'];
    assert.ok(Array.isArray(caps));
    assert.ok(caps.includes('can_command'));
    assert.ok(caps.includes('can_navigate'));
  },

  'pilot has navigate and dock capabilities': () => {
    const caps = ROLE_CAPABILITIES['pilot'];
    assert.ok(caps.includes('can_navigate'));
    assert.ok(caps.includes('can_dock'));
  },

  'astrogator has plot_jump capability': () => {
    const caps = ROLE_CAPABILITIES['astrogator'];
    assert.ok(caps.includes('can_plot_jump'));
  },

  'engineer has repair and refuel capabilities': () => {
    const caps = ROLE_CAPABILITIES['engineer'];
    assert.ok(caps.includes('can_repair'));
    assert.ok(caps.includes('can_refuel'));
  },

  'gunner has fire and target capabilities': () => {
    const caps = ROLE_CAPABILITIES['gunner'];
    assert.ok(caps.includes('can_fire'));
    assert.ok(caps.includes('can_target'));
  },

  'medic has heal capability': () => {
    const caps = ROLE_CAPABILITIES['medic'];
    assert.ok(caps.includes('can_heal'));
  },

  'patron has message and hire capabilities': () => {
    const caps = ROLE_CAPABILITIES['patron'];
    assert.ok(caps.includes('can_message'));
    assert.ok(caps.includes('can_hire'));
  },

  'narrator has narrate and advance_time capabilities': () => {
    const caps = ROLE_CAPABILITIES['narrator'];
    assert.ok(caps.includes('can_narrate'));
    assert.ok(caps.includes('can_advance_time'));
  }
};

// === GET CAPABILITIES TESTS ===

const getCapabilitiesTests = {
  'getCapabilities returns array for valid role': () => {
    const npcConfig = { role: 'engineer' };
    const caps = getCapabilities(npcConfig);
    assert.ok(Array.isArray(caps));
    assert.ok(caps.length > 0);
  },

  'getCapabilities includes role capabilities': () => {
    const npcConfig = { role: 'engineer' };
    const caps = getCapabilities(npcConfig);
    assert.ok(caps.includes('can_repair'));
  },

  'getCapabilities includes custom capabilities': () => {
    const npcConfig = {
      role: 'engineer',
      capabilities: ['can_hack', 'can_sabotage']
    };
    const caps = getCapabilities(npcConfig);
    assert.ok(caps.includes('can_repair')); // from role
    assert.ok(caps.includes('can_hack'));   // custom
    assert.ok(caps.includes('can_sabotage')); // custom
  },

  'getCapabilities returns empty array for unknown role': () => {
    const npcConfig = { role: 'unknown_role' };
    const caps = getCapabilities(npcConfig);
    assert.ok(Array.isArray(caps));
  },

  'getCapabilities handles null config': () => {
    const caps = getCapabilities(null);
    assert.ok(Array.isArray(caps));
    assert.equal(caps.length, 0);
  },

  'getCapabilities handles missing role': () => {
    const npcConfig = { name: 'No Role NPC' };
    const caps = getCapabilities(npcConfig);
    assert.ok(Array.isArray(caps));
  },

  'getCapabilities deduplicates capabilities': () => {
    const npcConfig = {
      role: 'engineer',
      capabilities: ['can_repair'] // duplicate of role capability
    };
    const caps = getCapabilities(npcConfig);
    const repairCount = caps.filter(c => c === 'can_repair').length;
    assert.equal(repairCount, 1);
  }
};

// === HAS CAPABILITY TESTS ===

const hasCapabilityTests = {
  'hasCapability returns true for role capability': () => {
    const npcConfig = { role: 'engineer' };
    assert.equal(hasCapability(npcConfig, 'can_repair'), true);
  },

  'hasCapability returns false for missing capability': () => {
    const npcConfig = { role: 'engineer' };
    assert.equal(hasCapability(npcConfig, 'can_fire'), false);
  },

  'hasCapability returns true for custom capability': () => {
    const npcConfig = {
      role: 'engineer',
      capabilities: ['can_hack']
    };
    assert.equal(hasCapability(npcConfig, 'can_hack'), true);
  },

  'hasCapability handles null config': () => {
    assert.equal(hasCapability(null, 'can_repair'), false);
  },

  'hasCapability handles null capability': () => {
    const npcConfig = { role: 'engineer' };
    assert.equal(hasCapability(npcConfig, null), false);
  }
};

// === ACTION DEFINITION TESTS ===

const actionDefinitionTests = {
  'getActionDefinition returns object for known action': () => {
    // Register a test action first
    registerActionDefinition('test-action', {
      id: 'test-action',
      requiredCapabilities: ['can_test']
    });
    const action = getActionDefinition('test-action');
    assert.ok(action !== null);
    assert.equal(action.id, 'test-action');
  },

  'getActionDefinition returns null for unknown action': () => {
    const action = getActionDefinition('nonexistent-action-xyz');
    assert.equal(action, null);
  },

  'getActionDefinition handles null input': () => {
    assert.equal(getActionDefinition(null), null);
  },

  'registerActionDefinition adds new action': () => {
    registerActionDefinition('new-test-action', {
      id: 'new-test-action',
      requiredCapabilities: ['can_do_thing']
    });
    const action = getActionDefinition('new-test-action');
    assert.ok(action !== null);
  },

  'registerActionDefinition overwrites existing action': () => {
    registerActionDefinition('overwrite-test', { version: 1 });
    registerActionDefinition('overwrite-test', { version: 2 });
    const action = getActionDefinition('overwrite-test');
    assert.equal(action.version, 2);
  }
};

// === CAN PERFORM ACTION TESTS ===

const canPerformActionTests = {
  'canPerformAction returns true when NPC has required capabilities': () => {
    registerActionDefinition('repair-system', {
      id: 'repair-system',
      requiredCapabilities: ['can_repair']
    });
    const npcConfig = { role: 'engineer' };
    assert.equal(canPerformAction(npcConfig, 'repair-system'), true);
  },

  'canPerformAction returns false when NPC lacks capabilities': () => {
    registerActionDefinition('fire-weapons', {
      id: 'fire-weapons',
      requiredCapabilities: ['can_fire', 'can_target']
    });
    const npcConfig = { role: 'engineer' };
    assert.equal(canPerformAction(npcConfig, 'fire-weapons'), false);
  },

  'canPerformAction checks all required capabilities': () => {
    registerActionDefinition('complex-action', {
      id: 'complex-action',
      requiredCapabilities: ['can_repair', 'can_hack']
    });
    // Engineer has can_repair but not can_hack
    const npcConfig = { role: 'engineer' };
    assert.equal(canPerformAction(npcConfig, 'complex-action'), false);

    // With custom capability added
    const npcWithHack = { role: 'engineer', capabilities: ['can_hack'] };
    assert.equal(canPerformAction(npcWithHack, 'complex-action'), true);
  },

  'canPerformAction returns false for unknown action': () => {
    const npcConfig = { role: 'engineer' };
    assert.equal(canPerformAction(npcConfig, 'unknown-action-xyz'), false);
  },

  'canPerformAction handles null npcConfig': () => {
    assert.equal(canPerformAction(null, 'repair-system'), false);
  },

  'canPerformAction handles null actionId': () => {
    const npcConfig = { role: 'engineer' };
    assert.equal(canPerformAction(npcConfig, null), false);
  },

  'canPerformAction returns true for action with no requirements': () => {
    registerActionDefinition('no-req-action', {
      id: 'no-req-action',
      requiredCapabilities: []
    });
    const npcConfig = { role: 'engineer' };
    assert.equal(canPerformAction(npcConfig, 'no-req-action'), true);
  }
};

// === INTEGRATION TESTS ===

const integrationTests = {
  'full flow: role -> capabilities -> action check': () => {
    // Setup action
    registerActionDefinition('jump-ship', {
      id: 'jump-ship',
      requiredCapabilities: ['can_navigate', 'can_plot_jump']
    });

    // Astrogator can jump
    const astrogator = { role: 'astrogator' };
    assert.equal(canPerformAction(astrogator, 'jump-ship'), true);

    // Engineer cannot jump
    const engineer = { role: 'engineer' };
    assert.equal(canPerformAction(engineer, 'jump-ship'), false);

    // Captain with pilot training can if given capabilities
    const captain = { role: 'captain', capabilities: ['can_plot_jump'] };
    assert.equal(canPerformAction(captain, 'jump-ship'), true);
  },

  'AI crew member capabilities work correctly': () => {
    const aiGunner = {
      id: 'ag3-gamma',
      role: 'gunner',
      archetype: 'ai_crew'
    };
    assert.ok(hasCapability(aiGunner, 'can_fire'));
    assert.ok(hasCapability(aiGunner, 'can_target'));
  },

  'module exports are defined': () => {
    assert.ok(typeof getCapabilities === 'function');
    assert.ok(typeof hasCapability === 'function');
    assert.ok(typeof canPerformAction === 'function');
    assert.ok(typeof getActionDefinition === 'function');
    assert.ok(typeof registerActionDefinition === 'function');
  }
};

// === RUN ALL TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  NPC CAPABILITIES TESTS');
console.log('══════════════════════════════════════════\n');

console.log('--- Role Mapping Tests ---');
const roleMapping = runTests(roleMappingTests);

console.log('\n--- Get Capabilities Tests ---');
const getCaps = runTests(getCapabilitiesTests);

console.log('\n--- Has Capability Tests ---');
const hasCap = runTests(hasCapabilityTests);

console.log('\n--- Action Definition Tests ---');
const actionDef = runTests(actionDefinitionTests);

console.log('\n--- Can Perform Action Tests ---');
const canPerform = runTests(canPerformActionTests);

console.log('\n--- Integration Tests ---');
const integration = runTests(integrationTests);

const allPassed = roleMapping && getCaps && hasCap && actionDef && canPerform && integration;
process.exit(allPassed ? 0 : 1);
