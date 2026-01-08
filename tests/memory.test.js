#!/usr/bin/env node
/**
 * Memory System Tests (TDD - Tests First)
 *
 * Tests the hybrid memory system:
 * - Structured facts
 * - Rolling summary
 * - Recent messages (capped)
 */

const { strict: assert } = require('assert');

// Import will fail until implementation exists
let memory;
try {
  memory = require('../src/memory');
} catch (e) {
  console.error('Memory module not yet implemented. Run tests to see what needs to be built.\n');
  memory = {};
}

const {
  createMemory,
  addMessage,
  addFact,
  updateFact,
  getFact,
  shouldSummarize,
  applySummary,
  serialize,
  deserialize,
  getContextWindow,
  RECENT_MESSAGE_LIMIT,
  SUMMARIZE_THRESHOLD
} = memory;

// Test runner
function runTests(tests) {
  let passed = 0, failed = 0;
  for (const [name, fn] of Object.entries(tests)) {
    try {
      fn();
      console.log(`\x1b[32m✓\x1b[0m ${name}`);
      passed++;
    } catch (e) {
      console.log(`\x1b[31m✗\x1b[0m ${name}`);
      console.log(`    ${e.message}`);
      failed++;
    }
  }
  console.log(`\n${passed}/${passed + failed} tests passed`);
  return failed === 0;
}

// === MEMORY CREATION TESTS ===

const creationTests = {
  'createMemory returns object with correct structure': () => {
    const mem = createMemory();
    assert.ok(mem, 'Should return memory object');
    assert.deepEqual(mem.facts, [], 'facts should be empty array');
    assert.deepEqual(mem.recentMessages, [], 'recentMessages should be empty array');
    assert.equal(mem.historySummary, null, 'historySummary should be null');
    assert.equal(mem.totalInteractions, 0, 'totalInteractions should be 0');
    assert.equal(mem.firstContact, null, 'firstContact should be null');
    assert.equal(mem.lastContact, null, 'lastContact should be null');
  },

  'createMemory with existing data restores state': () => {
    const existing = {
      facts: [{ type: 'relationship', value: 'friendly' }],
      recentMessages: [{ role: 'user', content: 'hello' }],
      historySummary: 'Previous history...',
      totalInteractions: 5,
      firstContact: '001-1105',
      lastContact: '100-1105'
    };
    const mem = createMemory(existing);
    assert.deepEqual(mem.facts, existing.facts);
    assert.equal(mem.historySummary, 'Previous history...');
    assert.equal(mem.totalInteractions, 5);
  }
};

// === MESSAGE TESTS ===

const messageTests = {
  'addMessage adds to recentMessages': () => {
    const mem = createMemory();
    addMessage(mem, 'user', 'Hello Marcus', '150-1105');
    assert.equal(mem.recentMessages.length, 1);
    assert.equal(mem.recentMessages[0].role, 'user');
    assert.equal(mem.recentMessages[0].content, 'Hello Marcus');
    assert.equal(mem.recentMessages[0].date, '150-1105');
  },

  'addMessage increments totalInteractions': () => {
    const mem = createMemory();
    addMessage(mem, 'user', 'Hello', '001-1105');
    assert.equal(mem.totalInteractions, 1);
    addMessage(mem, 'assistant', 'Hi there', '001-1105');
    assert.equal(mem.totalInteractions, 2);
  },

  'addMessage sets firstContact on first message': () => {
    const mem = createMemory();
    addMessage(mem, 'user', 'First contact', '050-1105');
    assert.equal(mem.firstContact, '050-1105');
  },

  'addMessage updates lastContact': () => {
    const mem = createMemory();
    addMessage(mem, 'user', 'First', '001-1105');
    addMessage(mem, 'user', 'Second', '100-1105');
    assert.equal(mem.firstContact, '001-1105');
    assert.equal(mem.lastContact, '100-1105');
  },

  'addMessage caps at RECENT_MESSAGE_LIMIT': () => {
    const mem = createMemory();
    const limit = RECENT_MESSAGE_LIMIT || 10;

    // Add more than limit
    for (let i = 0; i < limit + 5; i++) {
      addMessage(mem, 'user', `Message ${i}`, `${i}-1105`);
    }

    assert.equal(mem.recentMessages.length, limit, `Should cap at ${limit}`);
    // Oldest should be dropped
    assert.equal(mem.recentMessages[0].content, 'Message 5');
  }
};

// === FACT TESTS ===

