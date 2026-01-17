/**
 * Adventure Data Loader
 * Loads adventure-specific data: items, skill checks, timeline.
 *
 * Pattern: Repository - load adventure resources by ID
 */

const fs = require('fs');
const path = require('path');

const ADVENTURES_DIR = path.join(__dirname, '../data/adventures');

/**
 * Load items data for an adventure
 * @param {string} adventureId - Adventure identifier (e.g., 'high-and-dry')
 * @returns {Object|null} Items data or null if not found
 */
function loadItems(adventureId) {
  if (!adventureId) return null;

  const filePath = path.join(ADVENTURES_DIR, adventureId, 'items.json');
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    // Graceful degradation
  }
  return null;
}

/**
 * Load skill checks data for an adventure
 * @param {string} adventureId - Adventure identifier
 * @returns {Object|null} Skill checks data or null if not found
 */
function loadSkillChecks(adventureId) {
  if (!adventureId) return null;

  const filePath = path.join(ADVENTURES_DIR, adventureId, 'skill-checks.json');
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    // Graceful degradation
  }
  return null;
}

/**
 * Load timeline data for an adventure
 * @param {string} adventureId - Adventure identifier
 * @returns {Object|null} Timeline data or null if not found
 */
function loadTimeline(adventureId) {
  if (!adventureId) return null;

  const filePath = path.join(ADVENTURES_DIR, adventureId, 'timeline.json');
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    // Graceful degradation
  }
  return null;
}

/**
 * Recursively search for an item by ID in an object
 * @param {Object} obj - Object to search
 * @param {string} itemId - Item ID to find
 * @returns {Object|null} Found item or null
 */
