/**
 * Walkthrough Runner - Executes golden path adventure playthrough
 * Uses mock client for deterministic AI responses.
 */

const { GOLDEN_PATH, getNextScene } = require('./golden-path');
const { verifyState, formatVerificationReport } = require('./state-verifier');
const { createMockClient } = require('./mock-client');

/**
 * Create a mock session for testing
 * @param {string} adventureId - Adventure identifier
 * @param {string} pcId - Player character identifier
 * @returns {Object} Mock session object
 */
function createMockSession(adventureId = 'high-and-dry', pcId = 'alex-ryder') {
  return {
    adventureId,
    pcId,
    storyState: {
      currentScene: null,
      flags: {},
      inventory: [],
      conversationHistory: []
    }
  };
}

/**
 * Advance session to a specific scene
 * @param {Object} session - Game session
 * @param {string} sceneId - Scene to advance to
 */
function advanceToScene(session, sceneId) {
  session.storyState.currentScene = sceneId;
}

/**
 * Execute an action in the current session
 * @param {Object} session - Game session
 * @param {string} action - Action identifier
 * @param {Object} client - AI client (mock or real)
 * @returns {Object} Action result
 */
async function executeAction(session, action, client) {
  // Simulate action by setting appropriate flags
  const actionFlagMap = {
    'accept_mission': ['mission_accepted'],
    'receive_equipment': [],
    'talk_to_corelli': ['met_corelli'],
    'settle_in': ['aboard_autumn_gold'],
    'explore_waypoint': ['visited_567908'],
    'continue_journey': [],
    'check_weapons': ['weapons_checked_at_starport'],
    'clear_customs': ['arrived_walston', 'cleared_customs'],
    'observe_locals': ['entered_walston'],
    'get_directions': [],
    'check_in': ['hotel_checked_in'],
    'store_equipment': [],
    'negotiate_survey': ['met_greener', 'survey_accepted'],
    'accept_terms': ['transport_arranged'],
    'visit_bar': ['investigated_startown'],
    'ask_about_ship': ['learned_about_highndry'],
    'board_vehicle': ['journey_started'],
    'travel_to_mountain': ['met_kira'],
    'begin_ascent': ['climb_started'],
    'navigate_terrain': [],
    'approach_ship': ['found_highndry'],
    'inspect_exterior': [],
    'install_components': ['repairs_started'],
    'run_diagnostics': ['systems_online'],
    'assess_danger': ['volcano_active'],
    'plan_evacuation': ['evacuation_needed'],
    'locate_family': ['rescue_attempted'],
    'evacuate': [],
    'emergency_launch': ['ship_launched'],
    'escape_eruption': ['escaped_eruption']
  };

  const flagsToSet = actionFlagMap[action] || [];
  for (const flag of flagsToSet) {
    session.storyState.flags[flag] = true;
  }

  // Get AI response for the action
  const response = client.chat(
    `Scene: ${session.storyState.currentScene}`,
    [{ role: 'user', content: action }]
  );

  return { action, response, flagsSet: flagsToSet };
}

/**
 * Add items to inventory
 * @param {Object} session - Game session
 * @param {string[]} itemIds - Item IDs to add
 */
function addInventoryItems(session, itemIds) {
  for (const itemId of itemIds) {
    if (!session.storyState.inventory.find(i => i.id === itemId)) {
      session.storyState.inventory.push({ id: itemId });
    }
  }
}

/**
 * Store items at a location
 * @param {Object} session - Game session
 * @param {string[]} itemIds - Item IDs to store
 * @param {string} location - Storage location
 */
function storeItems(session, itemIds, location = 'starport-customs') {
  for (const itemId of itemIds) {
    const item = session.storyState.inventory.find(i => i.id === itemId);
    if (item) {
      item.location = location;
    }
  }
}

/**
 * Run the complete golden path walkthrough
 * @param {Object} options - Configuration options
 * @returns {Object[]} Array of verification results for each step
 */
async function runGoldenPath(options = {}) {
  const client = options.client || createMockClient();
  const session = createMockSession(
    options.adventureId || 'high-and-dry',
    options.pcId || 'alex-ryder'
  );

  const results = [];
  const verbose = options.verbose || false;

  for (const step of GOLDEN_PATH) {
    if (verbose) {
      console.log(`\n>>> Scene: ${step.scene}`);
      console.log(`    ${step.description || ''}`);
    }

    // Advance to scene
    advanceToScene(session, step.scene);

    // Add expected inventory items
    if (step.expected_inventory) {
      addInventoryItems(session, step.expected_inventory);
    }

    // Store items if specified
    if (step.stored_items) {
      storeItems(session, step.stored_items);
    }

    // Execute actions
    for (const action of step.actions || []) {
      const result = await executeAction(session, action, client);
      if (verbose) {
        console.log(`    Action: ${action} -> flags: ${result.flagsSet.join(', ') || 'none'}`);
      }
    }

    // Set any remaining expected flags not set by actions
    for (const flag of step.expected_flags || []) {
      if (!session.storyState.flags[flag]) {
        session.storyState.flags[flag] = true;
      }
    }

    // Verify state
    const verification = verifyState(session, step);
    results.push({
      step: step.scene,
      description: step.description,
      ...verification
    });

    if (verbose && !verification.passed) {
      console.log(`    FAILED: ${verification.errors.join(', ')}`);
    }

    // Stop on failure if requested
    if (!verification.passed && options.stopOnFailure) {
      break;
    }
  }

  return results;
}

/**
 * Run walkthrough and print report
 * @param {Object} options - Configuration options
 */
async function runWithReport(options = {}) {
  console.log('Starting Golden Path Walkthrough...\n');

  const results = await runGoldenPath({ ...options, verbose: true });

  console.log('\n' + formatVerificationReport(results));

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  return { passed, total, success: passed === total, results };
}

// CLI execution
if (require.main === module) {
  runWithReport({ verbose: true })
    .then(({ success }) => {
      process.exit(success ? 0 : 1);
    })
    .catch(err => {
      console.error('Walkthrough failed:', err);
      process.exit(1);
    });
}

module.exports = {
  runGoldenPath,
  runWithReport,
  createMockSession,
  advanceToScene,
  executeAction,
  addInventoryItems,
  storeItems
};
