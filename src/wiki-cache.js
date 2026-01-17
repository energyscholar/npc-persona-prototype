/**
 * Wiki Cache Module
 * O(1) lookups for Traveller wiki system data.
 *
 * Pattern: Singleton + Lazy Loading
 */

const fs = require('fs');
const path = require('path');

const WIKI_CACHE_PATH = path.join(__dirname, '../data/wiki-cache');
const INDEX_FILE = path.join(WIKI_CACHE_PATH, 'index.json');
const SYSTEMS_DIR = path.join(WIKI_CACHE_PATH, 'systems');

// Singleton state
let initialized = false;
let indexData = null;
let byHexMap = {};
let byNameMap = {};
let bySlugMap = {};

/**
 * Initialize the wiki cache (loads index into memory)
 */
function initialize() {
  if (initialized) return;

  try {
    if (!fs.existsSync(INDEX_FILE)) {
      initialized = true;
      return;
    }

    const data = fs.readFileSync(INDEX_FILE, 'utf8');
    indexData = JSON.parse(data);

    // Build lookup maps
    if (indexData.byHex) {
      byHexMap = indexData.byHex;

      // Build name and slug maps
      for (const [hex, entry] of Object.entries(byHexMap)) {
        if (entry.name) {
          byNameMap[entry.name.toLowerCase()] = { ...entry, hex };
        }
        if (entry.slug) {
          bySlugMap[entry.slug] = { ...entry, hex };
        }
      }
    }

    // Also build from byName if present
    if (indexData.byName) {
      for (const [name, hex] of Object.entries(indexData.byName)) {
        if (!byNameMap[name.toLowerCase()] && byHexMap[hex]) {
          byNameMap[name.toLowerCase()] = { ...byHexMap[hex], hex };
        }
      }
    }

    initialized = true;
  } catch (e) {
    // Graceful degradation - continue without cache
    initialized = true;
  }
}

/**
 * Check if cache is initialized
 * @returns {boolean}
 */
function isInitialized() {
  return initialized;
}

/**
 * Get system entry by hex code
 * @param {string} hex - Hex code (e.g., "1232")
 * @returns {Object|null} System entry or null
 */
function getByHex(hex) {
  if (!hex) return null;
  initialize();

  const entry = byHexMap[hex];
  if (!entry) return null;

  return { ...entry, hex };
}

/**
 * Get system entry by name
 * @param {string} name - System name (case-insensitive)
 * @returns {Object|null} System entry or null
 */
function getByName(name) {
  if (!name) return null;
  initialize();

  return byNameMap[name.toLowerCase()] || null;
}

/**
 * Get system entry by slug
 * @param {string} slug - URL slug
 * @returns {Object|null} System entry or null
 */
function getBySlug(slug) {
  if (!slug) return null;
  initialize();

  return bySlugMap[slug] || null;
}

/**
 * Load system file content
 * @param {string} hex - Hex code
 * @returns {Object|null} Full system data or null
 */
function loadSystemFile(hex) {
  if (!hex) return null;

  const filePath = path.join(SYSTEMS_DIR, `${hex}.json`);
  try {
    if (!fs.existsSync(filePath)) return null;

    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

/**
 * Strip HTML tags and extract text content
 * @param {string} html - Raw HTML
 * @returns {string} Plain text
 */
function stripHtml(html) {
  if (!html) return '';

  return html
    // Remove script and style content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get text content for a system (HTML stripped)
 * @param {string} hex - Hex code
 * @returns {string|null} Text content or null
 */
function getTextContent(hex) {
  const system = loadSystemFile(hex);
  if (!system || !system.rawHtml) return null;

  return stripHtml(system.rawHtml);
}

/**
 * Get raw HTML for a system
 * @param {string} hex - Hex code
 * @returns {string|null} Raw HTML or null
 */
function getRawHtml(hex) {
  const system = loadSystemFile(hex);
  if (!system || !system.rawHtml) return null;

  return system.rawHtml;
}

/**
 * Get all known hex codes
 * @returns {string[]} Array of hex codes
 */
function getAllHexes() {
  initialize();
  return Object.keys(byHexMap);
}

/**
 * Search for systems by name
 * @param {string} query - Search query
 * @returns {Object[]} Matching entries
 */
function search(query) {
  if (!query || typeof query !== 'string') return [];

  initialize();

  const q = query.toLowerCase();
  const results = [];

  for (const [name, entry] of Object.entries(byNameMap)) {
    if (name.includes(q)) {
      results.push(entry);
    }
  }

  return results;
}

module.exports = {
  WIKI_CACHE_PATH,
  isInitialized,
  initialize,
  getByHex,
  getByName,
  getBySlug,
  getTextContent,
  getRawHtml,
  getAllHexes,
  search
};
