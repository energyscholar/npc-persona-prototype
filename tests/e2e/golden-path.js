/**
 * Golden Path - Defines successful playthrough of High and Dry adventure
 * Each step represents a scene with expected state after completion.
 */

const GOLDEN_PATH = [
  {
    scene: 'scout-office',
    description: 'Meet Anders Casarii, receive mission briefing and equipment',
    actions: ['accept_mission', 'receive_equipment'],
    expected_flags: ['mission_accepted'],
    expected_inventory: ['circuit-panels', 'diagnostic-unit', 'spares-container']
  },
  {
    scene: 'aboard-autumn-gold',
    description: 'Travel aboard the far trader to Walston',
    actions: ['talk_to_corelli', 'settle_in'],
    expected_flags: ['met_corelli', 'aboard_autumn_gold']
  },
  {
    scene: 'layover-567-908',
    description: 'Brief stopover at the waypoint station',
    actions: ['explore_waypoint', 'continue_journey'],
    expected_flags: ['visited_567908']
  },
  {
    scene: 'starport-arrival',
    description: 'Arrive at Walston starport, clear customs',
    actions: ['check_weapons', 'clear_customs'],
    expected_flags: ['arrived_walston', 'weapons_checked_at_starport', 'cleared_customs'],
    stored_items: ['autopistol-standard']
  },
  {
    scene: 'walston-arrival',
    description: 'First impressions of Walston settlement',
    actions: ['observe_locals', 'get_directions'],
    expected_flags: ['entered_walston']
  },
  {
    scene: 'startown-hotel',
    description: 'Check into hotel, establish base of operations',
    actions: ['check_in', 'store_equipment'],
    expected_flags: ['hotel_checked_in']
  },
  {
    scene: 'meeting-greener',
    description: 'Meet with Minister Greener to negotiate transport',
    actions: ['negotiate_survey', 'accept_terms'],
    expected_flags: ['met_greener', 'survey_accepted', 'transport_arranged']
  },
  {
    scene: 'startown-investigation',
    description: 'Investigate the local area, gather information',
    actions: ['visit_bar', 'ask_about_ship'],
    expected_flags: ['investigated_startown', 'learned_about_highndry']
  },
  {
    scene: 'journey-to-mountain',
    description: 'Travel to Mount Salbarii with Vargr chauffeur',
    actions: ['board_vehicle', 'travel_to_mountain'],
    expected_flags: ['journey_started', 'met_kira']
  },
  {
    scene: 'mountain-climb',
    description: 'Climb the mountain to reach the ship',
    actions: ['begin_ascent', 'navigate_terrain'],
    expected_flags: ['climb_started']
  },
  {
    scene: 'finding-the-ship',
    description: 'Locate the Highndry scout ship',
    actions: ['approach_ship', 'inspect_exterior'],
    expected_flags: ['found_highndry']
  },
  {
    scene: 'ship-repairs',
    description: 'Repair the Highndry systems',
    actions: ['install_components', 'run_diagnostics'],
    expected_flags: ['repairs_started', 'systems_online']
  },
  {
    scene: 'eruption-begins',
    description: 'Volcanic activity threatens the region',
    actions: ['assess_danger', 'plan_evacuation'],
    expected_flags: ['volcano_active', 'evacuation_needed']
  },
  {
    scene: 'chauffeur-rescue',
    description: 'Rescue Kira and her family',
    actions: ['locate_family', 'evacuate'],
    expected_flags: ['rescue_attempted']
  },
  {
    scene: 'save-the-ship',
    description: 'Emergency launch to save the Highndry',
    actions: ['emergency_launch', 'escape_eruption'],
    expected_flags: ['ship_launched', 'escaped_eruption']
  },
  {
    scene: 'aftermath',
    description: 'Resolution and claiming the Highndry',
    expected_flags: ['adventure_complete', 'highndry_claimed'],
    verify: 'success_ending'
  }
];

/**
 * Get scene step by scene ID
 * @param {string} sceneId - Scene identifier
 * @returns {Object|null} Scene step or null
 */
function getSceneStep(sceneId) {
  return GOLDEN_PATH.find(step => step.scene === sceneId) || null;
}

/**
 * Get all scene IDs in order
 * @returns {string[]} Array of scene IDs
 */
function getSceneOrder() {
  return GOLDEN_PATH.map(step => step.scene);
}

/**
 * Get next scene after given scene
 * @param {string} currentScene - Current scene ID
 * @returns {string|null} Next scene ID or null if at end
 */
function getNextScene(currentScene) {
  const idx = GOLDEN_PATH.findIndex(step => step.scene === currentScene);
  if (idx === -1 || idx >= GOLDEN_PATH.length - 1) return null;
  return GOLDEN_PATH[idx + 1].scene;
}

module.exports = {
  GOLDEN_PATH,
  getSceneStep,
  getSceneOrder,
  getNextScene
};
