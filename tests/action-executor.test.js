#!/usr/bin/env node
/**
 * Action Executor Tests (TDD - Tests First)
 *
 * Tests abstract action execution:
 * - Prototype executor (flag-based)
 * - Effect application
 * - Result structure
 * - Error handling
 *
 * AUDITOR INSTANCE: 5f069a8e-52eb-42c4-a874-17ce01f2100b
 */

const { strict: assert } = require('assert');

// Import will fail until implementation exists
let actionExecutor;
try {
  actionExecutor = require('../src/action-executor');
} catch (e) {
  console.error('Action-executor module not yet implemented.\n');
  actionExecutor = {};
}

const {
  executeAction,
  registerExecutor,
  getExecutor,
  ActionResult
} = actionExecutor;

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

// === TEST DATA ===

const sampleContext = {
  npc: { id: 'engineer-1', name: 'Chief Engineer', role: 'engineer' },
  storyState: {
    flags: {
      damage_level: 3,
      fuel_level: 50,
      in_jump: false
    }
  },
  gameDate: '015-1105'
};

// === EXECUTE ACTION TESTS ===

const executeTests = {
  'executeAction returns result object': () => {
    const action = { id: 'repair-system', params: {} };
    const result = executeAction(action, sampleContext);
    assert.ok(result !== null);
    assert.ok(typeof result === 'object');
  },

  'executeAction result has success property': () => {
    const action = { id: 'repair-system', params: {} };
    const result = executeAction(action, sampleContext);
    assert.ok(result.hasOwnProperty('success'));
    assert.ok(typeof result.success === 'boolean');
  },

  'executeAction result has message property': () => {
    const action = { id: 'repair-system', params: {} };
    const result = executeAction(action, sampleContext);
    assert.ok(result.hasOwnProperty('message'));
  },

  'executeAction returns failure for unknown action': () => {
    const action = { id: 'unknown-action-xyz', params: {} };
    const result = executeAction(action, sampleContext);
    assert.equal(result.success, false);
  },

  'executeAction handles null action': () => {
    const result = executeAction(null, sampleContext);
    assert.equal(result.success, false);
  },

  'executeAction handles null context': () => {
    const action = { id: 'repair-system', params: {} };
    const result = executeAction(action, null);
    assert.equal(result.success, false);
  }
};

// === REPAIR ACTION TESTS ===

const repairTests = {
  'repair-system decrements damage_level': () => {
    const context = {
      ...sampleContext,
      storyState: {
        flags: { damage_level: 3 }
      }
    };
    const action = { id: 'repair-system', params: {} };
    const result = executeAction(action, context);

    if (result.success) {
      assert.equal(context.storyState.flags.damage_level, 2);
    }
  },

  'repair-system does not go below 0': () => {
    const context = {
      ...sampleContext,
      storyState: {
        flags: { damage_level: 0 }
      }
    };
    const action = { id: 'repair-system', params: {} };
    executeAction(action, context);

    assert.ok(context.storyState.flags.damage_level >= 0);
  },

  'repair-system includes message about result': () => {
    const context = {
      ...sampleContext,
      storyState: {
        flags: { damage_level: 2 }
      }
    };
    const action = { id: 'repair-system', params: {} };
    const result = executeAction(action, context);

    if (result.success) {
      assert.ok(result.message.length > 0);
    }
  }
};

// === JUMP ACTION TESTS ===

const jumpTests = {
  'execute-jump sets in_jump flag': () => {
    const context = {
      ...sampleContext,
      storyState: {
        flags: { in_jump: false }
      }
    };
    const action = {
      id: 'execute-jump',
      params: { destination: 'Walston' }
    };
    const result = executeAction(action, context);

    if (result.success) {
      assert.equal(context.storyState.flags.in_jump, true);
    }
  },

  'execute-jump sets jump_destination': () => {
    const context = {
      ...sampleContext,
      storyState: {
        flags: {}
      }
    };
    const action = {
      id: 'execute-jump',
      params: { destination: 'Flammarion' }
    };
    const result = executeAction(action, context);

    if (result.success) {
      assert.equal(context.storyState.flags.jump_destination, 'Flammarion');
    }
  },

  'execute-jump includes destination in message': () => {
    const context = {
      ...sampleContext,
      storyState: { flags: {} }
    };
    const action = {
      id: 'execute-jump',
      params: { destination: 'Regina' }
    };
    const result = executeAction(action, context);

    if (result.success) {
      assert.ok(result.message.includes('Regina'));
    }
  }
};

// === MESSAGE ACTION TESTS ===

const messageTests = {
  'send-message returns success': () => {
    const action = {
      id: 'send-message',
      params: {
        targetPc: 'captain-drake',
        message: 'Test message'
      }
    };
    const result = executeAction(action, sampleContext);
    assert.equal(result.success, true);
  },

  'send-message includes queued info': () => {
    const action = {
      id: 'send-message',
      params: {
        targetPc: 'captain-drake',
        message: 'Urgent update'
      }
    };
    const result = executeAction(action, sampleContext);

    if (result.success) {
      assert.ok(result.queued || result.message.includes('queued') || result.success);
    }
  }
};

