/**
 * Test PC Fixtures for High and Dry Integration Tests
 * Pre-built PC definitions for testing various scenarios.
 */

const TEST_PCS = {
  alex_ryder: {
    id: 'alex-ryder',
    name: 'Alex Ryder',
    species: 'Human',
    homeworld: 'Flammarion',
    background: 'Former scout service, mustered out after one term. Inherited documentation for a Type S Scout/Courier.',
    traits: ['resourceful', 'curious', 'independent', 'sometimes reckless'],
    skills_notable: ['Pilot-1', 'Astrogation-1', 'Vacc Suit-1', 'Survival-1', 'Gun Combat-0'],
    social_standing: 6,
    motivations: [
      'Claim the Highndry and start a new life',
      'Prove they can make it on their own',
      'Find out what happened to the previous crew'
    ],
    equipment: {
      scout_service_kit: {
        description: 'Equipment from Scout Service for Highndry repair mission',
        items: [
          '3 flight cases of circuit panels + tools',
          '1 portable diagnostic/software download unit',
          '1 container of general spares'
        ]
      },
      expenses_credit: {
        amount: 'Cr1000',
        source: 'Scout Service upfront payment'
      }
    }
  },

  captain_drake: {
    id: 'captain-drake',
    name: 'Captain Elara Drake',
    species: 'Human',
    homeworld: 'Regina',
    background: 'Veteran merchant captain with twenty years in the trade. Experienced, pragmatic, knows her way around Traveller society.',
    traits: ['experienced', 'pragmatic', 'commanding', 'fair'],
    skills_notable: ['Pilot-2', 'Broker-2', 'Admin-1', 'Leadership-1', 'Persuade-1'],
    social_standing: 8,
    motivations: [
      'Acquire the Highndry to expand her fleet',
      'Maintain her reputation for fair dealing',
      'Avoid unnecessary risk'
    ]
  },

  vargr_trader: {
    id: 'vargr-trader',
    name: 'Gvurrdon',
    species: 'Vargr',
    homeworld: 'Lair',
    background: 'Merchant trader seeking new routes and opportunities in human space. Constantly navigating prejudice while maintaining charisma and business acumen.',
    traits: ['charismatic', 'adaptable', 'perceptive', 'proud'],
    skills_notable: ['Broker-2', 'Persuade-1', 'Streetwise-1', 'Carouse-1'],
    social_standing: 7,
    motivations: [
      'Establish profitable trade network',
      'Prove worth to human partners',
      'Find a place where species matters less'
    ]
  },

  rookie_scout: {
    id: 'rookie-scout',
    name: 'Jamie Chen',
    species: 'Human',
    homeworld: 'Terra',
    background: 'Fresh out of scout service basic training. Eager but inexperienced. This is their first real assignment.',
    traits: ['eager', 'naive', 'enthusiastic', 'by-the-book'],
    skills_notable: ['Pilot-0', 'Astrogation-0', 'Survival-0', 'Vacc Suit-0'],
    social_standing: 5,
    motivations: [
      'Prove themselves worthy of the scout service',
      'Learn the ropes from experienced travellers',
      'Not mess up their first real mission'
    ]
  },

  // PC with high Carouse for bartender interactions
  social_specialist: {
    id: 'social-specialist',
    name: 'Max Sterling',
    species: 'Human',
    homeworld: 'Mora',
    background: 'Former entertainer turned traveller. Can talk their way into or out of almost anything.',
    traits: ['charming', 'glib', 'observant', 'superficial'],
    skills_notable: ['Carouse-2', 'Persuade-2', 'Streetwise-1', 'Deception-1'],
    social_standing: 7,
    motivations: [
      'Find the next big opportunity',
      'Make friends everywhere',
      'Avoid hard work when charm will do'
    ]
  }
};

/**
 * Get a test PC by ID
 * @param {string} pcId - PC identifier (snake_case key or actual id)
 * @returns {Object} PC data
 */
function getTestPc(pcId) {
  // Try direct key match first
  if (TEST_PCS[pcId]) {
    return JSON.parse(JSON.stringify(TEST_PCS[pcId]));
  }

  // Try matching by id field
  for (const pc of Object.values(TEST_PCS)) {
    if (pc.id === pcId) {
      return JSON.parse(JSON.stringify(pc));
    }
  }

  throw new Error(`Unknown test PC: ${pcId}`);
}

/**
 * Check if PC is Vargr species
 * @param {Object} pc - PC data
 * @returns {boolean}
 */
function isVargr(pc) {
  return pc && pc.species && pc.species.toLowerCase() === 'vargr';
}

/**
 * Get PC skill level
 * @param {Object} pc - PC data
 * @param {string} skillName - Skill to check
 * @returns {number} Skill level or -1 if not trained
 */
function getSkillLevel(pc, skillName) {
  if (!pc || !pc.skills_notable) return -1;

  const entry = pc.skills_notable.find(s =>
    s.toLowerCase().startsWith(skillName.toLowerCase())
  );

  if (!entry) return -1;

  const match = entry.match(/-(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

module.exports = {
  TEST_PCS,
  getTestPc,
  isVargr,
  getSkillLevel
};
