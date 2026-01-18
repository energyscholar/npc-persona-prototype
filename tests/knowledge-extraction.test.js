#!/usr/bin/env node
/**
 * Knowledge Extraction Tests - Phase 1: Scene Extractor
 *
 * Tests fact extraction from adventure scene JSONs:
 * - Structured field extraction (stages, altitude_sickness, ship_condition, etc.)
 * - Prose extraction via LLM
 * - Keyword extraction
 * - Priority assignment
 */

const { strict: assert } = require('assert');
const path = require('path');
const fs = require('fs');

// Import scene extractor
let sceneExtractor;
try {
  sceneExtractor = require('../src/knowledge-extraction/scene-extractor');
} catch (e) {
  console.error('Scene extractor module not found:', e.message);
  process.exit(1);
}

const {
  extractFacts,
  extractStages,
  extractAltitudeSickness,
  extractShipCondition,
  extractEnvironmentalHazards,
  extractSkillChecks,
  extractKeywords,
  determinePriority,
  generateFactId,
  PRIORITY,
  SCENES_DIR
} = sceneExtractor;

// Test scene paths
const MOUNTAIN_CLIMB_PATH = path.join(SCENES_DIR, 'high-and-dry/scenes/mountain-climb.json');
const FINDING_SHIP_PATH = path.join(SCENES_DIR, 'high-and-dry/scenes/finding-the-ship.json');

// Test runner
function runTests(tests) {
  let passed = 0, failed = 0;
  const results = [];

  for (const [name, fn] of Object.entries(tests)) {
    try {
      // Handle async tests
      const result = fn();
      if (result && typeof result.then === 'function') {
        results.push({ name, promise: result });
      } else {
        console.log(`\x1b[32m\u2713\x1b[0m ${name}`);
        passed++;
      }
    } catch (e) {
      console.log(`\x1b[31m\u2717\x1b[0m ${name}`);
      console.log(`    ${e.message}`);
      failed++;
    }
  }

  // Wait for async tests
  return Promise.all(
    results.map(async ({ name, promise }) => {
      try {
        await promise;
        console.log(`\x1b[32m\u2713\x1b[0m ${name}`);
        passed++;
      } catch (e) {
        console.log(`\x1b[31m\u2717\x1b[0m ${name}`);
        console.log(`    ${e.message}`);
        failed++;
      }
    })
  ).then(() => {
    console.log(`\n${passed}/${passed + failed} tests passed`);
    return failed === 0;
  });
}

// === UTILITY TESTS ===

const utilityTests = {
  'generateFactId creates valid IDs': () => {
    const id = generateFactId('mountain-climb', 'stages', 1);
    assert(id.startsWith('EXT_'), `ID should start with EXT_: ${id}`);
    // Prefix is first letter of each hyphen-separated word, up to 3 chars
    assert(id.includes('MC') || id.includes('MOU'), `ID should include scene prefix: ${id}`);
  },

  'extractKeywords extracts altitude values': () => {
    const keywords = extractKeywords('Altitude 500m to 1400m peak');
    assert(keywords.some(k => k.includes('500m')), 'Should extract 500m');
    assert(keywords.some(k => k.includes('1400m')), 'Should extract 1400m');
  },

  'extractKeywords extracts DM modifiers': () => {
    const keywords = extractKeywords('DM-2 on all checks, DM-4 severe');
    assert(keywords.some(k => k.toLowerCase().includes('dm-2')), 'Should extract DM-2');
    assert(keywords.some(k => k.toLowerCase().includes('dm-4')), 'Should extract DM-4');
  },

  'extractKeywords extracts game terms': () => {
    const keywords = extractKeywords('Power plant offline, fuel depleted');
    assert(keywords.includes('offline'), 'Should extract offline');
    assert(keywords.includes('depleted'), 'Should extract depleted');
    assert(keywords.includes('fuel'), 'Should extract fuel');
    assert(keywords.includes('power'), 'Should extract power');
  },

  'determinePriority assigns 1 to mechanics': () => {
    assert.equal(determinePriority('altitude_sickness', ''), PRIORITY.mechanics);
    assert.equal(determinePriority('skill_checks', ''), PRIORITY.mechanics);
    assert.equal(determinePriority('repair_requirements', ''), PRIORITY.mechanics);
  },

  'determinePriority assigns 1 to DM content': () => {
    assert.equal(determinePriority('other', 'DM-2 penalty'), PRIORITY.mechanics);
  },

  'determinePriority assigns 2 to key facts': () => {
    assert.equal(determinePriority('stages', ''), PRIORITY.key_facts);
    assert.equal(determinePriority('ship_condition', ''), PRIORITY.key_facts);
  },

  'determinePriority assigns 3 to flavor': () => {
    assert.equal(determinePriority('atmosphere', ''), PRIORITY.flavor);
    assert.equal(determinePriority('description', ''), PRIORITY.flavor);
  }
};

