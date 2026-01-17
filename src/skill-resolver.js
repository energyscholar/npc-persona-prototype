/**
 * Skill Resolver - Dice rolling and modifier calculation for Traveller RPG
 *
 * Pattern: Stateless utility module
 * Uses 2D6 + skill + attribute modifier vs difficulty
 */

/**
 * Roll N dice of D sides
 * @param {number} n - Number of dice
 * @param {number} d - Sides per die
 * @returns {number} Sum of dice
 */
function rollDice(n, d) {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += Math.floor(Math.random() * d) + 1;
  }
  return sum;
}

/**
 * Skill to attribute mapping (Traveller conventions)
 */
const SKILL_ATTRIBUTES = {
  athletics: 'dex',
  pilot: 'dex',
  gunner: 'dex',
  drive: 'dex',
  flyer: 'dex',
  vacc_suit: 'dex',
  stealth: 'dex',
  persuade: 'soc',
  diplomat: 'soc',
  leadership: 'soc',
  carouse: 'soc',
  streetwise: 'int',
  electronics: 'edu',
  engineer: 'edu',
  medic: 'edu',
  science: 'edu',
  astrogation: 'edu',
  survival: 'end',
  recon: 'int',
  investigate: 'int',
  tactics: 'int',
  admin: 'edu',
  advocate: 'edu',
  broker: 'int',
  mechanic: 'edu',
  animals: 'int'
};

/**
 * Get skill modifier from PC skills array
 * @param {Object} pc - PC data with skills array
 * @param {string} skillName - Skill name
 * @returns {number} Skill level (0 if untrained)
 */
function getSkillModifier(pc, skillName) {
  if (!pc || !pc.skills) return 0;

  const normalized = skillName.toLowerCase().replace(/[_\s]/g, '');
  const skill = pc.skills.find(s => {
    const sNorm = s.name.toLowerCase().replace(/[_\s]/g, '');
    return sNorm === normalized || sNorm.includes(normalized) || normalized.includes(sNorm);
  });

  return skill?.level || 0;
}

/**
 * Get attribute modifier for a skill check
 * Traveller formula: (attribute - 7) / 3, rounded down
 * @param {Object} pc - PC data with characteristics
 * @param {string} skillName - Skill name to determine attribute
 * @returns {number} Attribute modifier
 */
function getAttributeModifier(pc, skillName) {
  if (!pc || !pc.characteristics) return 0;

  const normalized = skillName.toLowerCase().replace(/[_\s]/g, '');
  const attr = SKILL_ATTRIBUTES[normalized] || 'int';

  const value = pc.characteristics[attr] || 7;
  return Math.floor((value - 7) / 3);
}

/**
 * Format a check result for display
 * @param {Object} check - Check parameters
 * @param {number} total - Total rolled
 * @param {boolean} success - Whether check succeeded
 * @returns {string} Formatted result string
 */
function formatCheckResult(check, total, success) {
  const outcome = success ? 'Success' : 'Failure';
  return `[${check.skill} check: ${total} vs ${check.difficulty}+ = ${outcome}]`;
}

/**
 * Resolve a skill check
 * @param {Object} check - { skill, difficulty, reason }
 * @param {Object} pc - PC data
 * @param {number} [forcedRoll] - Optional forced roll for testing
 * @returns {Object} Check result with all details
 */
function resolveCheck(check, pc, forcedRoll = null) {
  const roll = forcedRoll !== null ? forcedRoll : rollDice(2, 6);
  const skillMod = getSkillModifier(pc, check.skill);
  const attrMod = getAttributeModifier(pc, check.skill);
  const total = roll + skillMod + attrMod;

  const success = total >= check.difficulty;
  const exceptional = total >= check.difficulty + 6;
  const fumble = roll === 2;

  return {
    roll,
    skillMod,
    attrMod,
    total,
    difficulty: check.difficulty,
    success,
    exceptional,
    fumble,
    margin: total - check.difficulty,
    narrative: formatCheckResult(check, total, success),
    check
  };
}

/**
 * Format a detailed check result for TUI display
 * @param {Object} result - Result from resolveCheck
 * @returns {string} Multi-line formatted result
 */
function formatDetailedResult(result) {
  const parts = [];
  parts.push(`Rolling 2D6 + ${result.check.skill} (${result.skillMod}) + modifier (${result.attrMod})...`);
  parts.push(`Result: ${result.roll} + ${result.skillMod + result.attrMod} = ${result.total} vs difficulty ${result.difficulty}+`);

  if (result.fumble) {
    parts.push('FUMBLE! Critical failure.');
  } else if (result.exceptional) {
    parts.push('Exceptional success!');
  } else if (result.success) {
    parts.push(`Success by ${result.margin}.`);
  } else {
    parts.push(`Failed by ${-result.margin}.`);
  }

  return parts.join('\n');
}

module.exports = {
  rollDice,
  getSkillModifier,
  getAttributeModifier,
  resolveCheck,
  formatCheckResult,
  formatDetailedResult,
  SKILL_ATTRIBUTES
};
