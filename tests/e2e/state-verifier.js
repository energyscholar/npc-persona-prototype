/**
 * State Verifier - Functions to verify game state against expectations
 */

/**
 * Verify that expected flags are set in story state
 * @param {Object} session - Game session
 * @param {string[]} expectedFlags - Array of flag names expected to be true
 * @returns {Object} { passed: boolean, missing: string[], extra?: string[] }
 */
function verifyFlags(session, expectedFlags) {
  const flags = session.storyState?.flags || {};
  const missing = [];

  for (const flag of expectedFlags || []) {
    if (!flags[flag]) {
      missing.push(flag);
    }
  }

  return {
    passed: missing.length === 0,
    missing,
    current: Object.keys(flags).filter(k => flags[k])
  };
}

/**
 * Verify inventory contains expected items
 * @param {Object} session - Game session
 * @param {string[]} expectedItems - Array of item IDs expected in inventory
 * @param {string[]} storedItems - Array of item IDs expected to be stored (optional)
 * @returns {Object} { passed: boolean, missing: string[], unexpectedStored: string[] }
 */
function verifyInventory(session, expectedItems, storedItems = []) {
  const inventory = session.storyState?.inventory || [];
  const missing = [];
  const unexpectedStored = [];

  // Check expected items exist
  for (const itemId of expectedItems || []) {
    const item = inventory.find(i => i.id === itemId);
    if (!item) {
      missing.push(itemId);
    }
  }

  // Check stored items are actually stored
  for (const itemId of storedItems || []) {
    const item = inventory.find(i => i.id === itemId);
    if (item && !item.location) {
      unexpectedStored.push(itemId);
    }
  }

  return {
    passed: missing.length === 0 && unexpectedStored.length === 0,
    missing,
    unexpectedStored,
    carried: inventory.filter(i => !i.location && !i.confiscated).map(i => i.id),
    stored: inventory.filter(i => i.location).map(i => ({ id: i.id, location: i.location }))
  };
}

/**
 * Verify current scene matches expected
 * @param {Object} session - Game session
 * @param {string} expectedScene - Expected scene ID
 * @returns {Object} { passed: boolean, current: string, expected: string }
 */
function verifyScene(session, expectedScene) {
  const currentScene = session.storyState?.currentScene;

  return {
    passed: currentScene === expectedScene,
    current: currentScene,
    expected: expectedScene
  };
}

/**
 * Verify complete state against a golden path step
 * @param {Object} session - Game session
 * @param {Object} step - Golden path step with expected state
 * @returns {Object} { passed: boolean, scene: Object, flags: Object, inventory: Object, errors: string[] }
 */
function verifyState(session, step) {
  const errors = [];

  // Verify scene
  const sceneCheck = verifyScene(session, step.scene);
  if (!sceneCheck.passed) {
    errors.push(`Scene mismatch: expected ${step.scene}, got ${sceneCheck.current}`);
  }

  // Verify flags
  const flagsCheck = verifyFlags(session, step.expected_flags);
  if (!flagsCheck.passed) {
    errors.push(`Missing flags: ${flagsCheck.missing.join(', ')}`);
  }

  // Verify inventory
  const invCheck = verifyInventory(
    session,
    step.expected_inventory,
    step.stored_items
  );
  if (!invCheck.passed) {
    if (invCheck.missing.length > 0) {
      errors.push(`Missing inventory: ${invCheck.missing.join(', ')}`);
    }
    if (invCheck.unexpectedStored.length > 0) {
      errors.push(`Items not stored as expected: ${invCheck.unexpectedStored.join(', ')}`);
    }
  }

  return {
    passed: errors.length === 0,
    scene: sceneCheck,
    flags: flagsCheck,
    inventory: invCheck,
    errors
  };
}

/**
 * Create a summary report of verification results
 * @param {Object[]} results - Array of verification results
 * @returns {string} Formatted summary
 */
function formatVerificationReport(results) {
  const lines = ['=== VERIFICATION REPORT ===', ''];

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const status = result.passed ? '✓' : '✗';
    lines.push(`${status} ${result.scene?.expected || 'unknown'}`);

    if (!result.passed) {
      for (const error of result.errors) {
        lines.push(`    - ${error}`);
      }
      failed++;
    } else {
      passed++;
    }
  }

  lines.push('');
  lines.push(`Total: ${passed} passed, ${failed} failed`);

  return lines.join('\n');
}

module.exports = {
  verifyFlags,
  verifyInventory,
  verifyScene,
  verifyState,
  formatVerificationReport
};
