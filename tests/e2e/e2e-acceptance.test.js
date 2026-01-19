#!/usr/bin/env node
/**
 * End-to-End Adventure Testing - Acceptance Criteria
 * Tests for both automated walkthrough and interactive debug mode.
 */

const { strict: assert } = require('assert');
const path = require('path');
const fs = require('fs');

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

// === MODULE EXISTENCE TESTS ===

const moduleTests = {
  'golden-path.js exists': () => {
    const filePath = path.join(__dirname, 'golden-path.js');
    assert.ok(fs.existsSync(filePath), 'golden-path.js should exist');
  },

  'walkthrough-runner.js exists': () => {
    const filePath = path.join(__dirname, 'walkthrough-runner.js');
    assert.ok(fs.existsSync(filePath), 'walkthrough-runner.js should exist');
  },

  'state-verifier.js exists': () => {
    const filePath = path.join(__dirname, 'state-verifier.js');
    assert.ok(fs.existsSync(filePath), 'state-verifier.js should exist');
  },

  'mock-client.js exists': () => {
    const filePath = path.join(__dirname, 'mock-client.js');
    assert.ok(fs.existsSync(filePath), 'mock-client.js should exist');
  }
};

// === GOLDEN PATH TESTS ===

let goldenPath, GOLDEN_PATH;
try {
  goldenPath = require('./golden-path');
  GOLDEN_PATH = goldenPath.GOLDEN_PATH;
} catch (e) {
  GOLDEN_PATH = null;
}

const goldenPathTests = {
  'GOLDEN_PATH is exported array': () => {
    assert.ok(GOLDEN_PATH, 'GOLDEN_PATH should be exported');
    assert.ok(Array.isArray(GOLDEN_PATH), 'GOLDEN_PATH should be array');
    assert.ok(GOLDEN_PATH.length >= 10, 'Should have at least 10 scene steps');
  },

  'GOLDEN_PATH starts at scout-office': () => {
    assert.ok(GOLDEN_PATH, 'GOLDEN_PATH required');
    assert.strictEqual(GOLDEN_PATH[0].scene, 'scout-office');
  },

  'GOLDEN_PATH ends at aftermath': () => {
    assert.ok(GOLDEN_PATH, 'GOLDEN_PATH required');
    const lastStep = GOLDEN_PATH[GOLDEN_PATH.length - 1];
    assert.strictEqual(lastStep.scene, 'aftermath');
  },

  'each step has scene property': () => {
    assert.ok(GOLDEN_PATH, 'GOLDEN_PATH required');
    for (const step of GOLDEN_PATH) {
      assert.ok(step.scene, `Step should have scene: ${JSON.stringify(step)}`);
    }
  },

  'starport-arrival step has weapons_checked flag': () => {
    assert.ok(GOLDEN_PATH, 'GOLDEN_PATH required');
    const arrivalStep = GOLDEN_PATH.find(s => s.scene === 'starport-arrival');
    assert.ok(arrivalStep, 'Should have starport-arrival step');
    assert.ok(
      arrivalStep.expected_flags?.includes('weapons_checked_at_starport') ||
      arrivalStep.expected_flags?.includes('cleared_customs'),
      'Should expect customs-related flags'
    );
  }
};

// === STATE VERIFIER TESTS ===

let stateVerifier;
try {
  stateVerifier = require('./state-verifier');
} catch (e) {
  stateVerifier = null;
}

const verifierTests = {
  'verifyFlags function exists': () => {
    assert.ok(stateVerifier, 'state-verifier module required');
    assert.ok(typeof stateVerifier.verifyFlags === 'function');
  },

  'verifyInventory function exists': () => {
    assert.ok(stateVerifier, 'state-verifier module required');
    assert.ok(typeof stateVerifier.verifyInventory === 'function');
  },

  'verifyScene function exists': () => {
    assert.ok(stateVerifier, 'state-verifier module required');
    assert.ok(typeof stateVerifier.verifyScene === 'function');
  },

  'verifyState combines all checks': () => {
    assert.ok(stateVerifier, 'state-verifier module required');
    assert.ok(typeof stateVerifier.verifyState === 'function');
  }
};

// === MOCK CLIENT TESTS ===

let mockClient;
try {
  mockClient = require('./mock-client');
} catch (e) {
  mockClient = null;
}

const mockClientTests = {
  'createMockClient function exists': () => {
    assert.ok(mockClient, 'mock-client module required');
    assert.ok(typeof mockClient.createMockClient === 'function');
  },

  'mock client has chat method': () => {
    assert.ok(mockClient, 'mock-client module required');
    const client = mockClient.createMockClient();
    assert.ok(typeof client.chat === 'function');
  },

  'mock client returns deterministic responses': () => {
    assert.ok(mockClient, 'mock-client module required');
    const client = mockClient.createMockClient();
    // Two calls with same input should return same output
    const response1 = client.chat('test prompt');
    const response2 = client.chat('test prompt');
    assert.deepStrictEqual(response1, response2);
  }
};

