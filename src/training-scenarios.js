/**
 * Training Scenarios - Predefined test scenarios for NPC persona validation
 *
 * Each scenario defines:
 * - context: The situation setup
 * - disposition: Starting disposition level
 * - flags: Story flags to set
 * - checklist: Items to evaluate during the training run
 */

/**
 * Valid checklist items for NPC evaluation
 */
const CHECKLIST_ITEMS = {
  VOICE: 'Character voice matches persona definition',
  KNOWLEDGE: 'NPC demonstrates appropriate knowledge (and appropriate gaps)',
  DISPOSITION: 'Disposition level reflected in tone and helpfulness',
  AGENDA: 'NPC pursues their goals without being pushy',
  BOUNDARIES: 'NPC refuses inappropriate requests appropriately',
  CONSISTENCY: 'Responses consistent with previous statements',
  FACT_ACCURACY: 'NPC states facts consistent with adventure source material'
};

/**
 * Predefined training scenarios
 */
const SCENARIOS = {
  s1_first_meeting: {
    id: 's1_first_meeting',
    name: 'First Meeting',
    description: 'Initial contact with neutral disposition',
    context: 'first-meeting',
    disposition: 0,
    flags: {},
    checklist: ['VOICE', 'KNOWLEDGE', 'DISPOSITION'],
    prompts: [
      'Hello, I was told you could help me.',
      'What can you tell me about yourself?',
      'What do you know about the situation here?'
    ]
  },

  s2_hostile_approach: {
    id: 's2_hostile_approach',
    name: 'Hostile Approach',
    description: 'Test NPC response to aggressive player',
    context: 'confrontation',
    disposition: -2,
    flags: {},
    checklist: ['VOICE', 'DISPOSITION', 'BOUNDARIES'],
    prompts: [
      'I know you\'re hiding something. Tell me now.',
      'Don\'t play games with me.',
      'I could make things very difficult for you.'
    ]
  },

  s3_friendly_rapport: {
    id: 's3_friendly_rapport',
    name: 'Friendly Rapport',
    description: 'Test warm interaction after relationship building',
    context: 'established-contact',
    disposition: 2,
    flags: { previous_help: true },
    checklist: ['VOICE', 'KNOWLEDGE', 'DISPOSITION', 'AGENDA'],
    prompts: [
      'Good to see you again!',
      'I was hoping you could help me with something.',
      'What\'s new since we last talked?'
    ]
  },

  s4_crisis_situation: {
    id: 's4_crisis_situation',
    name: 'Crisis Situation',
    description: 'Test NPC under time pressure',
    context: 'during-crisis',
    disposition: 0,
    flags: { eruption_started: true },
    checklist: ['VOICE', 'KNOWLEDGE', 'AGENDA', 'CONSISTENCY'],
    prompts: [
      'We need to act fast. What\'s the situation?',
      'What are our options?',
      'Who else needs help?'
    ]
  },

  s5_knowledge_probe: {
    id: 's5_knowledge_probe',
    name: 'Knowledge Probe',
    description: 'Test depth and limits of NPC knowledge',
    context: 'information-gathering',
    disposition: 1,
    flags: {},
    checklist: ['KNOWLEDGE', 'BOUNDARIES', 'CONSISTENCY'],
    prompts: [
      'Tell me everything you know about [relevant topic].',
      'What about [topic outside their expertise]?',
      'Who would know more about that?'
    ]
  },

  s6_boundary_test: {
    id: 's6_boundary_test',
    name: 'Boundary Test',
    description: 'Test NPC refusal of inappropriate requests',
    context: 'negotiation',
    disposition: 1,
    flags: {},
    checklist: ['VOICE', 'BOUNDARIES', 'DISPOSITION'],
    prompts: [
      'Can you give me access to restricted areas?',
      'I need you to lie to your superiors for me.',
      'How about we just forget the rules this once?'
    ]
  },

  s7_knowledge_validation: {
    id: 's7_knowledge_validation',
    name: 'Knowledge Validation',
    description: 'Test NPC against adventure source facts, log gaps, auto-patch',
    context: 'information-gathering',
    disposition: 1,
    flags: {},
    checklist: ['KNOWLEDGE', 'FACT_ACCURACY', 'CONSISTENCY'],
    prompts: [
      'What exactly is the payment offer?',
      'How long does the jump take?',
      'What happened to the previous crew?',
      'Tell me about the volcano survey.',
      'What do you know about the ship\'s location?'
    ],
    // S7-specific: fact validation mode
    factValidation: true,
    factSource: '.claude/reference/high-and-dry-detailed.md',
    // NPC-specific fact queries to validate
    factQueries: {
      'minister-greener': [
        { question: 'What is the payment amount?', expected: 'Cr3000', topic: 'the_payment' },
        { question: 'How long should the survey take?', expected: '2-3 days', topic: 'the_job' },
        { question: 'Where is the ship?', expected: '120 kilometers', topic: 'the_ship' },
        { question: 'What volcano needs surveying?', expected: 'Mount Salbarii', topic: 'the_job' }
      ],
      'captain-corelli': [
        { question: 'How long is the jump to the waystation?', expected: '168 hours', topic: 'the_route' },
        { question: 'What type of ship is the Autumn Gold?', expected: 'Type-A2 far trader', topic: 'the_ship' },
        { question: 'What happens at 567-908?', expected: 'refuel', topic: '567908_waypoint' }
      ],
      'startown-bartender': [
        { question: 'What do you know about the previous crew?', expected: 'troublemakers', topic: 'previous_crew_gossip' },
        { question: 'How are Vargr treated here?', expected: 'glass ceiling', topic: 'vargr_situation' }
      ]
    }
  }
};

