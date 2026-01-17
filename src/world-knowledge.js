/**
 * World Knowledge Module
 * UWP parsing and world summary generation for Traveller RPG.
 *
 * UWP format: XNNNNNN-T where:
 * - X = Starport class (A-E, X)
 * - N = Size, Atmosphere, Hydrographics, Population, Government, Law Level (0-F hex)
 * - T = Tech Level (0-F hex)
 */

// Lazy-load wiki-cache to avoid circular dependencies
let wikiCache = null;
function getWikiCache() {
  if (!wikiCache) {
    try {
      wikiCache = require('./wiki-cache');
      wikiCache.initialize();
    } catch (e) {
      wikiCache = null;
    }
  }
  return wikiCache;
}

// UWP Descriptions
const STARPORT_CLASSES = {
  'A': 'excellent quality starport with refined fuel and full repair facilities',
  'B': 'good quality starport with refined fuel and repair facilities',
  'C': 'routine quality starport with unrefined fuel',
  'D': 'poor quality starport with unrefined fuel',
  'E': 'frontier installation with no fuel or facilities',
  'X': 'no starport'
};

const ATMOSPHERE_TYPES = {
  '0': 'no atmosphere',
  '1': 'trace atmosphere',
  '2': 'very thin, tainted atmosphere',
  '3': 'very thin atmosphere',
  '4': 'thin, tainted atmosphere requiring filter masks',
  '5': 'thin atmosphere',
  '6': 'standard atmosphere',
  '7': 'standard, tainted atmosphere',
  '8': 'dense atmosphere',
  '9': 'dense, tainted atmosphere',
  'A': 'exotic atmosphere requiring special equipment',
  'B': 'corrosive atmosphere',
  'C': 'insidious atmosphere',
  'D': 'very dense atmosphere',
  'E': 'low atmosphere (ellipsoid world)',
  'F': 'unusual atmosphere'
};

const SIZE_DESCRIPTIONS = {
  '0': 'asteroid or small body',
  '1': 'small world (~1,600 km)',
  '2': 'small world (~3,200 km)',
  '3': 'small world (~4,800 km)',
  '4': 'small world (~6,400 km)',
  '5': 'medium world (~8,000 km)',
  '6': 'medium world (~9,600 km)',
  '7': 'medium world (~11,200 km)',
  '8': 'large world (~12,800 km, Earth-sized)',
  '9': 'large world (~14,400 km)',
  'A': 'large world (~16,000 km)'
};

const POPULATION_ESTIMATES = {
  '0': 'unpopulated',
  '1': 'tens of inhabitants',
  '2': 'hundreds of inhabitants',
  '3': 'thousands of inhabitants',
  '4': 'tens of thousands',
  '5': 'hundreds of thousands',
  '6': 'millions',
  '7': 'tens of millions',
  '8': 'hundreds of millions',
  '9': 'billions',
  'A': 'tens of billions'
};

const TECH_LEVELS = {
  '0': 'primitive (stone age)',
  '1': 'primitive (bronze/iron age)',
  '2': 'primitive (renaissance)',
  '3': 'primitive (early industrial)',
  '4': 'industrial (mechanized)',
  '5': 'industrial (broadcast power)',
  '6': 'pre-stellar (nuclear age)',
  '7': 'pre-stellar (early space)',
  '8': 'pre-stellar (space age)',
  '9': 'early stellar (gravity manipulation)',
  'A': 'early stellar (jump drive)',
  'B': 'average stellar',
  'C': 'average stellar (advanced)',
  'D': 'high stellar',
  'E': 'high stellar (advanced)',
  'F': 'imperial maximum'
};

/**
 * Parse UWP string into components
 * @param {string} uwp - UWP string (e.g., "C544338-7")
 * @returns {Object|null} Parsed components or null if invalid
 */
function parseUWP(uwp) {
  if (!uwp || typeof uwp !== 'string') return null;

  const normalized = uwp.toUpperCase().trim();
  const match = normalized.match(/^([A-EX])([0-9A-F])([0-9A-F])([0-9A-F])([0-9A-F])([0-9A-F])([0-9A-F])-([0-9A-F])$/);

  if (!match) return null;

  return {
    starport: match[1],
    size: match[2],
    atmosphere: match[3],
    hydrographics: match[4],
    population: match[5],
    government: match[6],
    lawLevel: match[7],
    techLevel: match[8]
  };
}

/**
 * Generate human-readable description of UWP
 * @param {string} uwp - UWP string
 * @returns {string} Human-readable description
 */
function describeUWP(uwp) {
  const parsed = parseUWP(uwp);
  if (!parsed) return '';

  const parts = [];

  // Starport
  const starportDesc = STARPORT_CLASSES[parsed.starport];
  if (starportDesc) {
    parts.push(`Has ${starportDesc}`);
  }

  // Size
  const sizeDesc = SIZE_DESCRIPTIONS[parsed.size];
  if (sizeDesc) {
    parts.push(sizeDesc);
  }

  // Atmosphere
  const atmosDesc = ATMOSPHERE_TYPES[parsed.atmosphere];
  if (atmosDesc) {
    parts.push(`with ${atmosDesc}`);
  }

  // Population
  const popDesc = POPULATION_ESTIMATES[parsed.population];
  if (popDesc) {
    parts.push(`Population: ${popDesc}`);
  }

  // Tech Level
  const techDesc = TECH_LEVELS[parsed.techLevel];
  if (techDesc) {
    parts.push(`Tech level ${parsed.techLevel} (${techDesc})`);
  }

  return parts.join('. ') + '.';
}

/**
 * Extract first paragraph from text
 * @param {string} text - Input text
 * @param {number} [maxLength] - Maximum length before truncation
 * @returns {string} First paragraph
 */
function getFirstParagraph(text, maxLength = null) {
  if (!text || typeof text !== 'string') return '';

  // Split on double newline (paragraph break)
  const paragraphs = text.split(/\n\n+/);
  let first = (paragraphs[0] || '').trim();

  if (maxLength && first.length > maxLength) {
    first = first.substring(0, maxLength - 3).trim() + '...';
  }

  return first;
}

/**
 * Get world summary from wiki cache
 * @param {string} worldNameOrHex - World name or hex code
 * @returns {Object|null} { name, uwp, description } or null
 */
function getWorldSummary(worldNameOrHex) {
  if (!worldNameOrHex) return null;

  const cache = getWikiCache();
  if (!cache) return null;

  // Try lookup by hex first (if looks like a hex code)
  let entry = null;
  if (/^\d{4}$/.test(worldNameOrHex)) {
    entry = cache.getByHex(worldNameOrHex);
  }

  // Try by name/slug
  if (!entry) {
    entry = cache.getByName(worldNameOrHex);
  }
  if (!entry) {
    entry = cache.getBySlug(worldNameOrHex.toLowerCase());
  }

  if (!entry) return null;

  // Get text content
  const textContent = cache.getTextContent(entry.hex);
  const firstPara = textContent ? getFirstParagraph(textContent, 1500) : '';

  // Try to extract UWP from content or use placeholder
  // Look for pattern like "C544338-7" in text
  const uwpMatch = textContent?.match(/[A-EX][0-9A-F]{6}-[0-9A-F]/i);
  const uwp = uwpMatch ? uwpMatch[0].toUpperCase() : null;

  return {
    name: entry.name,
    hex: entry.hex,
    uwp: uwp,
    description: uwp ? describeUWP(uwp) : '',
    firstParagraph: firstPara
  };
}

module.exports = {
  parseUWP,
  describeUWP,
  getWorldSummary,
  getFirstParagraph
};