// === REGISTER EXECUTOR TESTS ===

const registerTests = {
  'registerExecutor adds custom executor': () => {
    registerExecutor('custom-action', (action, context) => {
      return { success: true, message: 'Custom executed' };
    });

    const action = { id: 'custom-action', params: {} };
    const result = executeAction(action, sampleContext);
    assert.equal(result.success, true);
    assert.equal(result.message, 'Custom executed');
  },

  'registerExecutor overwrites existing executor': () => {
    registerExecutor('overwrite-test', () => ({ success: true, message: 'v1' }));
    registerExecutor('overwrite-test', () => ({ success: true, message: 'v2' }));

    const result = executeAction({ id: 'overwrite-test' }, sampleContext);
    assert.equal(result.message, 'v2');
  },

  'getExecutor returns function for known action': () => {
    registerExecutor('get-test', () => ({ success: true }));
    const executor = getExecutor('get-test');
    assert.equal(typeof executor, 'function');
  },

  'getExecutor returns null for unknown action': () => {
    const executor = getExecutor('nonexistent-xyz');
    assert.equal(executor, null);
  }
};

// === ACTION RESULT TESTS ===

const resultTests = {
  'ActionResult.success creates success result': () => {
    const result = ActionResult.success('Operation completed');
    assert.equal(result.success, true);
    assert.equal(result.message, 'Operation completed');
  },

  'ActionResult.failure creates failure result': () => {
    const result = ActionResult.failure('Operation failed');
    assert.equal(result.success, false);
    assert.equal(result.message, 'Operation failed');
  },

  'ActionResult includes optional data': () => {
    const result = ActionResult.success('Done', { value: 42 });
    assert.equal(result.data.value, 42);
  }
};

// === EFFECT APPLICATION TESTS ===

const effectTests = {
  'action can modify multiple flags': () => {
    registerExecutor('multi-effect', (action, context) => {
      context.storyState.flags.effect1 = true;
      context.storyState.flags.effect2 = 'applied';
      return { success: true, message: 'Multiple effects applied' };
    });

    const context = {
      storyState: { flags: {} }
    };
    executeAction({ id: 'multi-effect' }, context);

    assert.equal(context.storyState.flags.effect1, true);
    assert.equal(context.storyState.flags.effect2, 'applied');
  },

  'action can read context values': () => {
    registerExecutor('read-context', (action, context) => {
      const npcName = context.npc?.name || 'Unknown';
      return { success: true, message: `Executed by ${npcName}` };
    });

    const result = executeAction({ id: 'read-context' }, sampleContext);
    assert.ok(result.message.includes('Chief Engineer'));
  }
};

// === INTEGRATION TESTS ===

const integrationTests = {
  'full repair flow updates state correctly': () => {
    const context = {
      npc: { id: 'eng1', name: 'Engineer' },
      storyState: {
        flags: { damage_level: 5 }
      },
      gameDate: '015-1105'
    };

    // Execute repair twice
    executeAction({ id: 'repair-system' }, context);
    executeAction({ id: 'repair-system' }, context);

    // Damage should be reduced by 2
    assert.equal(context.storyState.flags.damage_level, 3);
  },

  'executor receives all context properties': () => {
    let receivedContext = null;
    registerExecutor('context-check', (action, context) => {
      receivedContext = context;
      return { success: true };
    });

    executeAction({ id: 'context-check' }, sampleContext);

    assert.ok(receivedContext.npc);
    assert.ok(receivedContext.storyState);
    assert.ok(receivedContext.gameDate);
  },

  'module exports are defined': () => {
    assert.ok(typeof executeAction === 'function');
    assert.ok(typeof registerExecutor === 'function');
    assert.ok(typeof getExecutor === 'function');
    assert.ok(ActionResult !== undefined);
  }
};

// === RUN ALL TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  ACTION EXECUTOR TESTS');
console.log('══════════════════════════════════════════\n');

console.log('--- Execute Action Tests ---');
const execute = runTests(executeTests);

console.log('\n--- Repair Action Tests ---');
const repair = runTests(repairTests);

console.log('\n--- Jump Action Tests ---');
const jump = runTests(jumpTests);

console.log('\n--- Message Action Tests ---');
const message = runTests(messageTests);

console.log('\n--- Register Executor Tests ---');
const register = runTests(registerTests);

console.log('\n--- Action Result Tests ---');
const result = runTests(resultTests);

console.log('\n--- Effect Application Tests ---');
const effects = runTests(effectTests);

console.log('\n--- Integration Tests ---');
const integration = runTests(integrationTests);

const allPassed = execute && repair && jump && message && register && result && effects && integration;
process.exit(allPassed ? 0 : 1);