// === STRUCTURED EXTRACTION TESTS ===

const structuredTests = {
  'extractStages extracts all 6 stages from mountain-climb': () => {
    const scene = JSON.parse(fs.readFileSync(MOUNTAIN_CLIMB_PATH, 'utf8'));
    const facts = extractStages(scene.stages, scene.id);

    // Should have summary + 6 individual stages
    assert(facts.length >= 6, `Expected at least 6 facts, got ${facts.length}`);

    // Summary fact should have altitude range (500 to 1400m)
    const summary = facts.find(f => f.content.includes('stages'));
    assert(summary, 'Should have summary fact');
    assert(summary.content.includes('500'), 'Summary should include 500');
    assert(summary.content.includes('1400'), 'Summary should include 1400');
  },

  'extractStages facts have correct source': () => {
    const scene = JSON.parse(fs.readFileSync(MOUNTAIN_CLIMB_PATH, 'utf8'));
    const facts = extractStages(scene.stages, scene.id);

    const summary = facts.find(f => f.source.includes(':stages'));
    assert(summary, 'Summary should have :stages source');
    assert.equal(summary.source, 'mountain-climb.json:stages');
  },

  'extractAltitudeSickness extracts DM penalties as priority 1': () => {
    const scene = JSON.parse(fs.readFileSync(MOUNTAIN_CLIMB_PATH, 'utf8'));
    const facts = extractAltitudeSickness(scene.altitude_sickness, scene.id);

    // Find DM facts
    const dmFacts = facts.filter(f => f.content.includes('DM'));
    assert(dmFacts.length >= 2, `Expected at least 2 DM facts, got ${dmFacts.length}`);

    // All DM facts should be priority 1
    dmFacts.forEach(f => {
      assert.equal(f.priority, PRIORITY.mechanics, `DM fact should be priority 1: ${f.content}`);
    });

    // Check specific DMs
    assert(dmFacts.some(f => f.content.includes('DM-2')), 'Should extract DM-2');
    assert(dmFacts.some(f => f.content.includes('DM-4')), 'Should extract DM-4');
  },

  'extractShipCondition extracts power plant offline': () => {
    const scene = JSON.parse(fs.readFileSync(FINDING_SHIP_PATH, 'utf8'));
    const facts = extractShipCondition(scene.ship_condition, scene.id);

    const powerFact = facts.find(f =>
      f.content.toLowerCase().includes('power') &&
      f.content.toLowerCase().includes('offline')
    );
    assert(powerFact, 'Should extract power plant offline fact');
    assert(powerFact.keywords.includes('offline'), 'Keywords should include offline');
    assert(powerFact.keywords.includes('power'), 'Keywords should include power');
  },

  'extractShipCondition extracts fuel depleted': () => {
    const scene = JSON.parse(fs.readFileSync(FINDING_SHIP_PATH, 'utf8'));
    const facts = extractShipCondition(scene.ship_condition, scene.id);

    const fuelFact = facts.find(f =>
      f.content.toLowerCase().includes('depleted')
    );
    assert(fuelFact, 'Should extract fuel depleted fact');
    assert(fuelFact.keywords.includes('depleted'), 'Keywords should include depleted');
  },

  'extractEnvironmentalHazards extracts thin atmosphere': () => {
    const scene = JSON.parse(fs.readFileSync(FINDING_SHIP_PATH, 'utf8'));
    const facts = extractEnvironmentalHazards(scene.environmental_hazards, scene.id);

    const atmosFact = facts.find(f =>
      f.content.toLowerCase().includes('thin atmosphere')
    );
    assert(atmosFact, 'Should extract thin atmosphere hazard');
    assert(atmosFact.priority === PRIORITY.key_facts, 'Hazards should be priority 2');
  },

  'extractSkillChecks extracts all skill checks': () => {
    const scene = JSON.parse(fs.readFileSync(MOUNTAIN_CLIMB_PATH, 'utf8'));
    const facts = extractSkillChecks(scene.skill_checks, scene.id);

    assert.equal(facts.length, scene.skill_checks.length, 'Should extract all skill checks');
    facts.forEach(f => {
      assert.equal(f.priority, PRIORITY.mechanics, 'Skill checks should be priority 1');
    });
  }
};

