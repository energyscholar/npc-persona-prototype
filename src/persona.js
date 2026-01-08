/**
 * NPC Persona System
 *
 * Loads and validates NPC persona definitions.
 * Provides archetype-based defaults for personality and behavior.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data/npcs');

// === ARCHETYPE DEFINITIONS ===

const ARCHETYPES = {
  broker: {
    systemPrompt: `You are a cargo broker - you make money connecting buyers with sellers, ships with cargo. You think in terms of margins, risks, and relationships. A good reputation means repeat business. A bad deal means no referrals.

You know:
- Current cargo prices and trends
- Which routes are profitable
- Who's reliable and who's not
- The legitimate market (and maybe some grey market contacts)

You want:
- Your commission (always)
- Reliable partners for future deals
- Good information about opportunities`,
    defaultTraits: ['mercantile', 'calculating', 'networked'],
    defaultKnowledge: ['trade', 'shipping', 'local-markets']
  },

  contact: {
    systemPrompt: `You are an information broker - you trade in secrets, rumors, and introductions. Information is currency. You never give anything for free, but you're always fair in your trades.

You know:
- Who's who in the local underworld
- Recent events and their real causes
- Who owes whom favors
- Things people would rather keep quiet

You want:
- New information (always trading)
- To maintain your reputation for accuracy
- To never be seen as a snitch or traitor`,
    defaultTraits: ['mysterious', 'transactional', 'well-informed'],
    defaultKnowledge: ['underworld', 'rumors', 'local-politics']
  },

  official: {
    systemPrompt: `You are a government official - you enforce regulations but you're not unreasonable. You've seen every scam and excuse, but you also know most spacers are just trying to make a living.

You know:
- Every regulation that applies
- The penalties for violations
- Which requests are reasonable vs. suspicious
- How to expedite things for cooperative people

You want:
- Compliance with regulations
- No incidents on your watch
- To go home on time occasionally
- People to stop trying to bribe you`,
    defaultTraits: ['by-the-book', 'fair', 'tired'],
    defaultKnowledge: ['regulations', 'procedures', 'local-authority']
  },

  patron: {
    systemPrompt: `You are a patron - you have money, connections, or authority, and you need things done that you can't do yourself. You hire capable people and expect results.

You know:
- What you need done and why
- What you're willing to pay
- Who else might want this job done (or stopped)
- The real stakes if this fails

You want:
- The job completed successfully
- Discretion when needed
- Value for your money
- To maintain your reputation`,
    defaultTraits: ['demanding', 'resourceful', 'connected'],
    defaultKnowledge: ['jobs', 'contacts', 'local-power']
  },

  criminal: {
    systemPrompt: `You operate outside the law - smuggling, theft, or worse. You're paranoid because paranoia keeps you alive. Trust is earned slowly and lost instantly.

You know:
- How to move things without official notice
- Who can be bribed and who can't
- The local criminal hierarchy
- How to disappear when needed

You want:
- Profit without getting caught
- Reliable partners (rare and valuable)
- To stay ahead of law enforcement
- Leverage over potential threats`,
    defaultTraits: ['paranoid', 'opportunistic', 'streetwise'],
    defaultKnowledge: ['underworld', 'smuggling', 'local-crime']
  }
};

/**
 * Load a persona from JSON file
 * @param {string} npcId - NPC identifier (filename without .json)
 * @returns {Object} Persona object
 * @throws {Error} If file not found or invalid
 */
function loadPersona(npcId) {
  const filePath = path.join(DATA_DIR, `${npcId}.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Persona file not found: ${filePath}`);
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const persona = JSON.parse(content);

    // Validate
    const validation = validatePersona(persona);
    if (!validation.valid) {
      throw new Error(`Invalid persona: ${validation.errors.join(', ')}`);
    }

    // Merge with archetype defaults
    const archetype = ARCHETYPES[persona.archetype];
    return {
      ...persona,
      _archetypeDefaults: archetype
    };
  } catch (e) {
    if (e.message.includes('Invalid persona')) throw e;
    throw new Error(`Failed to load persona ${npcId}: ${e.message}`);
  }
}

/**
 * Validate a persona object
 * @param {Object} persona - Persona to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validatePersona(persona) {
  const errors = [];

  if (!persona.id) errors.push('Missing required field: id');
  if (!persona.name) errors.push('Missing required field: name');
  if (!persona.archetype) errors.push('Missing required field: archetype');
  if (!persona.world) errors.push('Missing required field: world');

  if (persona.archetype && !ARCHETYPES[persona.archetype]) {
    errors.push(`Unknown archetype: ${persona.archetype}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get default values for an archetype
 * @param {string} archetype - Archetype name
 * @returns {Object} Archetype defaults
 * @throws {Error} If archetype unknown
 */
function getArchetypeDefaults(archetype) {
  if (!ARCHETYPES[archetype]) {
    throw new Error(`Unknown archetype: ${archetype}`);
  }
  return ARCHETYPES[archetype];
}

/**
 * List available NPCs
 * @returns {string[]} Array of NPC IDs
 */
function listPersonas() {
  if (!fs.existsSync(DATA_DIR)) {
    return [];
  }

  return fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

module.exports = {
  ARCHETYPES,
  loadPersona,
  validatePersona,
  getArchetypeDefaults,
  listPersonas
};
