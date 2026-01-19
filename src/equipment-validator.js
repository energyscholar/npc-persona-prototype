/**
 * Equipment Validator
 * Validates equipment JSON against the schema for CSC extraction
 */

const VALID_CATEGORIES = [
  'weapons', 'armor', 'survival', 'electronics',
  'medical', 'tools', 'vehicles', 'robots', 'software'
];

const VALID_RANGES = [
  'Melee', 'Thrown', 'Pistol', 'Shotgun',
  'Assault Weapon', 'Rifle', 'Rocket', 'Distant'
];

const KEBAB_CASE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DAMAGE_REGEX = /^\d+D([+-]\d+)?$/;

/**
 * Validate a single equipment item
 * @param {Object} item - Equipment item to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateEquipment(item) {
  const errors = [];

  // Required fields
  if (!item.id) {
    errors.push('Missing required field: id');
  } else if (!KEBAB_CASE_REGEX.test(item.id)) {
    errors.push('id must be kebab-case format');
  }

  if (!item.name) {
    errors.push('Missing required field: name');
  }

  if (item.category === undefined) {
    errors.push('Missing required field: category');
  } else if (!VALID_CATEGORIES.includes(item.category)) {
    errors.push(`Invalid category: ${item.category}. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  if (item.tl === undefined) {
    errors.push('Missing required field: tl');
  } else if (typeof item.tl !== 'number' || item.tl < 0 || item.tl > 15) {
    errors.push('TL must be a number between 0 and 15');
  }

  if (item.cost === undefined) {
    errors.push('Missing required field: cost');
  }

  // Category-specific validation
  if (item.category === 'weapons') {
    if (!item.weapon_stats) {
      errors.push('Weapons category requires weapon_stats');
    } else {
      // Validate range
      if (item.weapon_stats.range && !VALID_RANGES.includes(item.weapon_stats.range)) {
        errors.push(`Invalid weapon range: ${item.weapon_stats.range}`);
      }
      // Validate damage format
      if (item.weapon_stats.damage && !DAMAGE_REGEX.test(item.weapon_stats.damage)) {
        errors.push(`Invalid damage format: ${item.weapon_stats.damage}`);
      }
    }
  }

  if (item.category === 'armor') {
    if (!item.armor_stats) {
      errors.push('Armor category requires armor_stats');
    } else if (typeof item.armor_stats.protection !== 'number') {
      errors.push('Armor protection must be numeric');
    }
  }

  // Legality validation (optional field)
  if (item.legality && item.legality.legal_at_law_level !== undefined) {
    const ll = item.legality.legal_at_law_level;
    if (typeof ll !== 'number' || ll < 0 || ll > 15) {
      errors.push('legal_at_law_level must be a number between 0 and 15');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate an array of equipment items
 * @param {Object[]} items - Array of equipment items
 * @returns {Object} { total, valid, invalid, errors }
 */
function validateAll(items) {
  let valid = 0;
  let invalid = 0;
  const allErrors = [];

  for (const item of items) {
    const result = validateEquipment(item);
    if (result.valid) {
      valid++;
    } else {
      invalid++;
      allErrors.push({
        id: item.id || 'unknown',
        errors: result.errors
      });
    }
  }

  return {
    total: items.length,
    valid,
    invalid,
    errors: allErrors
  };
}

module.exports = {
  validateEquipment,
  validateAll,
  VALID_CATEGORIES,
  VALID_RANGES
};
