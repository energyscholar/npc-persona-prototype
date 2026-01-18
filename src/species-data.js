/**
 * Species data module
 * Provides access to species reference data (Vargr, Human)
 */

const path = require('path');
const fs = require('fs');

// Cache for loaded species data
const speciesCache = new Map();

/**
 * Get species data by ID
 * @param {string} speciesId - Species ID ('vargr' or 'human')
 * @returns {Object|null} Species data object or null if not found
 */
function getSpecies(speciesId) {
  if (speciesCache.has(speciesId)) {
    return speciesCache.get(speciesId);
  }

  const speciesPath = path.join(
    __dirname,
    '../data/species',
    `${speciesId}.json`
  );

  if (!fs.existsSync(speciesPath)) {
    return null;
  }

  const data = JSON.parse(fs.readFileSync(speciesPath, 'utf8'));
  speciesCache.set(speciesId, data);
  return data;
}

/**
 * Get all available species
 * @returns {Object[]} Array of species data objects
 */
function getAllSpecies() {
  const speciesDir = path.join(__dirname, '../data/species');
  if (!fs.existsSync(speciesDir)) {
    return [];
  }

  const files = fs.readdirSync(speciesDir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const id = f.replace('.json', '');
    return getSpecies(id);
  }).filter(Boolean);
}

/**
 * Get roleplay notes for a species
 * @param {string} speciesId - Species ID
 * @returns {string[]} Array of roleplay notes
 */
function getRoleplayNotes(speciesId) {
  const species = getSpecies(speciesId);
  return species?.roleplay_notes || [];
}

/**
 * Get body language definitions for a species
 * @param {string} speciesId - Species ID
 * @returns {Object|null} Body language object or null
 */
function getBodyLanguage(speciesId) {
  const species = getSpecies(speciesId);
  return species?.psychology?.body_language || null;
}

/**
 * Get Walston-specific data for a species
 * @param {string} speciesId - Species ID
 * @returns {Object|null} Walston-specific data or null
 */
function getWalstonSpecific(speciesId) {
  const species = getSpecies(speciesId);
  return species?.walston_specific || null;
}

/**
 * Clear cache (for testing)
 */
function clearCache() {
  speciesCache.clear();
}

module.exports = {
  getSpecies,
  getAllSpecies,
  getRoleplayNotes,
  getBodyLanguage,
  getWalstonSpecific,
  clearCache
};