const factTests = {
  'addFact adds new fact': () => {
    const mem = createMemory();
    addFact(mem, { type: 'relationship', value: 'trusts player', since: '001-1105' });
    assert.equal(mem.facts.length, 1);
    assert.equal(mem.facts[0].type, 'relationship');
    assert.equal(mem.facts[0].value, 'trusts player');
  },

  'addFact with same type updates existing': () => {
    const mem = createMemory();
    addFact(mem, { type: 'relationship', value: 'neutral', since: '001-1105' });
    addFact(mem, { type: 'relationship', value: 'friendly', since: '050-1105' });
    assert.equal(mem.facts.length, 1, 'Should not duplicate');
    assert.equal(mem.facts[0].value, 'friendly', 'Should update value');
  },

  'addFact allows multiple facts of different types': () => {
    const mem = createMemory();
    addFact(mem, { type: 'relationship', value: 'friendly' });
    addFact(mem, { type: 'debt', value: 'owes 5000cr' });
    addFact(mem, { type: 'secret', value: 'knows smuggling route' });
    assert.equal(mem.facts.length, 3);
  },

  'getFact retrieves fact by type': () => {
    const mem = createMemory();
    addFact(mem, { type: 'debt', value: 'owes 5000cr', resolved: false });
    const fact = getFact(mem, 'debt');
    assert.ok(fact);
    assert.equal(fact.value, 'owes 5000cr');
  },

  'getFact returns null for missing type': () => {
    const mem = createMemory();
    const fact = getFact(mem, 'nonexistent');
    assert.equal(fact, null);
  },

  'updateFact modifies existing fact': () => {
    const mem = createMemory();
    addFact(mem, { type: 'debt', value: 'owes 5000cr', resolved: false });
    updateFact(mem, 'debt', { resolved: true });
    const fact = getFact(mem, 'debt');
    assert.equal(fact.resolved, true);
    assert.equal(fact.value, 'owes 5000cr', 'Other fields preserved');
  }
};

// === SUMMARIZATION TESTS ===

const summarizationTests = {
  'shouldSummarize returns false when under threshold': () => {
    const mem = createMemory();
    for (let i = 0; i < 5; i++) {
      addMessage(mem, 'user', `Message ${i}`, `${i}-1105`);
    }
    assert.equal(shouldSummarize(mem), false);
  },

  'shouldSummarize returns true when over threshold': () => {
    const mem = createMemory();
    const threshold = SUMMARIZE_THRESHOLD || 20;
    for (let i = 0; i < threshold + 1; i++) {
      addMessage(mem, 'user', `Message ${i}`, `${i}-1105`);
    }
    assert.equal(shouldSummarize(mem), true);
  },

  'applySummary replaces old messages with summary': () => {
    const mem = createMemory();
    for (let i = 0; i < 15; i++) {
      addMessage(mem, 'user', `Message ${i}`, `${i}-1105`);
    }

    applySummary(mem, 'Summary of conversation history...', '15-1105');

    assert.equal(mem.historySummary, 'Summary of conversation history...');
    assert.equal(mem.summaryAsOf, '15-1105');
    // Should keep only recent 5
    assert.ok(mem.recentMessages.length <= 5, 'Should keep recent messages');
  }
};

// === SERIALIZATION TESTS ===

const serializationTests = {
  'serialize returns JSON string': () => {
    const mem = createMemory();
    addMessage(mem, 'user', 'Hello', '001-1105');
    addFact(mem, { type: 'relationship', value: 'friendly' });

    const json = serialize(mem);
    assert.equal(typeof json, 'string');

    const parsed = JSON.parse(json);
    assert.ok(parsed.facts);
    assert.ok(parsed.recentMessages);
  },

  'deserialize restores memory from JSON': () => {
    const original = createMemory();
    addMessage(original, 'user', 'Hello', '001-1105');
    addFact(original, { type: 'relationship', value: 'friendly' });
    original.historySummary = 'Test summary';

    const json = serialize(original);
    const restored = deserialize(json);

    assert.deepEqual(restored.facts, original.facts);
    assert.deepEqual(restored.recentMessages, original.recentMessages);
    assert.equal(restored.historySummary, original.historySummary);
  },

  'deserialize handles invalid JSON gracefully': () => {
    assert.throws(() => deserialize('not valid json'), /invalid/i);
  }
};

// === CONTEXT WINDOW TESTS ===

const contextTests = {
  'getContextWindow returns formatted messages': () => {
    const mem = createMemory();
    addMessage(mem, 'user', 'Hello', '001-1105');
    addMessage(mem, 'assistant', 'Hi there!', '001-1105');

    const context = getContextWindow(mem);
    assert.ok(Array.isArray(context.messages));
    assert.equal(context.messages.length, 2);
    assert.equal(context.messages[0].role, 'user');
    assert.equal(context.messages[1].role, 'assistant');
  },

  'getContextWindow includes facts section': () => {
    const mem = createMemory();
    addFact(mem, { type: 'relationship', value: 'friendly' });
    addFact(mem, { type: 'debt', value: 'owes 1000cr' });

    const context = getContextWindow(mem);
    assert.ok(context.factsText, 'Should have facts text');
    assert.ok(context.factsText.includes('friendly'));
    assert.ok(context.factsText.includes('1000cr'));
  },

  'getContextWindow includes history summary when present': () => {
    const mem = createMemory();
    mem.historySummary = 'Previous conversation summary here';
    addMessage(mem, 'user', 'New message', '100-1105');

    const context = getContextWindow(mem);
    assert.ok(context.summaryText);
    assert.ok(context.summaryText.includes('Previous conversation'));
  }
};

// === RUN ALL TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  MEMORY SYSTEM TESTS');
console.log('══════════════════════════════════════════\n');

console.log('--- Creation Tests ---');
const creation = runTests(creationTests);

console.log('\n--- Message Tests ---');
const messages = runTests(messageTests);

console.log('\n--- Fact Tests ---');
const facts = runTests(factTests);

console.log('\n--- Summarization Tests ---');
const summarization = runTests(summarizationTests);

console.log('\n--- Serialization Tests ---');
const serialization = runTests(serializationTests);

console.log('\n--- Context Window Tests ---');
const context = runTests(contextTests);

const allPassed = creation && messages && facts && summarization && serialization && context;
process.exit(allPassed ? 0 : 1);