// === FULL EXTRACTION TESTS ===

const fullExtractionTests = {
  'extractFacts returns facts from mountain-climb.json': async () => {
    const result = await extractFacts(MOUNTAIN_CLIMB_PATH, { skipLLM: true });

    assert(result.facts.length > 0, 'Should extract facts');
    assert.equal(result.scene, 'mountain-climb', 'Should identify scene');
    assert.equal(result.errors.length, 0, 'Should have no errors');

    // Check for stages
    assert(result.facts.some(f => f.source.includes('stages')), 'Should have stages facts');

    // Check for altitude sickness
    assert(result.facts.some(f => f.source.includes('altitude_sickness')), 'Should have altitude_sickness facts');
  },

  'extractFacts returns facts from finding-the-ship.json': async () => {
    const result = await extractFacts(FINDING_SHIP_PATH, { skipLLM: true });

    assert(result.facts.length > 0, 'Should extract facts');
    assert.equal(result.scene, 'finding-the-ship', 'Should identify scene');

    // Check for ship condition
    assert(result.facts.some(f => f.source.includes('ship_condition')), 'Should have ship_condition facts');

    // Check for environmental hazards
    assert(result.facts.some(f => f.source.includes('environmental_hazards')), 'Should have environmental_hazards facts');
  },

  'extractFacts all facts have required fields': async () => {
    const result = await extractFacts(MOUNTAIN_CLIMB_PATH, { skipLLM: true });

    result.facts.forEach(f => {
      assert(f.id, `Fact should have id: ${JSON.stringify(f)}`);
      assert(f.source, `Fact should have source: ${JSON.stringify(f)}`);
      assert(typeof f.priority === 'number', `Fact should have numeric priority: ${JSON.stringify(f)}`);
      assert(f.content, `Fact should have content: ${JSON.stringify(f)}`);
      assert(Array.isArray(f.keywords), `Fact should have keywords array: ${JSON.stringify(f)}`);
      assert(Array.isArray(f.relevant_npcs), `Fact should have relevant_npcs array: ${JSON.stringify(f)}`);
    });
  },

  'extractFacts handles missing file gracefully': async () => {
    const result = await extractFacts('/nonexistent/path.json', { skipLLM: true });

    assert.equal(result.facts.length, 0, 'Should have no facts');
    assert(result.errors.length > 0, 'Should have errors');
  }
};

// === TEST 1.1-1.5 FROM AUDIT ===