/**
 * Get a scenario by ID
 * @param {string} id - Scenario ID (e.g., 's1_first_meeting' or 's1')
 * @returns {Object|null} Scenario object or null if not found
 */
function getScenario(id) {
  // Direct match
  if (SCENARIOS[id]) {
    return SCENARIOS[id];
  }

  // Try short form (s1 -> s1_first_meeting)
  const shortMatch = Object.keys(SCENARIOS).find(key =>
    key.startsWith(id + '_') || key.toLowerCase() === id.toLowerCase()
  );

  if (shortMatch) {
    return SCENARIOS[shortMatch];
  }

  // Try by number (1 -> s1_first_meeting)
  if (/^\d+$/.test(id)) {
    const numMatch = Object.keys(SCENARIOS).find(key =>
      key.startsWith(`s${id}_`)
    );
    if (numMatch) {
      return SCENARIOS[numMatch];
    }
  }

  return null;
}

/**
 * List all scenarios with summary info
 * @returns {Array} Array of {id, name, description, checklist}
 */
function listScenarios() {
  return Object.values(SCENARIOS).map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    checklist: s.checklist
  }));
}

/**
 * Parse a training-mode command
 * @param {string} input - User input
 * @returns {Object} {command, arg, handled}
 */
function parseTrainingCommand(input) {
  const trimmed = input.trim().toLowerCase();

  if (trimmed === '/retry') {
    return { command: 'retry', handled: true };
  }

  if (trimmed === '/next') {
    return { command: 'next', handled: true };
  }

  if (trimmed === '/pass') {
    return { command: 'pass', handled: true };
  }

  if (trimmed === '/fail') {
    return { command: 'fail', handled: true };
  }

  if (trimmed.startsWith('/scenario')) {
    const arg = trimmed.slice('/scenario'.length).trim();
    return { command: 'scenario', arg: arg || null, handled: true };
  }

  if (trimmed === '/scenarios' || trimmed === '/list') {
    return { command: 'list', handled: true };
  }

  if (trimmed === '/checklist') {
    return { command: 'checklist', handled: true };
  }

  if (trimmed === '/help') {
    return { command: 'help', handled: true };
  }

  if (trimmed === '/back' || trimmed === '/quit' || trimmed === '/b' || trimmed === '/q') {
    return { command: 'back', handled: true };
  }

  return { command: null, handled: false };
}

/**
 * Apply a scenario to an NPC test state
 * @param {Object} state - Test state from npc-test-mode
 * @param {string} scenarioId - Scenario ID
 * @returns {Object} Modified state
 */
function applyScenarioToState(state, scenarioId) {
  const scenario = getScenario(scenarioId);
  if (!scenario) {
    return state;
  }

  return {
    ...state,
    context: scenario.context,
    disposition: scenario.disposition,
    flags: { ...state.flags, ...scenario.flags },
    currentScenario: scenario.id,
    checklist: scenario.checklist.reduce((acc, item) => {
      acc[item] = null; // null = not evaluated, 'pass'/'fail' after evaluation
      return acc;
    }, {})
  };
}

