#!/usr/bin/env node
/**
 * Chat TUI Flow Tests
 *
 * Tests TUI operations with mocked AI client.
 * No actual API calls - tests command parsing, NPC switching, memory persistence.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Modules under test
const { loadPersona, listPersonas, getPersonaSummary } = require('../src/persona');
const { createMemory, addMessage, serialize, deserialize } = require('../src/memory');
const { assembleFullPrompt } = require('../src/prompts');
const { loadPC } = require('../src/pc-roster');

// Test data paths
const TEST_CONVERSATIONS_DIR = path.join(__dirname, '../data/conversations');

// Mock AI client - returns canned responses based on NPC
const mockResponses = {
  'minister-greener': "Let me be direct with you. I have a job that needs doing.",
  'customs-officer-walston': "Standard customs check. State your business.",
  'startown-bartender': "First time on Walston? Let me tell you a few things.",
  'dictator-masterton': "This is Dictator Masterton. What's the situation?",
  'captain-corelli': "Welcome aboard the Autumn Gold."
};

function mockChat(client, system, messages) {
  // Extract NPC name from system prompt
  const match = system.match(/You are ([^,]+),/);
  const name = match ? match[1] : 'Unknown';

  // Find matching mock response
  for (const [id, response] of Object.entries(mockResponses)) {
    const persona = getPersonaSummary(id);
    if (persona && persona.name === name) {
      return Promise.resolve({ content: response, usage: { input_tokens: 100, output_tokens: 50 } });
    }
  }

  return Promise.resolve({ content: "Hello.", usage: { input_tokens: 100, output_tokens: 10 } });
}

// Test utilities
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

// ============================================================
// Test Suites
// ============================================================

console.log('\n▸ World Filtering');

test('listPersonas returns all NPCs when no world specified', () => {
  const all = listPersonas();
  assert(all.length >= 5, `Expected at least 5 NPCs, got ${all.length}`);
});

test('listPersonas filters by world "Walston"', () => {
  const walston = listPersonas('Walston');
  assert(walston.length === 8, `Expected 8 Walston NPCs, got ${walston.length}`);
  assert(walston.includes('minister-greener'), 'Should include minister-greener');
  assert(walston.includes('narrator-high-and-dry'), 'Should include narrator');
  assert(walston.includes('alex-ryder-npc'), 'Should include alex-ryder-npc');
});

test('listPersonas filters by world "ISS Amishi"', () => {
  const amishi = listPersonas('ISS Amishi');
  assert(amishi.length >= 3, `Expected at least 3 Amishi NPCs, got ${amishi.length}`);
  assert(amishi.includes('anemone-lindqvist'), 'Should include anemone-lindqvist');
});

test('listPersonas is case-insensitive', () => {
  const lower = listPersonas('walston');
  const upper = listPersonas('WALSTON');
  assert.strictEqual(lower.length, upper.length, 'Case should not matter');
});

// ============================================================

console.log('\n▸ NPC Loading');

test('loadPersona loads minister-greener with full depth', () => {
  const p = loadPersona('minister-greener');
  assert.strictEqual(p.name, 'Alan Greener');
  assert.strictEqual(p.archetype, 'patron');
  assert(p.knowledge_base, 'Full-depth NPC should have knowledge_base');
  assert(p.knowledge_base.the_job, 'Should have the_job knowledge');
});

test('loadPersona loads captain-corelli with minimal depth', () => {
  const p = loadPersona('captain-corelli');
  assert.strictEqual(p.name, 'Michelle Corelli');
  assert.strictEqual(p.archetype, 'crew');
  // Minimal NPCs may not have knowledge_base
});

test('getPersonaSummary returns correct fields', () => {
  const s = getPersonaSummary('minister-greener');
  assert.strictEqual(s.id, 'minister-greener');
  assert.strictEqual(s.name, 'Alan Greener');
  assert.strictEqual(s.world, 'Walston');
  assert.strictEqual(s.archetype, 'patron');
});

// ============================================================

console.log('\n▸ PC Roster');

test('loadPC loads traveller-one', () => {
  const pc = loadPC('traveller-one');
  assert.strictEqual(pc.id, 'traveller-one');
  assert.strictEqual(pc.name, 'Traveller');
});

test('loadPC throws for unknown PC', () => {
  assert.throws(() => loadPC('nonexistent-pc'), /PC not found/);
});

// ============================================================

console.log('\n▸ Memory Operations');

test('createMemory initializes empty state', () => {
  const m = createMemory();
  assert.strictEqual(m.totalInteractions, 0);
  assert.deepStrictEqual(m.facts, []);
  assert.deepStrictEqual(m.recentMessages, []);
});

test('addMessage updates memory', () => {
  const m = createMemory();
  addMessage(m, 'user', 'Hello', '001-1105');
  assert.strictEqual(m.totalInteractions, 1);
  assert.strictEqual(m.recentMessages.length, 1);
  assert.strictEqual(m.firstContact, '001-1105');
});

test('serialize/deserialize roundtrips', () => {
  const m = createMemory();
  addMessage(m, 'user', 'Test message', '001-1105');
  addMessage(m, 'assistant', 'Response', '001-1105');

  const json = serialize(m);
  const restored = deserialize(json);

  assert.strictEqual(restored.totalInteractions, 2);
  assert.strictEqual(restored.recentMessages.length, 2);
});

// ============================================================

console.log('\n▸ Prompt Assembly');

test('assembleFullPrompt includes persona name', () => {
  const persona = loadPersona('minister-greener');
  const memory = createMemory();
  const result = assembleFullPrompt(persona, memory, 'Hello');

  assert(result.system.includes('Alan Greener'), 'System prompt should include NPC name');
  assert(result.system.includes('patron'), 'Should include archetype context');
});

test('assembleFullPrompt includes knowledge_base', () => {
  const persona = loadPersona('minister-greener');
  const memory = createMemory();
  const result = assembleFullPrompt(persona, memory, 'Tell me about the job');

  assert(result.system.includes('THE JOB'), 'Should include knowledge_base topics');
  assert(result.system.includes('Mount Salbarii'), 'Should include job details');
});

test('assembleFullPrompt adds user message to messages array', () => {
  const persona = loadPersona('minister-greener');
  const memory = createMemory();
  const result = assembleFullPrompt(persona, memory, 'What is the payment?');

  const lastMsg = result.messages[result.messages.length - 1];
  assert.strictEqual(lastMsg.role, 'user');
  assert(lastMsg.content.includes('payment'), 'Should include user message');
});

// ============================================================

console.log('\n▸ Mock Chat Flow');

asyncTest('mockChat returns appropriate response for minister-greener', async () => {
  const persona = loadPersona('minister-greener');
  const memory = createMemory();
  const assembled = assembleFullPrompt(persona, memory, 'Hello');

  const response = await mockChat(null, assembled.system, assembled.messages);

  assert(response.content.includes('direct'), 'Should return Greener-style response');
});

asyncTest('full chat flow with memory persistence', async () => {
  const npcId = 'minister-greener';
  const pcId = 'test-flow';
  const persona = loadPersona(npcId);
  let memory = createMemory();

  // Simulate conversation
  const userMsg = 'What job do you have for me?';
  const assembled = assembleFullPrompt(persona, memory, userMsg);
  const response = await mockChat(null, assembled.system, assembled.messages);

  // Update memory
  addMessage(memory, 'user', userMsg, '001-1105');
  addMessage(memory, 'assistant', response.content, '001-1105');

  // Verify memory state
  assert.strictEqual(memory.totalInteractions, 2);
  assert.strictEqual(memory.recentMessages.length, 2);

  // Simulate save/load cycle
  const saved = serialize(memory);
  const restored = deserialize(saved);

  assert.strictEqual(restored.totalInteractions, 2);
});

// ============================================================

console.log('\n▸ NPC Validation (All Walston NPCs)');

const walstonNpcs = listPersonas('Walston');
for (const npcId of walstonNpcs) {
  test(`${npcId} loads successfully`, () => {
    const p = loadPersona(npcId);
    assert(p.id, 'Should have id');
    assert(p.name, 'Should have name');
    assert(p.archetype, 'Should have archetype');
    assert(p.world === 'Walston', 'Should be in Walston world');
  });
}

// ============================================================

// Run async tests then report
setTimeout(() => {
  console.log('\n────────────────────────────────────────');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('────────────────────────────────────────\n');
  process.exit(failed > 0 ? 1 : 0);
}, 100);
