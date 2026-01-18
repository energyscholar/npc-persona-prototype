/**
 * Subsector Data Module
 * O(1) lookups for Spinward Marches world data
 *
 * Loads pre-indexed subsector JSON files and builds hash maps
 * for fast world lookup by name or hex code.
 */

const fs = require('fs');
const path = require('path');

// Data directory
const SUBSECTORS_DIR = path.join(__dirname, '../data/subsectors');

// Hash maps for O(1) lookup
let worldsByName = {};
let worldsByHex = {};
let initialized = false;

// UWP description helpers (inline for context building)
const STARPORT_CLASSES = {
  'A': 'Excellent - refined fuel, full repair',
  'B': 'Good - refined fuel, repair facilities',
  'C': 'Routine - unrefined fuel only',
  'D': 'Poor - unrefined fuel, limited service',
  'E': 'Frontier - no facilities',
  'X': 'No starport'
};

const SIZE_DESCRIPTIONS = {
  '0': 'Asteroid/planetoid',
  '1': '~1,600 km',
  '2': '~3,200 km',
  '3': '~4,800 km',
  '4': '~6,400 km',
  '5': '~8,000 km',
  '6': '~9,600 km',
  '7': '~11,200 km',
  '8': '~12,800 km (Earth-sized)',
  '9': '~14,400 km',
  'A': '~16,000 km'
};

const ATMOSPHERE_TYPES = {
  '0': 'None',
  '1': 'Trace',
  '2': 'Very thin, tainted',
  '3': 'Very thin',
  '4': 'Thin, tainted',
  '5': 'Thin',
  '6': 'Standard',
  '7': 'Standard, tainted',
  '8': 'Dense',
  '9': 'Dense, tainted',
  'A': 'Exotic',
  'B': 'Corrosive',
  'C': 'Insidious',
  'D': 'Very dense',
  'E': 'Low',
  'F': 'Unusual'
};

const HYDROGRAPHICS = {
  '0': '0% water',
  '1': '10% water',
  '2': '20% water',
  '3': '30% water',
  '4': '40% water',
  '5': '50% water',
  '6': '60% water',
  '7': '70% water',
  '8': '80% water',
  '9': '90% water',
  'A': '100% water'
};

/**
 * Initialize the subsector data by loading all JSON files
 */
function initialize() {
  if (initialized) return;

  try {
    if (!fs.existsSync(SUBSECTORS_DIR)) {
      console.warn('Subsector data directory not found:', SUBSECTORS_DIR);
      initialized = true;
      return;
    }

    const files = fs.readdirSync(SUBSECTORS_DIR)
      .filter(f => f.endsWith('.json'));

    for (const file of files) {
      try {
        const filePath = path.join(SUBSECTORS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const subsector = JSON.parse(content);

        if (subsector.systems && Array.isArray(subsector.systems)) {
          for (const world of subsector.systems) {
            // Index by name (case-insensitive)
            if (world.name) {
              worldsByName[world.name.toLowerCase()] = world;
            }
            // Index by hex
            if (world.hex) {
              worldsByHex[world.hex] = world;
            }
          }
        }
      } catch (e) {
        // Skip invalid files
      }
    }

    initialized = true;
  } catch (e) {
    console.error('Error initializing subsector data:', e.message);
    initialized = true;
  }
}

/**
 * Get a world by name
 * @param {string} name - World name (case-insensitive)
 * @returns {Object|null} World data or null
 */
function getWorld(name) {
  if (!initialized) initialize();
  if (!name) return null;
  return worldsByName[name.toLowerCase()] || null;
}

/**
 * Get a world by hex code
 * @param {string} hex - Hex code (e.g., '1031')
 * @returns {Object|null} World data or null
 */
function getWorldByHex(hex) {
  if (!initialized) initialize();
  if (!hex) return null;
  return worldsByHex[hex] || null;
}

/**
 * Parse a UWP code into components
 * @param {string} uwp - UWP code (e.g., 'E532000-0')
 * @returns {Object} Parsed UWP components
 */
function parseUWP(uwp) {
  if (!uwp || uwp.length < 9) return null;

  return {
    starport: uwp[0],
    size: uwp[1],
    atmosphere: uwp[2],
    hydrographics: uwp[3],
    population: uwp[4],
    government: uwp[5],
    lawLevel: uwp[6],
    techLevel: uwp[8] // After the dash
  };
}

/**
 * Build a human-readable world context for narrator injection
 * @param {string} worldName - World name
 * @returns {string} Formatted world context
 */
function buildWorldContext(worldName) {
  const world = getWorld(worldName);
  if (!world) return '';

  const uwp = parseUWP(world.uwp);
  if (!uwp) return '';

  const lines = [
    `=== WORLD DATA: ${world.name} ===`,
    `Hex: ${world.hex}`,
    `UWP: ${world.uwp}`,
    `Starport ${uwp.starport} (${STARPORT_CLASSES[uwp.starport] || 'Unknown'})`,
    `Size ${uwp.size} (${SIZE_DESCRIPTIONS[uwp.size] || 'Unknown'})`,
    `Atmosphere ${uwp.atmosphere} (${ATMOSPHERE_TYPES[uwp.atmosphere] || 'Unknown'})`,
    `Hydrographics ${uwp.hydrographics} (${HYDROGRAPHICS[uwp.hydrographics] || 'Unknown'})`,
    `Tech Level ${world.techLevel}`
  ];

  if (world.bases && world.bases.length > 0) {
    lines.push(`Bases: ${world.bases.join(', ')}`);
  }

  if (world.remarks) {
    lines.push(`Trade Codes: ${world.remarks}`);
  }

  if (world.zone) {
    lines.push(`Travel Zone: ${world.zone}`);
  }

  if (world.allegiance) {
    lines.push(`Allegiance: ${world.allegiance}`);
  }

  lines.push('');
  lines.push('CRITICAL: Use these EXACT stats when discussing this world.');

  return lines.join('\n');
}

/**
 * Get all loaded worlds (for debugging/testing)
 * @returns {Object} Stats about loaded data
 */
function getStats() {
  if (!initialized) initialize();
  return {
    worldsByName: Object.keys(worldsByName).length,
    worldsByHex: Object.keys(worldsByHex).length,
    initialized
  };
}

/**
 * Reset module state (for testing)
 */
function reset() {
  worldsByName = {};
  worldsByHex = {};
  initialized = false;
}

module.exports = {
  initialize,
  getWorld,
  getWorldByHex,
  buildWorldContext,
  parseUWP,
  getStats,
  reset
};
