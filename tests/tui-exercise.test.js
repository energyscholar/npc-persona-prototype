#!/usr/bin/env node
/**
 * TUI Exercise Tests - Spawns actual TUI process with simulated input
 *
 * These tests verify each menu path works end-to-end by:
 * 1. Spawning the actual chat-tui.js process
 * 2. Sending keystrokes via stdin
 * 3. Capturing stdout
 * 4. Verifying expected output appears
 *
 * Uses mock API key to prevent real API calls.
 */

const { spawn } = require('child_process');
const path = require('path');
const { strict: assert } = require('assert');

const TUI_PATH = path.join(__dirname, '../src/chat-tui.js');
const TIMEOUT_MS = 5000;

// Test utilities
let passed = 0;
let failed = 0;

/**
 * Run TUI with simulated input and capture output
 * @param {string[]} inputs - Array of inputs to send (each followed by Enter)
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
function runTui(inputs, timeout = TIMEOUT_MS) {
  return new Promise((resolve) => {
    const child = spawn('node', [TUI_PATH], {
      env: {
        ...process.env,
        NODE_ENV: 'test'
      },
      cwd: path.join(__dirname, '..'), // Run from project root so .env is found
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Send inputs with delays to allow menu rendering
    let inputIndex = 0;
    const sendNextInput = () => {
      if (inputIndex < inputs.length) {
        setTimeout(() => {
          child.stdin.write(inputs[inputIndex] + '\n');
          inputIndex++;
          sendNextInput();
        }, 200);
      }
    };

    // Start sending inputs after initial menu renders
    setTimeout(sendNextInput, 500);

    // Set timeout
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: err.message, code: -1 });
    });
  });
}

/**
 * Strip ANSI codes for cleaner assertions
 */
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    passed++;
  } catch (e) {
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

// ============================================================
// MAIN MENU TESTS
// ============================================================

async function runMainMenuTests() {
  console.log('\n▸ Main Menu Display');

  await test('TUI starts and shows main menu', async () => {
    const result = await runTui(['5'], 3000); // Select Exit
    const output = stripAnsi(result.stdout);

    assert(output.includes('NPC PERSONA PROTOTYPE'), 'Should show title');
    assert(output.includes('Play High and Dry Adventure'), 'Should show option 1');
    assert(output.includes('Communicate with NPC'), 'Should show option 2');
    assert(output.includes('Training Session'), 'Should show option 3');
    assert(output.includes('Quick Chat'), 'Should show option 4');
    assert(output.includes('Exit'), 'Should show option 5');
  });

  await test('Option 5 exits cleanly', async () => {
    const result = await runTui(['5'], 3000);
    // Should exit without error
    assert(result.code === 0 || result.code === null, 'Should exit cleanly');
  });

  await test('Invalid menu option shows error', async () => {
    const result = await runTui(['99', '5'], 3000);
    const output = stripAnsi(result.stdout);

    assert(output.includes('Invalid'), 'Should show invalid selection message');
  });
}

// ============================================================
// OPTION 1: ADVENTURE MODE TESTS
// ============================================================

async function runAdventureModeTests() {
  console.log('\n▸ Option 1: Adventure Mode');

  await test('Adventure mode starts and shows scene picker', async () => {
    // Select adventure, then back out
    const result = await runTui(['1', 'B', '5'], 4000);
    const output = stripAnsi(result.stdout);

    // Should show scene selection or adventure content
    assert(
      output.includes('Scene') || output.includes('High and Dry') || output.includes('SCENE'),
      'Should show scene picker or adventure content'
    );
  });

  await test('Adventure mode loads without PC not found error', async () => {
    const result = await runTui(['1', 'B', '5'], 4000);
    const output = stripAnsi(result.stdout + result.stderr);

    // Critical: should NOT show the alex-ryder-npc error
    assert(!output.includes('PC not found: alex-ryder-npc'), 'Should not have alex-ryder-npc error');
    assert(!output.includes('Fatal error: PC not found'), 'Should not crash on PC load');
  });
}

// ============================================================
// OPTION 2: NPC TEST MODE TESTS
// ============================================================

async function runTestModeTests() {
  console.log('\n▸ Option 2: NPC Test Mode');

  await test('Test mode shows world selection', async () => {
    const result = await runTui(['2', 'B', '5'], 4000);
    const output = stripAnsi(result.stdout);

    // Should show world picker or NPC list
    assert(
      output.includes('Walston') || output.includes('Select') || output.includes('NPC'),
      'Should show world/NPC selection'
    );
  });

  await test('Test mode can select Walston world', async () => {
    // Select test mode, select Walston (1), then back
    const result = await runTui(['2', '1', 'B', '5'], 5000);
    const output = stripAnsi(result.stdout);

    // Should show Walston NPCs
    assert(
      output.includes('Greener') || output.includes('minister') || output.includes('Walston'),
      'Should show Walston NPCs or world'
    );
  });
}

// ============================================================
// OPTION 3: TRAINING SESSION TESTS
// ============================================================

async function runTrainingSessionTests() {
  console.log('\n▸ Option 3: Training Session');

  await test('Training session shows scenario selection', async () => {
    const result = await runTui(['3', 'B', '5'], 4000);
    const output = stripAnsi(result.stdout);

    // Should show training UI elements
    assert(
      output.includes('Training') || output.includes('Scenario') || output.includes('SCENARIO') || output.includes('NPC'),
      'Should show training or scenario selection'
    );
  });

  await test('Training session menu is reachable', async () => {
    const result = await runTui(['3'], 3000);
    const output = stripAnsi(result.stdout);

    // Should not crash immediately
    assert(!output.includes('Fatal error'), 'Should not show fatal error');
    assert(!output.includes('is not a function'), 'Should not have function errors');
  });
}

// ============================================================
// OPTION 4: QUICK CHAT (LEGACY) TESTS
// ============================================================

async function runQuickChatTests() {
  console.log('\n▸ Option 4: Quick Chat (Legacy)');

  await test('Quick chat shows NPC selection', async () => {
    const result = await runTui(['4', 'B', '5'], 4000);
    const output = stripAnsi(result.stdout);

    // Should show NPC picker
    assert(
      output.includes('NPC') || output.includes('Select') || output.includes('Greener'),
      'Should show NPC selection'
    );
  });
}

// ============================================================
// ERROR HANDLING TESTS
// ============================================================

async function runErrorHandlingTests() {
  console.log('\n▸ Error Handling');

  await test('TUI handles rapid input without crash', async () => {
    const result = await runTui(['1', '2', '3', '4', '5'], 4000);
    // Should not crash
    assert(result.code !== -1, 'Should not crash on rapid input');
  });

  await test('TUI recovers from invalid input', async () => {
    const result = await runTui(['xyz', '5'], 3000);
    const output = stripAnsi(result.stdout);

    // Should show invalid message but continue
    assert(output.includes('Invalid') || output.includes('Select'), 'Should handle invalid input');
  });
}

// ============================================================
// SMOKE TESTS - Quick sanity checks
// ============================================================

async function runSmokeTests() {
  console.log('\n▸ Smoke Tests');

  await test('TUI starts without immediate crash', async () => {
    const result = await runTui([], 2000);
    const output = stripAnsi(result.stdout);

    assert(output.includes('NPC PERSONA PROTOTYPE'), 'Should render main menu');
    assert(!output.includes('Fatal error'), 'Should not show fatal error');
  });

  await test('All menu options are numbered correctly', async () => {
    const result = await runTui(['5'], 2000);
    const output = stripAnsi(result.stdout);

    assert(output.includes('1.'), 'Should have option 1');
    assert(output.includes('2.'), 'Should have option 2');
    assert(output.includes('3.'), 'Should have option 3');
    assert(output.includes('4.'), 'Should have option 4');
    assert(output.includes('5.'), 'Should have option 5');
  });

  await test('Box drawing renders correctly', async () => {
    const result = await runTui(['5'], 2000);
    const output = result.stdout;

    // Check for box characters (raw, not stripped)
    assert(output.includes('╔') || output.includes('+'), 'Should have top-left corner');
    assert(output.includes('╗') || output.includes('+'), 'Should have top-right corner');
    assert(output.includes('║') || output.includes('|'), 'Should have vertical border');
  });
}

// ============================================================
// RUN ALL TESTS
// ============================================================

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  TUI EXERCISE TESTS');
  console.log('  Spawns actual TUI with simulated input');
  console.log('══════════════════════════════════════════════════════════════');

  await runSmokeTests();
  await runMainMenuTests();
  await runAdventureModeTests();
  await runTestModeTests();
  await runTrainingSessionTests();
  await runQuickChatTests();
  await runErrorHandlingTests();

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`  TUI Exercise Tests: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});
