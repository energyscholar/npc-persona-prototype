/**
 * Skill Check Module
 * Abstraction for skill checks - mock implementation for prototype.
 *
 * Pattern: Strategy - swap mock for VTT integration later
 */

/**
 * Roll 2d6
 * @returns {number} Sum of two d6 rolls (2-12)
 */
function roll2d6() {
  return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
}

/**
 * Perform a skill check
 * @param {string} skill - Skill name (for logging/future use)
 * @param {number} threshold - Target number to meet or exceed
 * @param {Object} options - Optional modifiers
 * @param {number} options.modifier - Bonus/penalty to roll
 * @returns {Object} { success, roll, total, threshold, margin }
 */
function performCheck(skill, threshold, options = {}) {
  const modifier = options.modifier || 0;
  const roll = roll2d6();
  const total = roll + modifier;

  return {
    success: total >= threshold,
    roll,
    total,
    threshold,
    margin: total - threshold
  };
}

/**
 * Check if PC has skill at minimum level
 * @param {Object} pc - PC data object
 * @param {string} skill - Skill name to check
 * @param {number} minLevel - Minimum level required
 * @returns {boolean} True if PC has skill at or above minLevel
 */
function hasSkillLevel(pc, skill, minLevel) {
  if (!pc || !pc.skills_notable) return false;

  // skills_notable format: ["Pilot-2", "Gunner-1", "Vacc Suit-0"]
  const skillEntry = pc.skills_notable.find(s =>
    s.toLowerCase().startsWith(skill.toLowerCase())
  );

  if (!skillEntry) return false;

  const match = skillEntry.match(/-(\d+)/);
  if (!match) return false;

  return parseInt(match[1], 10) >= minLevel;
}

module.exports = {
  roll2d6,
  performCheck,
  hasSkillLevel
};