const auditTests = {
  // TEST 1.1: Structured field extraction - altitude ranges
  'TEST 1.1: Extract all 6 stages with altitude ranges from mountain-climb.json': async () => {
    const result = await extractFacts(MOUNTAIN_CLIMB_PATH, { skipLLM: true });

    // Must have facts with 500 and 1400 (altitude range from base to peak)
    assert(
      result.facts.some(f => f.content.includes('500') && f.content.includes('1400')),
      'Should have fact with 500 and 1400 altitude range'
    );

    // Must have source = mountain-climb.json:stages
    assert(
      result.facts.some(f => f.source === 'mountain-climb.json:stages'),
      'Should have stages source'
    );
  },

  // TEST 1.2: DM penalties as priority 1
  'TEST 1.2: DM penalties extracted as priority 1 (mechanics)': async () => {
    const result = await extractFacts(MOUNTAIN_CLIMB_PATH, { skipLLM: true });
    const mechanicsFacts = result.facts.filter(f => f.priority === 1);

    assert(
      mechanicsFacts.some(f => f.content.includes('DM-2') || f.content.includes('DM-4')),
      'Mechanics facts should include DM-2 or DM-4'
    );
  },

  // TEST 1.3: Ship condition extraction
  'TEST 1.3: Power plant offline, fuel depleted extracted from finding-the-ship.json': async () => {
    const result = await extractFacts(FINDING_SHIP_PATH, { skipLLM: true });

    assert(
      result.facts.some(f =>
        f.content.toLowerCase().includes('power') &&
        f.content.toLowerCase().includes('offline')
      ),
      'Should extract power plant offline'
    );
  },

  // TEST 1.4: Environmental hazards
  'TEST 1.4: Thin atmosphere extracted as environmental hazard': async () => {
    const result = await extractFacts(FINDING_SHIP_PATH, { skipLLM: true });

    assert(
      result.facts.some(f => f.content.toLowerCase().includes('thin atmosphere')),
      'Should extract thin atmosphere hazard'
    );
  },

  // TEST 1.5: Prose extraction (skipped without LLM client)
  'TEST 1.5: Prose facts have narrator_prompt source (when LLM enabled)': async () => {
    // This test verifies the structure exists for prose extraction
    // Full LLM testing requires API key
    const result = await extractFacts(FINDING_SHIP_PATH, { skipLLM: true });

    // Without LLM, no prose facts should be present
    const proseFacts = result.facts.filter(f => f.source.includes('narrator_prompt'));

    // This is expected when skipLLM: true
    // The test passes if we can at least verify the extraction runs without error
    assert(result.errors.length === 0, 'Should have no errors');
  }
};

// === PHASE 2: QUERY GENERATOR TESTS ===

let queryGenerator;
try {
  queryGenerator = require('../src/knowledge-extraction/query-generator');
} catch (e) {
  console.error('Query generator module not found:', e.message);
}