function findItemRecursive(obj, itemId) {
  if (!obj || typeof obj !== 'object') return null;

  // Check if this object has the item ID as a key
  if (obj[itemId] && typeof obj[itemId] === 'object') {
    return { id: itemId, ...obj[itemId] };
  }

  // Check if this object has an 'items' array with matching ID
  if (obj.items && Array.isArray(obj.items)) {
    const found = obj.items.find(i => i.id === itemId);
    if (found) return found;
  }

  // Recurse into nested objects
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null) {
      const found = findItemRecursive(value, itemId);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Get a specific item by ID
 * @param {string} itemId - Item identifier (e.g., 'circuit-panel-cases')
 * @param {string} adventureId - Adventure identifier
 * @returns {Object|null} Item data or null
 */
function getItem(itemId, adventureId) {
  if (!itemId || !adventureId) return null;

  const items = loadItems(adventureId);
  if (!items) return null;

  return findItemRecursive(items, itemId);
}

/**
 * Get items relevant to an NPC by their role
 * @param {string} npcId - NPC identifier
 * @param {string} adventureId - Adventure identifier
 * @returns {Object[]} Array of relevant items
 */
function getItemsByRole(npcId, adventureId) {
  if (!npcId || !adventureId) return [];

  const items = loadItems(adventureId);
  if (!items) return [];

  const results = [];

  // NPC-to-item mappings
  const npcItemMappings = {
    'mr-casarii': ['pc_equipment.scout_service_kit', 'payment_details.scout_service_offer'],
    'captain-corelli': ['autumn_gold_cargo'],
    'minister-greener': ['payment_details.greener_offer', 'highndry_cargo.seismic_charges'],
    'customs-officer-walston': ['payment_details.local_costs'],
    'startown-bartender': []
  };

  const mappings = npcItemMappings[npcId] || [];

  for (const mapping of mappings) {
    const parts = mapping.split('.');
    let current = items;

    for (const part of parts) {
      if (current && current[part]) {
        current = current[part];
      } else {
        current = null;
        break;
      }
    }

    if (current) {
      results.push({
        path: mapping,
        data: current
      });
    }
  }

  return results;
}

/**
 * Get a specific skill check by ID
 * @param {string} checkId - Check identifier (e.g., 'mountain_climb.outcrop-climb')
 * @param {string} adventureId - Adventure identifier
 * @returns {Object|null} Skill check data or null
 */
function getSkillCheck(checkId, adventureId) {
  if (!checkId || !adventureId) return null;

  const skillChecks = loadSkillChecks(adventureId);
  if (!skillChecks || !skillChecks.skill_checks_by_scene) return null;

  // Parse checkId (format: 'scene_key.check_id')
  const parts = checkId.split('.');
  if (parts.length !== 2) return null;

  const [sceneKey, checkName] = parts;
  const scene = skillChecks.skill_checks_by_scene[sceneKey];
  if (!scene || !scene.checks) return null;

  const check = scene.checks.find(c => c.id === checkName);
  if (check) {
    return {
      ...check,
      scene: sceneKey,
      location: scene.location
    };
  }

  return null;
}

/**
 * Get all skill checks relevant to a scene
 * @param {string} sceneId - Scene identifier
 * @param {string} adventureId - Adventure identifier
 * @returns {Object[]} Array of skill checks
 */
function getRelevantChecks(sceneId, adventureId) {
  if (!sceneId || !adventureId) return [];

  const skillChecks = loadSkillChecks(adventureId);
  if (!skillChecks || !skillChecks.skill_checks_by_scene) return [];

  // Scene-to-skill-check mappings
  const sceneCheckMappings = {
    'mountain-climb': 'mountain_climb',
    'ship-repairs': 'ship_repairs',
    'save-the-ship': 'save_the_ship',
    'finding-the-ship': 'tensher_encounter',
    'layover-567-908': 'social_checks'
  };

  const checkKey = sceneCheckMappings[sceneId];
  if (!checkKey) return [];

  const sceneChecks = skillChecks.skill_checks_by_scene[checkKey];
  if (!sceneChecks || !sceneChecks.checks) return [];

  return sceneChecks.checks.map(c => ({
    ...c,
    scene: checkKey,
    location: sceneChecks.location,
    ref: `${checkKey}.${c.id}`
  }));
}

/**
 * Get timeline knowledge for an NPC
 * @param {string} npcId - NPC identifier
 * @param {string} adventureId - Adventure identifier
 * @returns {Object|null} NPC's timing knowledge or null
 */
function getNpcTimingKnowledge(npcId, adventureId) {
  if (!npcId || !adventureId) return null;

  const timeline = loadTimeline(adventureId);
  if (!timeline || !timeline.npc_timing_knowledge) return null;

  // Convert npc ID to timeline key format
  const keyMappings = {
    'captain-corelli': 'captain_corelli',
    'minister-greener': 'minister_greener',
    'startown-bartender': 'startown_bartender',
    'customs-officer-walston': 'customs_officer'
  };

  const timelineKey = keyMappings[npcId] || npcId.replace(/-/g, '_');
  return timeline.npc_timing_knowledge[timelineKey] || null;
}

/**
 * Get travel duration information
 * @param {string} routeId - Route identifier (e.g., 'flammarion_to_567908')
 * @param {string} adventureId - Adventure identifier
 * @returns {Object|null} Duration info or null
 */
function getTravelDuration(routeId, adventureId) {
  if (!routeId || !adventureId) return null;

  const timeline = loadTimeline(adventureId);
  if (!timeline || !timeline.travel_durations) return null;

  return timeline.travel_durations[routeId] || null;
}

/**
 * Get creature stats
 * @param {string} creatureId - Creature identifier
 * @param {string} adventureId - Adventure identifier
 * @returns {Object|null} Creature stats or null
 */
function getCreature(creatureId, adventureId) {
  if (!creatureId || !adventureId) return null;

  const items = loadItems(adventureId);
  if (!items || !items.creatures) return null;

  return items.creatures[creatureId] || null;
}

module.exports = {
  loadItems,
  loadSkillChecks,
  loadTimeline,
  getItem,
  getItemsByRole,
  getSkillCheck,
  getRelevantChecks,
  getNpcTimingKnowledge,
  getTravelDuration,
  getCreature
};
