#!/usr/bin/env node
/**
 * Run Player Agent - CLI for autonomous adventure playthrough
 *
 * Usage:
 *   node scripts/run-player-agent.js high-and-dry alex-ryder
 *   node scripts/run-player-agent.js high-and-dry alex-ryder --max-turns 100 --verbose
 *   node scripts/run-player-agent.js high-and-dry alex-ryder --output report.json
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { playAdventure } = require('../src/agent-runner');
const { formatReportText, formatReportJson } = require('../src/agent-reporter');

// Parse command line arguments
const args = process.argv.slice(2);

function showUsage() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  AUTONOMOUS PLAYER AGENT                                      ║
╚══════════════════════════════════════════════════════════════╝

Usage:
  node scripts/run-player-agent.js <adventure-id> <player-id> [options]

Arguments:
  adventure-id    Adventure to play (e.g., 'high-and-dry')
  player-id       Player character ID (e.g., 'alex-ryder')

Options:
  --max-turns N   Maximum turns before stopping (default: 100)
  --verbose       Enable verbose output
  --output FILE   Save report to file (JSON format)
  --start-scene   Scene to start from (default: first scene)
  --json          Output report as JSON instead of text

Examples:
  node scripts/run-player-agent.js high-and-dry alex-ryder
  node scripts/run-player-agent.js high-and-dry alex-ryder --max-turns 50 --verbose
  node scripts/run-player-agent.js high-and-dry alex-ryder --output playthrough.json
`);
}

// Parse options
function parseArgs(args) {
  const options = {
    adventureId: null,
    playerId: null,
    maxTurns: 100,
    verbose: false,
    output: null,
    startScene: null,
    jsonOutput: false
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      showUsage();
      process.exit(0);
    } else if (arg === '--max-turns' && args[i + 1]) {
      options.maxTurns = parseInt(args[i + 1], 10) || 100;
      i += 2;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
      i++;
    } else if (arg === '--output' && args[i + 1]) {
      options.output = args[i + 1];
      i += 2;
    } else if (arg === '--start-scene' && args[i + 1]) {
      options.startScene = args[i + 1];
      i += 2;
    } else if (arg === '--json') {
      options.jsonOutput = true;
      i++;
    } else if (!arg.startsWith('-')) {
      if (!options.adventureId) {
        options.adventureId = arg;
      } else if (!options.playerId) {
        options.playerId = arg;
      }
      i++;
    } else {
      console.error(`Unknown option: ${arg}`);
      i++;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(args);

  if (!options.adventureId || !options.playerId) {
    showUsage();
    process.exit(1);
  }

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  AUTONOMOUS PLAYER AGENT                                      ║
╚══════════════════════════════════════════════════════════════╝

Adventure: ${options.adventureId}
Player: ${options.playerId}
Max Turns: ${options.maxTurns}
Verbose: ${options.verbose}
`);

  try {
    console.log('Starting autonomous playthrough...\n');

    const report = await playAdventure(options.adventureId, options.playerId, {
      maxTurns: options.maxTurns,
      verbose: options.verbose,
      startScene: options.startScene
    });

    // Output report
    if (options.jsonOutput) {
      console.log(formatReportJson(report));
    } else {
      console.log(formatReportText(report));
    }

    // Save to file if requested
    if (options.output) {
      const outputPath = path.resolve(options.output);
      fs.writeFileSync(outputPath, formatReportJson(report));
      console.log(`Report saved to: ${outputPath}`);
    }

    // Exit code based on result
    if (report.result === 'completed') {
      process.exit(0);
    } else if (report.result === 'stuck') {
      process.exit(2);
    } else {
      process.exit(1);
    }

  } catch (error) {
    console.error('Playthrough failed:', error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { parseArgs, main };