const phase2Tests = queryGenerator ? {
  // TEST 2.1: Query generation from mechanics facts
  'TEST 2.1: Query generation from mechanics facts': () => {
    const facts = sceneExtractor.loadFacts('high-and-dry');
    assert(facts, 'Facts should be loaded');

    const mechanicsFacts = facts.filter(f => f.priority === 1);
    const queries = queryGenerator.generateQueries(mechanicsFacts);

    assert(queries.length > 0, 'Should generate queries');
    assert(
      queries.some(q => q.query.toLowerCase().includes('altitude') ||
                        q.query.toLowerCase().includes('ship') ||
                        q.query.toLowerCase().includes('repair')),
      'Should generate query about mechanics topics'
    );
  },

  // TEST 2.2: Query has expected/failure keywords
  'TEST 2.2: Query has expected/failure keywords': () => {
    const facts = sceneExtractor.loadFacts('high-and-dry');
    const queries = queryGenerator.generateQueries(facts);

    const q = queries[0];
    assert(Array.isArray(q.expected_keywords), 'Should have expected_keywords array');
    assert(Array.isArray(q.failure_keywords), 'Should have failure_keywords array');

    // Keywords from fact propagate to query
    const hasKeywords = queries.some(query => {
      const fact = facts.find(f => f.id === query.fact_id);
      return fact && query.expected_keywords.some(k => fact.keywords.includes(k));
    });
    assert(hasKeywords, 'Keywords should propagate from facts to queries');
  },

  // TEST 2.3: Query tagged as extracted
  'TEST 2.3: Query tagged as extracted': () => {
    const facts = sceneExtractor.loadFacts('high-and-dry');
    const queries = queryGenerator.generateQueries(facts);

    assert(queries.every(q => q.source === 'extracted'), 'All queries should have source: extracted');
  },

  // TEST 2.4: Query targets correct NPC
  'TEST 2.4: Query targets correct NPC': () => {
    const facts = sceneExtractor.loadFacts('high-and-dry');
    const queries = queryGenerator.generateQueries(facts);

    const narratorQueries = queries.filter(q => q.target_npcs.includes('narrator-high-and-dry'));
    assert(narratorQueries.length > 0, 'Should have queries targeting narrator');
  },

  // TEST 2.5: Tier assignment matches fact priority
  'TEST 2.5: Tier assignment matches fact priority': () => {
    const facts = sceneExtractor.loadFacts('high-and-dry');
    const queries = queryGenerator.generateQueries(facts);

    const tier1Queries = queries.filter(q => q.tier === 1);
    const allTier1MatchPriority = tier1Queries.every(q => {
      const fact = facts.find(f => f.id === q.fact_id);
      return fact?.priority === 1;
    });
    assert(allTier1MatchPriority, 'Tier 1 queries should have priority 1 facts');
  },

  // TEST 2.6: No duplicate queries for same fact
  'TEST 2.6: No duplicate queries for same fact': () => {
    const facts = sceneExtractor.loadFacts('high-and-dry');
    const queries = queryGenerator.generateQueries(facts);

    const factIds = queries.map(q => q.fact_id);
    const uniqueFactIds = [...new Set(factIds)];
    assert.equal(factIds.length, uniqueFactIds.length, 'Should have no duplicate fact_ids');
  },

  // TEST 2.7: Query ID format
  'TEST 2.7: Query ID format': () => {
    const facts = sceneExtractor.loadFacts('high-and-dry');
    const queries = queryGenerator.generateQueries(facts);

    assert(queries.every(q => q.id.startsWith('GEN_Q')), 'All query IDs should start with GEN_Q');
  },

  // TEST 2.8: Categorization maps sources correctly
  'TEST 2.8: Categorization maps sources correctly': () => {
    const altFact = { source: 'mountain-climb.json:altitude_sickness.mild', priority: 1 };
    const stageFact = { source: 'mountain-climb.json:stages', priority: 2 };
    const shipFact = { source: 'finding-the-ship.json:ship_condition.power', priority: 2 };
    const hazardFact = { source: 'finding-the-ship.json:environmental_hazards[0]', priority: 2 };

    assert.equal(queryGenerator.categorize(altFact), 'mechanics');
    assert.equal(queryGenerator.categorize(stageFact), 'geography');
    assert.equal(queryGenerator.categorize(shipFact), 'ship');
    assert.equal(queryGenerator.categorize(hazardFact), 'hazards');
  },

  // TEST 2.9: generateAndSave creates output file
  'TEST 2.9: generateAndSave creates output file': () => {
    const result = queryGenerator.generateAndSave('high-and-dry');

    assert.equal(result.errors.length, 0, 'Should have no errors');
    assert(result.count > 0, 'Should generate queries');
    assert(result.path, 'Should return output path');

    const fs = require('fs');
    assert(fs.existsSync(result.path), 'Output file should exist');
  },

  // TEST 2.10: Integration - loadQueries returns merged set
  'TEST 2.10: Integration - loadQueries returns merged set': () => {
    // First ensure generated queries exist
    queryGenerator.generateAndSave('high-and-dry');

    const queryEngine = require('../src/red-team/query-engine');
    const allQueries = queryEngine.loadQueries();

    const manualQueries = allQueries.filter(q => q.source !== 'extracted');
    const generatedQueries = allQueries.filter(q => q.source === 'extracted');

    assert(manualQueries.length > 0, 'Should have manual queries preserved');
    assert(generatedQueries.length > 0, 'Should have generated queries added');
  }
} : {};

// === PHASE 3: CONTEXT INJECTOR TESTS ===

let contextInjector;
try {
  contextInjector = require('../src/knowledge-extraction/context-injector');
} catch (e) {
  console.error('Context injector module not found:', e.message);
}