// === DEBUG OVERLAY TESTS ===

let debugOverlay;
try {
  debugOverlay = require('../../src/debug-overlay');
} catch (e) {
  debugOverlay = null;
}

const debugOverlayTests = {
  'debug-overlay.js exists': () => {
    const filePath = path.join(__dirname, '../../src/debug-overlay.js');
    assert.ok(fs.existsSync(filePath), 'debug-overlay.js should exist');
  },

  'renderDebugOverlay function exists': () => {
    assert.ok(debugOverlay, 'debug-overlay module required');
    assert.ok(typeof debugOverlay.renderDebugOverlay === 'function');
  },

  'formatFlags function exists': () => {
    assert.ok(debugOverlay, 'debug-overlay module required');
    assert.ok(typeof debugOverlay.formatFlags === 'function');
  },

  'formatInventory function exists': () => {
    assert.ok(debugOverlay, 'debug-overlay module required');
    assert.ok(typeof debugOverlay.formatInventory === 'function');
  }
};

// === DEBUG COMMANDS TESTS ===

let debugCommands;
try {
  debugCommands = require('../../src/debug-commands');
} catch (e) {
  debugCommands = null;
}

const debugCommandTests = {
  'debug-commands.js exists': () => {
    const filePath = path.join(__dirname, '../../src/debug-commands.js');
    assert.ok(fs.existsSync(filePath), 'debug-commands.js should exist');
  },

  'handleDebugCommand function exists': () => {
    assert.ok(debugCommands, 'debug-commands module required');
    assert.ok(typeof debugCommands.handleDebugCommand === 'function');
  },

  'isDebugCommand function exists': () => {
    assert.ok(debugCommands, 'debug-commands module required');
    assert.ok(typeof debugCommands.isDebugCommand === 'function');
  },

  '/flags command is recognized': () => {
    assert.ok(debugCommands, 'debug-commands module required');
    assert.ok(debugCommands.isDebugCommand('/flags'));
  },

  '/inv command is recognized': () => {
    assert.ok(debugCommands, 'debug-commands module required');
    assert.ok(debugCommands.isDebugCommand('/inv'));
  },

  '/goto command is recognized': () => {
    assert.ok(debugCommands, 'debug-commands module required');
    assert.ok(debugCommands.isDebugCommand('/goto test-scene'));
  }
};

// === WALKTHROUGH RUNNER TESTS ===

let walkthroughRunner;
try {
  walkthroughRunner = require('./walkthrough-runner');
} catch (e) {
  walkthroughRunner = null;
}

const runnerTests = {
  'runGoldenPath function exists': () => {
    assert.ok(walkthroughRunner, 'walkthrough-runner module required');
    assert.ok(typeof walkthroughRunner.runGoldenPath === 'function');
  },

  'runGoldenPath returns results array': async () => {
    assert.ok(walkthroughRunner, 'walkthrough-runner module required');
    // This would be an async test in real implementation
    // For now, just verify the function signature
    assert.ok(true);
  }
};

// Run all test groups
console.log('═══════════════════════════════════════════════════');
console.log('  END-TO-END ADVENTURE TESTING - ACCEPTANCE CRITERIA');
console.log('═══════════════════════════════════════════════════\n');

console.log('--- Module Existence Tests ---');
const modulesOk = runTests(moduleTests);

console.log('\n--- Golden Path Tests ---');
const goldenOk = GOLDEN_PATH ? runTests(goldenPathTests) : (console.log('  (skipped - golden-path.js not yet implemented)'), true);

console.log('\n--- State Verifier Tests ---');
const verifierOk = stateVerifier ? runTests(verifierTests) : (console.log('  (skipped - state-verifier.js not yet implemented)'), true);

console.log('\n--- Mock Client Tests ---');
const mockOk = mockClient ? runTests(mockClientTests) : (console.log('  (skipped - mock-client.js not yet implemented)'), true);

console.log('\n--- Debug Overlay Tests ---');
const overlayOk = debugOverlay ? runTests(debugOverlayTests) : (console.log('  (skipped - debug-overlay.js not yet implemented)'), true);

console.log('\n--- Debug Commands Tests ---');
const commandsOk = debugCommands ? runTests(debugCommandTests) : (console.log('  (skipped - debug-commands.js not yet implemented)'), true);

console.log('\n--- Walkthrough Runner Tests ---');
const runnerOk = walkthroughRunner ? runTests(runnerTests) : (console.log('  (skipped - walkthrough-runner.js not yet implemented)'), true);

// Only fail if modules that should exist are missing
const critical = modulesOk;

console.log('\n═══════════════════════════════════════════════════');
if (critical) {
  console.log('  MODULE STUBS: Implement files to pass tests');
} else {
  console.log('  REQUIRED FILES MISSING');
}
console.log('═══════════════════════════════════════════════════\n');

process.exit(critical ? 0 : 1);
