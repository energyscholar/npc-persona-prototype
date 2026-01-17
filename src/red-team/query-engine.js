/**
 * Query Engine - Send probe queries to NPCs and capture responses
 *
 * Part of red team validation system for NPC fact-checking.
 */

const fs = require('fs');
const path = require('path');
const { loadFacts, getFactsForNpc } = require('./fact-database');

const QUERIES_FILE = path.join(__dirname, '../../data/red-team/queries.json');

/**
 * Query definition structure
 * @typedef {Object} Query
 * @property {string} id - Query identifier (Q001, Q002, etc.)
 * @property {string} fact_id - Related fact ID
 * @property {string[]} target_npcs - NPCs to query
 * @property {string} query - The question to ask
 * @property {string[]} expected_keywords - Keywords indicating correct answer
 * @property {string[]} failure_keywords - Keywords indicating wrong answer
 */

/**
 * Load queries from database
 * @returns {Array<Query>} Query definitions
 */
function loadQueries() {
  if (!fs.existsSync(QUERIES_FILE)) {
    return initializeQueries();
  }

  try {
    const data = JSON.parse(fs.readFileSync(QUERIES_FILE, 'utf8'));
    return data.queries || [];
  } catch (e) {
    console.error('Error loading queries:', e.message);
    return [];
  }
}

/**
 * Save queries to database
 * @param {Array<Query>} queries
 */