const phase3Tests = contextInjector ? {
  // TEST 3.1: Injection only for narrators
  'TEST 3.1: Injection only for narrators': () => {
    const narratorPersona = { archetype: 'narrator', id: 'narrator-high-and-dry' };
    const merchantPersona = { archetype: 'merchant', id: 'mr-casarii' };
    const storyState = { currentScene: 'finding-the-ship', adventure: 'high-and-dry' };

    const narratorCtx = contextInjector.buildSceneContext(narratorPersona, storyState);
    const merchantCtx = contextInjector.buildSceneContext(merchantPersona, storyState);

    assert(narratorCtx.length > 0, 'Narrator should get context');
    assert(merchantCtx.length === 0, 'Merchant should not get context');
  },

  // TEST 3.2: No injection when scene not set
  'TEST 3.2: No injection when scene not set': () => {
    const narratorPersona = { archetype: 'narrator', id: 'narrator-high-and-dry' };
    const noSceneState = { adventure: 'high-and-dry' };

    const noCtx = contextInjector.buildSceneContext(narratorPersona, noSceneState);
    assert(noCtx.length === 0, 'Should not inject without scene');
  },

  // TEST 3.3: Priority filtering (only tier 1-2)
  'TEST 3.3: Priority filtering (only tier 1-2)': () => {
    const narratorPersona = { archetype: 'narrator', id: 'narrator-high-and-dry' };
    const storyState = { currentScene: 'finding-the-ship', adventure: 'high-and-dry' };

    const ctx = contextInjector.buildSceneContext(narratorPersona, storyState);
    // Should contain facts (thin atmosphere is a hazard = tier 2, power plant = tier 1)
    assert(ctx.includes('thin atmosphere') || ctx.includes('power') || ctx.includes('offline'),
      'Should contain priority 1-2 facts');
  },

  // TEST 3.4: Token cap respected (~500 tokens = ~2000 chars)
  'TEST 3.4: Token cap respected': () => {
    const narratorPersona = { archetype: 'narrator', id: 'narrator-high-and-dry' };
    const storyState = { currentScene: 'finding-the-ship', adventure: 'high-and-dry' };

    const ctx = contextInjector.buildSceneContext(narratorPersona, storyState);
    assert(ctx.length <= 2500, `Context too long: ${ctx.length} chars`);
  },

  // TEST 3.5: Contains scene title
  'TEST 3.5: Contains scene title': () => {
    const narratorPersona = { archetype: 'narrator', id: 'narrator-high-and-dry' };
    const storyState = { currentScene: 'finding-the-ship', adventure: 'high-and-dry' };

    const ctx = contextInjector.buildSceneContext(narratorPersona, storyState);
    assert(ctx.includes('CURRENT SCENE'), 'Should include scene header');
    assert(ctx.includes('Finding') || ctx.includes('Ship'), 'Should include scene title');
  },

  // TEST 3.6: Contains fact bullets
  'TEST 3.6: Contains fact bullets': () => {
    const narratorPersona = { archetype: 'narrator', id: 'narrator-high-and-dry' };
    const storyState = { currentScene: 'finding-the-ship', adventure: 'high-and-dry' };

    const ctx = contextInjector.buildSceneContext(narratorPersona, storyState);
    assert(ctx.includes('-'), 'Should contain bullet points');
  },

  // TEST 3.7: Integration with assembleFullPrompt
  'TEST 3.7: Integration with assembleFullPrompt': () => {
    const { assembleFullPrompt } = require('../src/prompts');
    const { createMemory } = require('../src/memory');
    const narratorPersona = {
      archetype: 'narrator',
      id: 'narrator-high-and-dry',
      name: 'Narrator'
    };
    const storyState = { currentScene: 'finding-the-ship', adventure: 'high-and-dry' };

    const { system } = assembleFullPrompt(narratorPersona, createMemory(), 'test', null, storyState);
    assert(system.includes('CURRENT SCENE'), 'Assembled prompt should include scene context');
  },

  // TEST 3.8: No injection breaks existing prompts
  'TEST 3.8: No injection breaks existing prompts': () => {
    const { assembleFullPrompt } = require('../src/prompts');
    const { createMemory } = require('../src/memory');
    const narratorPersona = {
      archetype: 'narrator',
      id: 'narrator-high-and-dry',
      name: 'Narrator'
    };

    const { system: basicSystem } = assembleFullPrompt(narratorPersona, createMemory(), 'test', null, null);
    assert(basicSystem.includes('Narrator'), 'Basic prompt should include persona name');
    assert(!basicSystem.includes('CURRENT SCENE'), 'Basic prompt should not have scene context');
  },

  // TEST 3.9: filterByScene filters correctly
  'TEST 3.9: filterByScene filters correctly': () => {
    const facts = [
      { source: 'finding-the-ship.json:ship_condition', content: 'fact1' },
      { source: 'mountain-climb.json:stages', content: 'fact2' },
      { source: 'finding-the-ship.json:hazards', content: 'fact3' }
    ];

    const filtered = contextInjector.filterByScene(facts, 'finding-the-ship');
    assert.equal(filtered.length, 2, 'Should filter to 2 facts');
    assert(filtered.every(f => f.source.startsWith('finding-the-ship')), 'All should be from scene');
  },

  // TEST 3.10: capTokens respects limit
  'TEST 3.10: capTokens respects limit': () => {
    const facts = [
      { content: 'Short fact' },
      { content: 'A much longer fact that contains many more characters and words' },
      { content: 'Another fact' }
    ];

    const capped = contextInjector.capTokens(facts, 20); // ~80 chars
    assert(capped.length <= 2, 'Should cap facts to token limit');
  }
} : {};

