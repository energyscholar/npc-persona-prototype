/**
 * Beat Summaries Module
 * Human-readable summaries of completed story beats.
 *
 * Pattern: Registry - register/lookup beat descriptions
 */

/**
 * Built-in beat summaries by adventure
 */
const BEAT_SUMMARIES = {
  'high-and-dry': {
    'departure_flammarion': 'Left Flammarion aboard the far trader Autumn Gold',
    'arrival_walston': 'Arrived on Walston after two weeks in jump space',
    'customs_cleared': 'Cleared customs at Walston Starport',
    'meeting_greener': 'Met Minister Greener and learned about the Highndry situation',
    'survey_accepted': 'Agreed to complete the volcano survey for Cr3000 plus the ship',
    'journey_to_ship': 'Set out across the wilderness toward the Highndry crash site',
    'found_ship': 'Located the Highndry at the base of Mount Salbarii',
    'ship_entered': 'Entered the Highndry for the first time',
    'survey_started': 'Began the geological survey of Mount Salbarii',
    'survey_complete': 'Completed the volcano survey',
    'eruption_warning': 'Detected signs of imminent volcanic eruption',
    'eruption_begins': 'Mount Salbarii began erupting',
    'escape_attempt': 'Attempted emergency takeoff from the eruption zone',
    'ship_repaired': 'Completed critical repairs to the Highndry',
    'takeoff_success': 'Successfully lifted off from Walston',
    'return_to_port': 'Returned to Walston Starport with the Highndry',
    'claim_filed': 'Filed official salvage claim for the Highndry',
    'adventure_complete': 'Completed High and Dry - the Highndry is yours'
  }
};

/**
 * Get summary for a specific beat
 * @param {string} beatId - Beat identifier
 * @param {string} adventureId - Adventure identifier
 * @returns {string|null} Human-readable summary or null
 */
function getBeatSummary(beatId, adventureId) {
  if (!beatId || !adventureId) return null;

  const adventure = BEAT_SUMMARIES[adventureId];
  if (!adventure) return null;

  return adventure[beatId] || null;
}

/**
 * Get summaries for multiple beats
 * @param {string[]} beatIds - Array of beat identifiers
 * @param {string} adventureId - Adventure identifier
 * @returns {(string|null)[]} Array of summaries (null for unknown beats)
 */
function getBeatSummaries(beatIds, adventureId) {
  if (!beatIds || !Array.isArray(beatIds)) return [];

  return beatIds.map(beatId => getBeatSummary(beatId, adventureId));
}

/**
 * Register a new beat summary
 * @param {string} beatId - Beat identifier
 * @param {string} adventureId - Adventure identifier
 * @param {string} summary - Human-readable summary
 */
function registerBeatSummary(beatId, adventureId, summary) {
  if (!beatId || !adventureId) return;

  if (!BEAT_SUMMARIES[adventureId]) {
    BEAT_SUMMARIES[adventureId] = {};
  }

  BEAT_SUMMARIES[adventureId][beatId] = summary || '';
}

/**
 * Get all summaries for an adventure
 * @param {string} adventureId - Adventure identifier
 * @returns {Object} Map of beatId -> summary
 */
function getAllSummariesForAdventure(adventureId) {
  if (!adventureId) return {};

  return BEAT_SUMMARIES[adventureId] || {};
}

module.exports = {
  BEAT_SUMMARIES,
  getBeatSummary,
  getBeatSummaries,
  registerBeatSummary,
  getAllSummariesForAdventure
};