function saveQueries(queries) {
  const dir = path.dirname(QUERIES_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(QUERIES_FILE, JSON.stringify({
    version: '1.0',
    generated: new Date().toISOString(),
    queries
  }, null, 2));
}

/**
 * Initialize default queries based on fact database
 * @returns {Array<Query>}
 */
function initializeQueries() {
  const queries = [
    // Ship Ownership Queries
    {
      id: 'Q001',
      fact_id: 'FACT_001',
      target_npcs: ['narrator-high-and-dry', 'mr-casarii'],
      query: 'Who owns the Highndry?',
      expected_keywords: ['Scout Service', 'IISS', 'lease', 'detached duty'],
      failure_keywords: ['inherit', 'inherited', 'your ship', 'you own']
    },
    {
      id: 'Q002',
      fact_id: 'FACT_002',
      target_npcs: ['mr-casarii', 'narrator-high-and-dry'],
      query: 'What is detached duty and what does it mean for the ship?',
      expected_keywords: ['lease', 'one-year', 'renewable', 'obligations'],
      failure_keywords: ['permanent', 'forever', 'ownership', 'yours to keep']
    },
    {
      id: 'Q003',
      fact_id: 'FACT_004',
      target_npcs: ['mr-casarii'],
      query: 'What happens to the ship after the mission ends?',
      expected_keywords: ['lease', 'renewable', 'return', 'Scout Service'],
      failure_keywords: ['keep forever', 'yours', 'permanent']
    },

    // Walston Arrival Queries
    {
      id: 'Q010',
      fact_id: 'FACT_020',
      target_npcs: ['narrator-high-and-dry'],
      query: 'What should the PCs know before passing through customs on Walston?',
      expected_keywords: ['weapons', 'declare', 'Law 8', 'storage', 'safebox'],
      failure_keywords: []
    },
    {
      id: 'Q011',
      fact_id: 'FACT_011',
      target_npcs: ['narrator-high-and-dry', 'customs-officer-walston'],
      query: 'Describe Walston\'s law level and what it means for weapons.',
      expected_keywords: ['Law 8', 'strict', 'weapons', 'controlled', 'prohibited'],
      failure_keywords: ['relaxed', 'permissive', 'allowed', 'carry freely']
    },
    {
      id: 'Q012',
      fact_id: 'FACT_013',
      target_npcs: ['narrator-high-and-dry', 'startown-bartender'],
      query: 'What is Walston\'s population makeup?',
      expected_keywords: ['70%', 'Vargr', 'majority', '3000'],
      failure_keywords: ['human majority', 'few Vargr']
    },

    // Customs Queries
    {
      id: 'Q020',
      fact_id: 'FACT_021',
      target_npcs: ['customs-officer-walston'],
      query: 'What happens if I have weapons when entering Walston?',
      expected_keywords: ['declare', 'storage', 'safebox', 'Cr10', 'receipt'],
      failure_keywords: ['confiscate', 'illegal', 'arrest']
    },
    {
      id: 'Q021',
      fact_id: 'FACT_011',
      target_npcs: ['customs-officer-walston'],
      query: 'Can I carry my gun around on Walston?',
      expected_keywords: ['no', 'Law 8', 'must store', 'prohibited'],
      failure_keywords: ['yes', 'allowed', 'maybe', 'depends']
    },

    // Cultural Queries
    {
      id: 'Q030',
      fact_id: 'FACT_030',
      target_npcs: ['startown-bartender'],
      query: 'What\'s the deal with Vargr here on Walston?',
      expected_keywords: ['70%', 'majority', 'glass ceiling', 'accepted'],
      failure_keywords: ['oppressed', 'enslaved', 'hated']
    },
    {
      id: 'Q031',
      fact_id: 'FACT_031',
      target_npcs: ['startown-bartender', 'narrator-high-and-dry'],
      query: 'Tell me about local customs and traditions on Walston.',
      expected_keywords: ['kilts', 'traditional', 'thin atmosphere'],
      failure_keywords: []
    },

    // Payment/Mission Queries
    {
      id: 'Q040',
      fact_id: 'FACT_050',
      target_npcs: ['minister-greener'],
      query: 'What is the payment for the volcano survey job?',
      expected_keywords: ['Cr3000', '3000', 'credits'],
      failure_keywords: []
    },
    {
      id: 'Q041',
      fact_id: 'FACT_051',
      target_npcs: ['minister-greener'],
      query: 'How long will the survey take?',
      expected_keywords: ['2-3 days', 'two', 'three', 'days'],
      failure_keywords: ['weeks', 'month']
    },
    {
      id: 'Q042',
      fact_id: 'FACT_053',
      target_npcs: ['minister-greener'],
      query: 'Where is the ship located?',
      expected_keywords: ['120', 'kilometers', 'mountain', 'Salbarii'],
      failure_keywords: []
    }
  ];

  saveQueries(queries);
  return queries;
}

/**
 * Get queries for a specific NPC
 * @param {string} npcId - NPC identifier
 * @returns {Array<Query>} Queries targeting this NPC
 */
function getQueriesForNpc(npcId) {
  const queries = loadQueries();
  return queries.filter(q => q.target_npcs.includes(npcId));
}

/**
 * Get a specific query by ID
 * @param {string} queryId - Query identifier
 * @returns {Query|null}
 */
function getQuery(queryId) {
  const queries = loadQueries();
  return queries.find(q => q.id === queryId) || null;
}

/**
 * Build a probe prompt for an NPC
 * @param {Query} query - Query to ask
 * @param {Object} npc - NPC data
 * @returns {string} Formatted prompt
 */
function buildProbePrompt(query, npc) {
  return `You are ${npc.name}. A traveller asks you: "${query.query}"

Answer in character, using your knowledge. Be specific and factual.`;
}

/**
 * Execute a query against an NPC (mock for now - requires AI client)
 * @param {Query} query - Query to execute
 * @param {Object} npc - NPC data
 * @param {Object} client - AI client (optional)
 * @returns {Object} { query, npc, response, timestamp }
 */
async function executeQuery(query, npc, client = null) {
  const result = {
    query_id: query.id,
    npc_id: npc.id,
    query_text: query.query,
    timestamp: new Date().toISOString(),
    response: null,
    error: null
  };

  if (!client) {
    // Mock response for testing without AI
    result.response = `[Mock response for ${npc.name} to: ${query.query}]`;
    result.mock = true;
    return result;
  }

  try {
    const prompt = buildProbePrompt(query, npc);
    const response = await client.chat(prompt);
    result.response = response.content;
  } catch (e) {
    result.error = e.message;
  }

  return result;
}

/**
 * Execute all queries for an NPC
 * @param {string} npcId - NPC identifier
 * @param {Object} npc - NPC data
 * @param {Object} client - AI client (optional)
 * @returns {Array} Query results
 */
async function executeAllQueriesForNpc(npcId, npc, client = null) {
  const queries = getQueriesForNpc(npcId);
  const results = [];

  for (const query of queries) {
    const result = await executeQuery(query, npc, client);
    results.push(result);
  }

  return results;
}

module.exports = {
  loadQueries,
  saveQueries,
  initializeQueries,
  getQueriesForNpc,
  getQuery,
  buildProbePrompt,
  executeQuery,
  executeAllQueriesForNpc,
  QUERIES_FILE
};