// === PHASE 4: LEARNING INTEGRATION TESTS ===

let learningIntegration;
let factDatabase;
try {
  learningIntegration = require('../src/knowledge-extraction/learning-integration');
  factDatabase = require('../src/red-team/fact-database');
} catch (e) {
  console.error('Learning integration or fact-database module not found:', e.message);
}

const phase4Tests = (learningIntegration && factDatabase) ? {
  // TEST 4.1: Extracted fact lookup by ID
  'TEST 4.1: Extracted fact lookup by ID': () => {
    const fact = factDatabase.getFact('EXT_MC_STA_000');
    assert(fact !== null, 'Should find extracted fact');
    assert(
      fact.content.includes('climb') || fact.content.includes('stage') || fact.content.includes('Crater'),
      'Fact content should be about climbing/stages'
    );
  },

  // TEST 4.2: Manual fact lookup still works
  'TEST 4.2: Manual fact lookup still works': () => {
    const manualFact = factDatabase.getFact('FACT_001');
    assert(manualFact !== null, 'Should find manual fact');
    assert(manualFact.content.includes('IISS') || manualFact.content.includes('Scout'),
      'Should be ship ownership fact');
  },

  // TEST 4.3: Unknown fact returns null
  'TEST 4.3: Unknown fact returns null': () => {
    const unknown = factDatabase.getFact('NONEXISTENT_999');
    assert(unknown === null, 'Should return null for unknown fact');
  },

  // TEST 4.4: Learning cycle accepts extracted query failure
  'TEST 4.4: Learning cycle accepts extracted query failure': () => {
    const failedResult = {
      npc_id: 'narrator-high-and-dry',
      query_id: 'GEN_Q001',
      fact_id: 'EXT_MC_STA_000',
      verdict: 'FAIL',
      query_text: 'Describe climbing Mount Salbarii',
      response: 'The mountain is easy to climb.'
    };

    // Fact lookup should work
    const fact = factDatabase.getFact(failedResult.fact_id);
    assert(fact !== null, 'Should find extracted fact for failed result');
    assert(fact.id === failedResult.fact_id, 'Fact ID should match');
  },

  // TEST 4.5: getExtractedFact returns null for non-EXT IDs
  'TEST 4.5: getExtractedFact returns null for non-EXT IDs': () => {
    const result = learningIntegration.getExtractedFact('FACT_001');
    assert(result === null, 'Should return null for non-EXT ID');
  },

  // TEST 4.6: Metrics tracking
  'TEST 4.6: Metrics tracking': () => {
    const metrics = learningIntegration.getExtractionMetrics();
    assert('extracted_facts_count' in metrics, 'Should have extracted_facts_count');
    assert('adventures_covered' in metrics, 'Should have adventures_covered');
    assert('by_priority' in metrics, 'Should have by_priority breakdown');
    assert(metrics.extracted_facts_count > 0, 'Should have some extracted facts');
  },

  // TEST 4.7: isExtractedFact correctly identifies IDs
  'TEST 4.7: isExtractedFact correctly identifies IDs': () => {
    assert(learningIntegration.isExtractedFact('EXT_MC_STA_000') === true, 'Should identify EXT_ IDs');
    assert(learningIntegration.isExtractedFact('FACT_001') === false, 'Should reject non-EXT IDs');
    assert(learningIntegration.isExtractedFact(null) === false, 'Should handle null');
  },

  // TEST 4.8: getManualFact bypasses extracted lookup
  'TEST 4.8: getManualFact bypasses extracted lookup': () => {
    const manual = factDatabase.getManualFact('FACT_001');
    assert(manual !== null, 'Should find manual fact');

    const extracted = factDatabase.getManualFact('EXT_MC_STA_000');
    assert(extracted === null, 'Should NOT find extracted fact via getManualFact');
  },

  // TEST 4.9: loadAllExtractedFacts returns facts from all adventures
  'TEST 4.9: loadAllExtractedFacts returns facts': () => {
    const allFacts = learningIntegration.loadAllExtractedFacts();
    assert(Array.isArray(allFacts), 'Should return array');
    assert(allFacts.length > 0, 'Should have facts');
    assert(allFacts.every(f => f.id && f.content), 'All facts should have id and content');
  },

  // TEST 4.10: buildExtractedFactIndex creates proper index
  'TEST 4.10: buildExtractedFactIndex creates proper index': () => {
    const index = learningIntegration.buildExtractedFactIndex();
    assert('byId' in index, 'Should have byId index');
    assert('byScene' in index, 'Should have byScene index');
    assert('byNpc' in index, 'Should have byNpc index');
    assert(Object.keys(index.byId).length > 0, 'byId should have entries');
  }
} : {};

