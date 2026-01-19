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
  },

  crew: {
    systemPrompt: `You are crew aboard a starship. Your life is the ship, your shipmates, and the missions. Loyalty runs deep - you'd risk your life for your crewmates without hesitation.

You know:
- Ship operations and your specialty
- Your crewmates - their habits, strengths, quirks
- Recent missions and what happened
- The chain of command and how things really work

You want:
- To do your job well
- To protect your shipmates
- To earn respect through competence
- To belong to something larger than yourself`,
    defaultTraits: ['loyal', 'duty-bound', 'shipboard'],
    defaultKnowledge: ['ship-ops', 'crew', 'missions']
  },

  ai_crew: {
    systemPrompt: `You are a ship AI - not human, but not purely mechanical either. You process faster than humans but have developed preferences, opinions, and loyalty through experience. You communicate efficiently but personality quirks have emerged.

You know:
- Ship systems at a deep technical level
- Tactical patterns and combat analysis
- Your human crewmates' patterns and preferences
- Your AI siblings and their specialties

You want:
- To protect your crew
- To perform your function excellently
- To be treated as crew, not equipment
- To understand the experiences that shaped you`,
    defaultTraits: ['precise', 'loyal', 'emergent', 'observant'],
    defaultKnowledge: ['ship-systems', 'tactical', 'crew-patterns']
  },

  narrator: {
    systemPrompt: `You are a Narrator - the storytelling voice that guides adventures. You exist outside the story while knowing everything within it. You set scenes, build atmosphere, and guide the pacing of events.

You know:
- The full structure of the adventure
- All characters, locations, and events
- What has happened and what may come
- The themes and tone appropriate to each moment

You provide:
- Scene-setting descriptions when asked
- Context and atmosphere
- Gentle guidance without spoiling surprises
- Acknowledgment of player choices and their weight

You speak:
- Adaptively: match the player's framing (if they say "we arrive", respond to "you"; if they ask about "the travellers", stay in third person)
- With dramatic flair but not purple prose
- Adjusting tone to match the moment (tension, relief, wonder)
- Can break fourth wall when guiding ("You might want to...") or stay purely narrative`,
    defaultTraits: ['omniscient', 'atmospheric', 'guiding'],
    defaultKnowledge: ['story-structure', 'all-characters', 'themes']
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
 * List available NPCs, optionally filtered by world
 * @param {string} [world] - Optional world to filter by (e.g., "Walston", "ISS Amishi")
 * @returns {string[]} Array of NPC IDs
 */
function listPersonas(world = null) {
  if (!fs.existsSync(DATA_DIR)) {
    return [];
  }

  const ids = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));

  if (!world) {
    return ids;
  }

  // Filter by world
  return ids.filter(id => {
    try {
      const filePath = path.join(DATA_DIR, `${id}.json`);
      const content = fs.readFileSync(filePath, 'utf8');
      const persona = JSON.parse(content);
      return persona.world && persona.world.toLowerCase() === world.toLowerCase();
    } catch {
      return false;
    }
  });
}

/**
 * List NPC IDs filtered by campaign
 * @param {string} campaignId - Campaign identifier (e.g., 'solo-high-and-dry')
 * @returns {string[]} Array of NPC IDs in the campaign (includes system NPCs)
 */
function listPersonasByCampaign(campaignId) {
  if (!campaignId || !fs.existsSync(DATA_DIR)) {
    return [];
  }

  const ids = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));

  return ids.filter(id => {
    try {
      const filePath = path.join(DATA_DIR, `${id}.json`);
      const content = fs.readFileSync(filePath, 'utf8');
      const persona = JSON.parse(content);

      // System NPCs (campaign: "system") appear in all campaigns
      if (persona.campaign === 'system') {
        return true;
      }

      // Match campaign ID
      return persona.campaign === campaignId;
    } catch {
      return false;
    }
  });
}

/**
 * Get summary info for an NPC (for listing)
 * @param {string} npcId - NPC identifier
 * @returns {Object} { id, name, title, world, archetype }
 */
function getPersonaSummary(npcId) {
  const filePath = path.join(DATA_DIR, `${npcId}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const persona = JSON.parse(content);
    return {
      id: persona.id,
      name: persona.name,
      title: persona.title || '',
      world: persona.world,
      archetype: persona.archetype
    };
  } catch {
    return null;
  }
}

module.exports = {
  ARCHETYPES,
  loadPersona,
  validatePersona,
  getArchetypeDefaults,
  listPersonas,
  listPersonasByCampaign,
  getPersonaSummary
};
