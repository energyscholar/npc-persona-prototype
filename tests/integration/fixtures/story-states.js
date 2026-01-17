/**
 * Story State Fixtures for High and Dry Integration Tests
 * Pre-built story states representing different points in the adventure.
 */

const STORY_STATES = {
  act1_journey: {
    adventure: 'high-and-dry',
    currentAct: 'act-1-journey',
    currentScene: 'aboard_autumn_gold',
    gameDate: '001-1105',
    completedBeats: [],
    flags: {}
  },

  act1_waypoint: {
    adventure: 'high-and-dry',
    currentAct: 'act-1-journey',
    currentScene: '567-908_layover',
    gameDate: '008-1105',
    completedBeats: ['departure_flammarion'],
    flags: {}
  },

  act2_arrival: {
    adventure: 'high-and-dry',
    currentAct: 'act-2-walston',
    currentScene: 'starport_arrival',
    gameDate: '015-1105',
    completedBeats: ['departure_flammarion', 'arrival_walston'],
    flags: { customs_cleared: true }
  },

  act2_startown: {
    adventure: 'high-and-dry',
    currentAct: 'act-2-walston',
    currentScene: 'dusty_airlock',
    gameDate: '015-1105',
    completedBeats: ['departure_flammarion', 'arrival_walston', 'customs_cleared'],
    flags: { customs_cleared: true }
  },

  act2_negotiation: {
    adventure: 'high-and-dry',
    currentAct: 'act-2-walston',
    currentScene: 'greener_office',
    gameDate: '015-1105',
    completedBeats: ['departure_flammarion', 'arrival_walston', 'customs_cleared'],
    flags: { customs_cleared: true, met_greener: true }
  },

  act2_accepted: {
    adventure: 'high-and-dry',
    currentAct: 'act-2-walston',
    currentScene: 'preparing_departure',
    gameDate: '016-1105',
    completedBeats: ['departure_flammarion', 'arrival_walston', 'customs_cleared', 'meeting_greener', 'survey_accepted'],
    flags: { customs_cleared: true, met_greener: true, survey_accepted: true, payment: 3000 }
  },

  act3_journey_to_ship: {
    adventure: 'high-and-dry',
    currentAct: 'act-3-ship',
    currentScene: 'mountain_route',
    gameDate: '016-1105',
    completedBeats: ['departure_flammarion', 'arrival_walston', 'customs_cleared', 'meeting_greener', 'survey_accepted', 'journey_to_ship'],
    flags: { customs_cleared: true, survey_accepted: true, payment: 3000 }
  },

  act3_ship_found: {
    adventure: 'high-and-dry',
    currentAct: 'act-3-ship',
    currentScene: 'highndry_exterior',
    gameDate: '016-1105',
    completedBeats: ['departure_flammarion', 'arrival_walston', 'customs_cleared', 'meeting_greener', 'survey_accepted', 'journey_to_ship', 'found_ship'],
    flags: { customs_cleared: true, survey_accepted: true, payment: 3000, ship_located: true }
  },

  act3_survey_in_progress: {
    adventure: 'high-and-dry',
    currentAct: 'act-3-ship',
    currentScene: 'survey_operations',
    gameDate: '017-1105',
    completedBeats: ['departure_flammarion', 'arrival_walston', 'customs_cleared', 'meeting_greener', 'survey_accepted', 'journey_to_ship', 'found_ship', 'ship_entered', 'survey_started'],
    flags: { customs_cleared: true, survey_accepted: true, payment: 3000, ship_located: true, ship_repaired: false, survey_progress: 50 }
  },

  act4_eruption_warning: {
    adventure: 'high-and-dry',
    currentAct: 'act-4-crisis',
    currentScene: 'survey_operations',
    gameDate: '018-1105',
    completedBeats: ['departure_flammarion', 'arrival_walston', 'customs_cleared', 'meeting_greener', 'survey_accepted', 'journey_to_ship', 'found_ship', 'ship_entered', 'survey_started', 'eruption_warning'],
    flags: { customs_cleared: true, survey_accepted: true, survey_complete: true, volcano_warning: true }
  },

  act4_crisis: {
    adventure: 'high-and-dry',
    currentAct: 'act-4-crisis',
    currentScene: 'eruption_begins',
    gameDate: '018-1105',
    completedBeats: ['departure_flammarion', 'arrival_walston', 'customs_cleared', 'meeting_greener', 'survey_accepted', 'journey_to_ship', 'found_ship', 'ship_entered', 'survey_started', 'survey_complete', 'eruption_warning', 'eruption_begins'],
    flags: { customs_cleared: true, survey_accepted: true, survey_complete: true, volcano_active: true, evacuation_ordered: true }
  },

  act4_rescue_choice: {
    adventure: 'high-and-dry',
    currentAct: 'act-4-crisis',
    currentScene: 'rescue_decision',
    gameDate: '018-1105',
    completedBeats: ['departure_flammarion', 'arrival_walston', 'customs_cleared', 'meeting_greener', 'survey_accepted', 'journey_to_ship', 'found_ship', 'ship_entered', 'survey_started', 'survey_complete', 'eruption_warning', 'eruption_begins'],
    flags: {
      customs_cleared: true,
      survey_accepted: true,
      survey_complete: true,
      volcano_active: true,
      evacuation_ordered: true,
      barvinn_endangered: true,
      chauffeur_distress: true,
      barvinn_count: 11,
      limo_count: 3
    }
  },

  resolution_barvinn_saved: {
    adventure: 'high-and-dry',
    currentAct: 'resolution',
    currentScene: 'aftermath',
    gameDate: '019-1105',
    completedBeats: ['departure_flammarion', 'arrival_walston', 'customs_cleared', 'meeting_greener', 'survey_accepted', 'journey_to_ship', 'found_ship', 'ship_entered', 'survey_started', 'survey_complete', 'eruption_warning', 'eruption_begins', 'escape_attempt', 'takeoff_success'],
    flags: {
      customs_cleared: true,
      survey_accepted: true,
      survey_complete: true,
      volcano_active: true,
      evacuation_ordered: true,
      barvinn_rescued: true,
      vargr_rescued: false,
      casualties: 3
    }
  },

  resolution_vargr_saved: {
    adventure: 'high-and-dry',
    currentAct: 'resolution',
    currentScene: 'aftermath',
    gameDate: '019-1105',
    completedBeats: ['departure_flammarion', 'arrival_walston', 'customs_cleared', 'meeting_greener', 'survey_accepted', 'journey_to_ship', 'found_ship', 'ship_entered', 'survey_started', 'survey_complete', 'eruption_warning', 'eruption_begins', 'escape_attempt', 'takeoff_success'],
    flags: {
      customs_cleared: true,
      survey_accepted: true,
      survey_complete: true,
      volcano_active: true,
      evacuation_ordered: true,
      barvinn_rescued: false,
      vargr_rescued: true,
      casualties: 11
    }
  }
};

/**
 * Create a copy of a story state to avoid test pollution
 * @param {string} stateName - Key from STORY_STATES
 * @returns {Object} Deep copy of the state
 */
function getState(stateName) {
  const state = STORY_STATES[stateName];
  if (!state) {
    throw new Error(`Unknown story state: ${stateName}`);
  }
  return JSON.parse(JSON.stringify(state));
}

/**
 * Advance story state to a later point
 * @param {Object} state - Current state
 * @param {string} targetStateName - Target state name
 * @returns {Object} New state
 */
function advanceToState(state, targetStateName) {
  return getState(targetStateName);
}

module.exports = {
  STORY_STATES,
  getState,
  advanceToState
};