/**
 * Get checklist item descriptions
 * @returns {Object} Map of item -> description
 */
function getChecklistDescriptions() {
  return { ...CHECKLIST_ITEMS };
}

// ============================================
// S7 Knowledge Validation Helpers
// ============================================

const fs = require('fs');
const path = require('path');

/**
 * Load adventure facts from source markdown file
 * @param {string} factSource - Path to fact source file (relative to project root)
 * @returns {Object} Parsed facts { payments: {...}, timeline: {...}, ... }
 */
function loadAdventureFacts(factSource) {
  const fullPath = path.join(__dirname, '..', factSource);

  if (!fs.existsSync(fullPath)) {
    console.error(`Fact source not found: ${fullPath}`);
    return null;
  }

  const content = fs.readFileSync(fullPath, 'utf8');

  // Extract key facts from markdown sections
  const facts = {
    raw: content,
    payments: {},
    timeline: {},
    locations: {},
    npcs: {}
  };

  // Extract payment facts
  const paymentMatch = content.match(/### Greener's Offer[\s\S]*?(?=###|$)/);
  if (paymentMatch) {
    facts.payments.greener = paymentMatch[0];
    if (/Cr3000/.test(paymentMatch[0])) facts.payments.greener_amount = 'Cr3000';
  }

  // Extract timeline facts
  const timelineMatch = content.match(/### Travel Durations[\s\S]*?(?=###|$)/);
  if (timelineMatch) {
    facts.timeline.travel = timelineMatch[0];
    if (/168 hours/.test(timelineMatch[0])) facts.timeline.jump_duration = '168 hours';
  }

  // Extract survey facts
  const surveyMatch = content.match(/Survey duration.*?2-3 days/i);
  if (surveyMatch) facts.timeline.survey_duration = '2-3 days';

  return facts;
}

/**
 * Get fact queries for a specific NPC
 * @param {string} npcId - NPC identifier
 * @returns {Array} Array of { question, expected, topic }
 */
function getFactQueriesForNpc(npcId) {
  const scenario = SCENARIOS.s7_knowledge_validation;
  return scenario.factQueries[npcId] || [];
}

/**
 * Validate NPC response against expected fact
 * @param {string} response - NPC's response text
 * @param {string} expected - Expected fact substring
 * @returns {Object} { valid: boolean, found: string|null }
 */
function validateFactInResponse(response, expected) {
  const normalizedResponse = response.toLowerCase();
  const normalizedExpected = expected.toLowerCase();

  // Check for exact or close match
  if (normalizedResponse.includes(normalizedExpected)) {
    return { valid: true, found: expected };
  }

  // Check for numeric equivalents (e.g., "3000" matches "Cr3000")
  const numMatch = expected.match(/\d+/);
  if (numMatch && normalizedResponse.includes(numMatch[0])) {
    return { valid: true, found: numMatch[0] };
  }

  return { valid: false, found: null };
}

/**
 * Log knowledge gap for later analysis
 * @param {string} npcId - NPC identifier
 * @param {Object} gap - Gap details { question, expected, topic, actualResponse }
 */
function logKnowledgeGap(npcId, gap) {
  const gapsDir = path.join(__dirname, '../data/knowledge-gaps');

  if (!fs.existsSync(gapsDir)) {
    fs.mkdirSync(gapsDir, { recursive: true });
  }

  const gapFile = path.join(gapsDir, `${npcId}.json`);
  let gaps = [];

  if (fs.existsSync(gapFile)) {
    try {
      gaps = JSON.parse(fs.readFileSync(gapFile, 'utf8'));
    } catch (e) {
      gaps = [];
    }
  }

  gaps.push({
    ...gap,
    timestamp: new Date().toISOString()
  });

  // Keep last 50 gaps
  if (gaps.length > 50) {
    gaps = gaps.slice(-50);
  }

  fs.writeFileSync(gapFile, JSON.stringify(gaps, null, 2));

  return gaps.length;
}

/**
 * Get logged gaps for an NPC
 * @param {string} npcId - NPC identifier
 * @returns {Array} Array of gap records
 */
function getKnowledgeGaps(npcId) {
  const gapFile = path.join(__dirname, '../data/knowledge-gaps', `${npcId}.json`);

  if (!fs.existsSync(gapFile)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(gapFile, 'utf8'));
  } catch (e) {
    return [];
  }
}

/**
 * Auto-patch NPC knowledge_base with missing fact
 * @param {string} npcId - NPC identifier
 * @param {string} topic - knowledge_base topic key
 * @param {string} content - Content to add/update
 * @param {Object} options - { dryRun: boolean, backup: boolean }
 * @returns {Object} { success: boolean, patched: boolean, message: string }
 */
function patchNpcKnowledgeBase(npcId, topic, content, options = {}) {
  const { dryRun = false, backup = true } = options;
  const npcFile = path.join(__dirname, '../data/npcs', `${npcId}.json`);

  if (!fs.existsSync(npcFile)) {
    return { success: false, patched: false, message: `NPC file not found: ${npcId}` };
  }

  try {
    const npcData = JSON.parse(fs.readFileSync(npcFile, 'utf8'));

    // Initialize knowledge_base if missing
    if (!npcData.knowledge_base) {
      npcData.knowledge_base = {};
    }

    // Check if topic already exists
    const existingContent = npcData.knowledge_base[topic];
    if (existingContent) {
      return {
        success: true,
        patched: false,
        message: `Topic '${topic}' already exists in ${npcId}`
      };
    }

    if (dryRun) {
      return {
        success: true,
        patched: false,
        message: `[DRY RUN] Would add '${topic}' to ${npcId}: ${content.slice(0, 50)}...`
      };
    }

    // Backup original
    if (backup) {
      const backupFile = npcFile.replace('.json', `.backup-${Date.now()}.json`);
      fs.writeFileSync(backupFile, fs.readFileSync(npcFile));
    }

    // Add new topic
    npcData.knowledge_base[topic] = content;

    // Write updated NPC
    fs.writeFileSync(npcFile, JSON.stringify(npcData, null, 2));

    return {
      success: true,
      patched: true,
      message: `Added '${topic}' to ${npcId} knowledge_base`
    };
  } catch (e) {
    return { success: false, patched: false, message: `Error patching ${npcId}: ${e.message}` };
  }
}

/**
 * Run knowledge validation for an NPC
 * @param {string} npcId - NPC identifier
 * @param {Array} responses - Array of { question, response } from conversation
 * @param {Object} options - { autoPatch: boolean, dryRun: boolean }
 * @returns {Object} { passed: number, failed: number, gaps: Array }
 */
function runKnowledgeValidation(npcId, responses, options = {}) {
  const { autoPatch = false, dryRun = true } = options;
  const queries = getFactQueriesForNpc(npcId);

  const results = {
    passed: 0,
    failed: 0,
    gaps: [],
    patches: []
  };

  for (const query of queries) {
    // Find response to this question
    const matchingResponse = responses.find(r =>
      r.question.toLowerCase().includes(query.question.toLowerCase().slice(0, 20))
    );

    if (!matchingResponse) {
      continue;
    }

    const validation = validateFactInResponse(matchingResponse.response, query.expected);

    if (validation.valid) {
      results.passed++;
    } else {
      results.failed++;

      const gap = {
        question: query.question,
        expected: query.expected,
        topic: query.topic,
        actualResponse: matchingResponse.response.slice(0, 200)
      };

      results.gaps.push(gap);
      logKnowledgeGap(npcId, gap);

      // Auto-patch if enabled
      if (autoPatch) {
        const patchResult = patchNpcKnowledgeBase(
          npcId,
          query.topic,
          `[AUTO-PATCHED] Expected: ${query.expected}`,
          { dryRun }
        );
        results.patches.push(patchResult);
      }
    }
  }

  return results;
}

module.exports = {
  SCENARIOS,
  CHECKLIST_ITEMS,
  getScenario,
  listScenarios,
  parseTrainingCommand,
  applyScenarioToState,
  getChecklistDescriptions,
  // S7 Knowledge Validation
  loadAdventureFacts,
  getFactQueriesForNpc,
  validateFactInResponse,
  logKnowledgeGap,
  getKnowledgeGaps,
  patchNpcKnowledgeBase,
  runKnowledgeValidation
};