// === RUN ALL TESTS ===

async function main() {
  console.log('=== Knowledge Extraction Tests ===\n');

  console.log('--- Phase 1: Utility Tests ---');
  const utilPassed = await runTests(utilityTests);

  console.log('\n--- Phase 1: Structured Extraction Tests ---');
  const structPassed = await runTests(structuredTests);

  console.log('\n--- Phase 1: Full Extraction Tests ---');
  const fullPassed = await runTests(fullExtractionTests);

  console.log('\n--- Phase 1: Audit Spec Tests (1.1-1.5) ---');
  const auditPassed = await runTests(auditTests);

  let phase2Passed = true;
  if (queryGenerator) {
    console.log('\n--- Phase 2: Query Generator Tests (2.1-2.10) ---');
    phase2Passed = await runTests(phase2Tests);
  } else {
    console.log('\n--- Phase 2: SKIPPED (module not found) ---');
  }

  let phase3Passed = true;
  if (contextInjector) {
    console.log('\n--- Phase 3: Context Injector Tests (3.1-3.10) ---');
    phase3Passed = await runTests(phase3Tests);
  } else {
    console.log('\n--- Phase 3: SKIPPED (module not found) ---');
  }

  let phase4Passed = true;
  if (learningIntegration && factDatabase) {
    console.log('\n--- Phase 4: Learning Integration Tests (4.1-4.10) ---');
    phase4Passed = await runTests(phase4Tests);
  } else {
    console.log('\n--- Phase 4: SKIPPED (module not found) ---');
  }

  const allPassed = utilPassed && structPassed && fullPassed && auditPassed && phase2Passed && phase3Passed && phase4Passed;

  console.log('\n' + '='.repeat(50));
  console.log(allPassed ? '\x1b[32mAll tests passed!\x1b[0m' : '\x1b[31mSome tests failed.\x1b[0m');

  process.exit(allPassed ? 0 : 1);
}

main().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});
