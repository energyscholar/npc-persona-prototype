/**
 * Geography data module
 * Provides access to adventure geography (settlements, rail, travel times)
 */

const path = require('path');
const fs = require('fs');

// Cache for loaded geography data
const geoCache = new Map();

/**
 * Load geography data for an adventure
 */
function loadGeography(adventureId, geoId) {
  const cacheKey = `${adventureId}:${geoId}`;
  if (geoCache.has(cacheKey)) {
    return geoCache.get(cacheKey);
  }

  const geoPath = path.join(
    __dirname,
    '../data/adventures',
    adventureId,
    'geography',
    `${geoId}.json`
  );

  if (!fs.existsSync(geoPath)) {
    return null;
  }

  const data = JSON.parse(fs.readFileSync(geoPath, 'utf8'));
  geoCache.set(cacheKey, data);
  return data;
}

/**
 * Get travel time between two settlements
 * @param {string} adventureId - Adventure ID (e.g., 'high-and-dry')
 * @param {string} from - Origin settlement ID
 * @param {string} to - Destination settlement ID
 * @param {string} method - Travel method ('rail' or 'road')
 * @returns {string|null} Travel time string or null if not found
 */
function getTravelTime(adventureId, from, to, method) {
  const geo = loadGeography(adventureId, 'settlement-island');
  if (!geo || !geo.travel_times || !geo.travel_times[method]) {
    return null;
  }

  const times = geo.travel_times[method];

  // Try both directions (from-to and to-from)
  const key1 = `${from}-${to}`;
  const key2 = `${to}-${from}`;

  return times[key1] || times[key2] || null;
}

/**
 * Get settlement by ID
 */
function getSettlement(adventureId, settlementId) {
  const geo = loadGeography(adventureId, 'settlement-island');
  if (!geo || !geo.settlements) {
    return null;
  }
  return geo.settlements.find(s => s.id === settlementId);
}

/**
 * Get all settlements for an adventure
 */
function getAllSettlements(adventureId) {
  const geo = loadGeography(adventureId, 'settlement-island');
  if (!geo || !geo.settlements) {
    return [];
  }
  return geo.settlements;
}

/**
 * Get settlements marked as evacuation zones
 */
function getEvacuationZones(adventureId) {
  const settlements = getAllSettlements(adventureId);
  return settlements.filter(s => s.evacuation_zone);
}

/**
 * Clear cache (for testing)
 */
function clearCache() {
  geoCache.clear();
}

module.exports = {
  loadGeography,
  getTravelTime,
  getSettlement,
  getAllSettlements,
  getEvacuationZones,
  clearCache
};
