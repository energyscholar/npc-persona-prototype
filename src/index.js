#!/usr/bin/env node
/**
 * NPC Persona CLI
 *
 * Interactive chat with AI-backed NPCs
 *
 * Usage:
 *   node src/index.js --npc marcus-chen
 *   node src/index.js --npc vera-santos --campaign my-campaign
 *   node src/index.js --list
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const { loadPersona, listPersonas } = require('./persona');
const { createMemory, addMessage, serialize, deserialize } = require('./memory');
const { assembleFullPrompt } = require('./prompts');
const { createClient, chat, getUsageStats } = require('./ai-client');

// Paths
const CONVERSATIONS_DIR = path.join(__dirname, '../data/conversations');
const BACKUPS_DIR = path.join(__dirname, '../backups');

// Parse arguments
const args = process.argv.slice(2);
const npcId = args.includes('--npc') ? args[args.indexOf('--npc') + 1] : null;
const campaignId = args.includes('--campaign') ? args[args.indexOf('--campaign') + 1] : 'default';
const listMode = args.includes('--list');
const restoreFile = args.includes('--restore') ? args[args.indexOf('--restore') + 1] : null;

/**
 * Get conversation file path
 */
function getConversationPath(npcId, campaignId) {
  const dir = path.join(CONVERSATIONS_DIR, npcId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, `${campaignId}.json`);
}

/**
 * Load existing conversation memory
 */
function loadConversation(npcId, campaignId) {
  const filePath = getConversationPath(npcId, campaignId);
  if (fs.existsSync(filePath)) {
    const json = fs.readFileSync(filePath, 'utf8');
    return deserialize(json);
  }
  return createMemory();
}

/**
 * Save conversation memory
 */
function saveConversation(npcId, campaignId, memory) {
  const filePath = getConversationPath(npcId, campaignId);
  fs.writeFileSync(filePath, serialize(memory));
}

/**
 * Create backup before destructive operations
 */
function createBackup(npcId, campaignId, memory) {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${timestamp}-${npcId}-${campaignId}.json`;
  const filePath = path.join(BACKUPS_DIR, filename);

  fs.writeFileSync(filePath, serialize(memory));
  return filePath;
}

/**
 * Restore from backup file
 */
function restoreFromBackup(backupPath) {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  const json = fs.readFileSync(backupPath, 'utf8');
  return deserialize(json);
}

/**
 * Print header
 */
function printHeader(persona) {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  ${persona.name.padEnd(60)}║`);
  console.log(`║  ${(persona.title + ' - ' + persona.world).padEnd(60)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log('Type your message and press Enter. Commands:');
  console.log('  /quit     - Exit and save');
  console.log('  /stats    - Show usage statistics');
  console.log('  /memory   - Show memory summary');
  console.log('  /backup   - Create manual backup');
  console.log('');
}

/**
 * Print memory summary
 */
function printMemorySummary(memory) {
  console.log('\n--- Memory Summary ---');
  console.log(`Total interactions: ${memory.totalInteractions}`);
  console.log(`First contact: ${memory.firstContact || 'none'}`);
  console.log(`Last contact: ${memory.lastContact || 'none'}`);
  console.log(`Facts stored: ${memory.facts.length}`);
  if (memory.facts.length > 0) {
    memory.facts.forEach(f => console.log(`  - ${f.type}: ${f.value}`));
  }
  console.log(`Recent messages: ${memory.recentMessages.length}`);
  console.log(`Has summary: ${memory.historySummary ? 'yes' : 'no'}`);
  console.log('');
}

/**
 * Main chat loop
 */
async function main() {
  // Handle --list
  if (listMode) {
    console.log('\nAvailable NPCs:');
    const npcs = listPersonas();
    if (npcs.length === 0) {
      console.log('  (none found - add JSON files to data/npcs/)');
    } else {
      npcs.forEach(id => {
        try {
          const p = loadPersona(id);
          console.log(`  ${id.padEnd(20)} - ${p.name} (${p.archetype})`);
        } catch {
          console.log(`  ${id.padEnd(20)} - (invalid)`);
        }
      });
    }
    console.log('');
    return;
  }

  // Require NPC selection
  if (!npcId) {
    console.log('\nUsage: node src/index.js --npc <npc-id> [--campaign <name>]');
    console.log('\nAvailable NPCs:');
    listPersonas().forEach(id => console.log(`  ${id}`));
    console.log('\nExample: node src/index.js --npc marcus-chen');
    return;
  }

  // Load persona
  let persona;
  try {
    persona = loadPersona(npcId);
  } catch (e) {
    console.error(`Error loading persona: ${e.message}`);
    process.exit(1);
  }

  // Load or restore memory
  let memory;
  if (restoreFile) {
    try {
      memory = restoreFromBackup(restoreFile);
      console.log(`Restored from: ${restoreFile}`);
    } catch (e) {
      console.error(`Error restoring: ${e.message}`);
      process.exit(1);
    }
  } else {
    memory = loadConversation(npcId, campaignId);
  }

  // Initialize API client
  let client;
  try {
    client = createClient();
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }

  // Print header
  printHeader(persona);

  if (memory.totalInteractions > 0) {
    console.log(`[Resuming conversation - ${memory.totalInteractions} previous interactions]\n`);
  }

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('\n\nSaving conversation...');
    saveConversation(npcId, campaignId, memory);
    console.log('Goodbye!\n');
    rl.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Chat loop
  const prompt = () => {
    rl.question('\x1b[36mYou:\x1b[0m ', async (input) => {
      const trimmed = input.trim();

      // Handle commands
      if (trimmed === '/quit' || trimmed === '/exit' || trimmed === '/q') {
        shutdown();
        return;
      }

      if (trimmed === '/stats') {
        const stats = getUsageStats();
        console.log('\n--- Usage Stats ---');
        console.log(`Requests today: ${stats.requestCount}`);
        console.log(`Spend today: $${stats.dailySpend}`);
        console.log(`Requests in window: ${stats.requestsInWindow}/30`);
        console.log('');
        prompt();
        return;
      }

      if (trimmed === '/memory') {
        printMemorySummary(memory);
        prompt();
        return;
      }

      if (trimmed === '/backup') {
        const backupPath = createBackup(npcId, campaignId, memory);
        console.log(`Backup created: ${backupPath}\n`);
        prompt();
        return;
      }

      if (!trimmed) {
        prompt();
        return;
      }

      // Get current date (use game date format)
      const gameDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\//g, '-');

      // Build prompt
      const assembled = assembleFullPrompt(persona, memory, trimmed);

      try {
        // Call Claude
        console.log(`\n\x1b[33m${persona.name}:\x1b[0m `, '(thinking...)');

        const response = await chat(client, assembled.system, assembled.messages);

        // Clear "thinking" and print response
        process.stdout.write('\x1b[1A\x1b[2K');
        console.log(`\x1b[33m${persona.name}:\x1b[0m ${response.content}\n`);

        // Update memory
        addMessage(memory, 'user', trimmed, gameDate);
        addMessage(memory, 'assistant', response.content, gameDate);

        // Auto-save
        saveConversation(npcId, campaignId, memory);

      } catch (e) {
        console.error(`\nError: ${e.message}\n`);
      }

      prompt();
    });
  };

  prompt();
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
