/**
 * PC Roster System
 *
 * Manages player characters for the message board.
 * PCs are stored as JSON files in data/pcs/
 */

const fs = require('fs');
const path = require('path');

const PCS_DIR = path.join(__dirname, '../data/pcs');

// Current logged-in PC (session state)
let currentPC = null;

/**
 * List all available PCs
 * @returns {string[]} Array of PC IDs
 */
function listPCs() {
  if (!fs.existsSync(PCS_DIR)) {
    return [];
  }
  return fs.readdirSync(PCS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

/**
 * Load a PC by ID
 * @param {string} pcId - PC identifier
 * @returns {Object} PC data
 * @throws {Error} If PC not found
 */
function loadPC(pcId) {
  const filePath = path.join(PCS_DIR, `${pcId}.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`PC not found: ${pcId}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const pc = JSON.parse(content);

  // Validate required fields
  if (!pc.id || !pc.name) {
    throw new Error(`Invalid PC file: missing id or name`);
  }

  return pc;
}

/**
 * Save a PC definition
 * @param {Object} pc - PC data (must have id, name)
 */
function savePC(pc) {
  if (!pc.id || !pc.name) {
    throw new Error('PC must have id and name');
  }

  if (!fs.existsSync(PCS_DIR)) {
    fs.mkdirSync(PCS_DIR, { recursive: true });
  }

  const filePath = path.join(PCS_DIR, `${pc.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(pc, null, 2));
}

/**
 * Get currently logged-in PC
 * @returns {Object|null} Current PC or null
 */
function getCurrentPC() {
  return currentPC;
}

/**
 * Set the current PC (login)
 * @param {string} pcId - PC to log in as
 * @returns {Object} The PC data
 * @throws {Error} If PC not found
 */
function setCurrentPC(pcId) {
  currentPC = loadPC(pcId);
  return currentPC;
}

/**
 * Clear current PC (logout)
 */
function clearCurrentPC() {
  currentPC = null;
}

/**
 * Check if a PC exists
 * @param {string} pcId - PC identifier
 * @returns {boolean}
 */
function pcExists(pcId) {
  const filePath = path.join(PCS_DIR, `${pcId}.json`);
  return fs.existsSync(filePath);
}

/**
 * Get all PCs with their details
 * @returns {Object[]} Array of PC objects
 */
function getAllPCs() {
  return listPCs().map(id => {
    try {
      return loadPC(id);
    } catch {
      return { id, name: '(invalid)', error: true };
    }
  });
}

module.exports = {
  listPCs,
  loadPC,
  savePC,
  getCurrentPC,
  setCurrentPC,
  clearCurrentPC,
  pcExists,
  getAllPCs
};
