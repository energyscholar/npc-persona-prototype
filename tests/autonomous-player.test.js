/**
 * Autonomous Player Agent - Acceptance Tests
 *
 * Auditor: These tests encode invariants for CC playing through adventures.
 * Generator: Implement until all tests pass.
 */

const path = require('path');
const fs = require('fs');

const SRC_DIR = path.join(__dirname, '../src');
const SCRIPTS_DIR = path.join(__dirname, '../scripts');

// Module references (loaded in beforeAll)
let createPlayerAgent;
let playAdventure;
let generateReport;
let observeState;
let executeAgentAction;

describe('Autonomous Player Agent', () => {

  beforeAll(() => {
    // Load modules if they exist
    try {
      const playerAgent = require('../src/player-agent');
      createPlayerAgent = playerAgent.createPlayerAgent;
    } catch (e) { /* Not yet implemented */ }

    try {
      const agentRunner = require('../src/agent-runner');
      playAdventure = agentRunner.playAdventure;
      observeState = agentRunner.observeState;
      executeAgentAction = agentRunner.executeAgentAction;
    } catch (e) { /* Not yet implemented */ }

    try {
      const agentReporter = require('../src/agent-reporter');
      generateReport = agentReporter.generateReport;
    } catch (e) { /* Not yet implemented */ }
  });

  describe('Module existence', () => {

    test('player-agent.js exists', () => {
      expect(fs.existsSync(path.join(SRC_DIR, 'player-agent.js'))).toBe(true);
    });

    test('agent-runner.js exists', () => {
      expect(fs.existsSync(path.join(SRC_DIR, 'agent-runner.js'))).toBe(true);
    });

    test('agent-reporter.js exists', () => {
      expect(fs.existsSync(path.join(SRC_DIR, 'agent-reporter.js'))).toBe(true);
    });

    test('run-player-agent.js CLI exists', () => {
      expect(fs.existsSync(path.join(SCRIPTS_DIR, 'run-player-agent.js'))).toBe(true);
    });
  });

  describe('player-agent.js exports', () => {

    test('exports createPlayerAgent function', () => {
      expect(typeof createPlayerAgent).toBe('function');
    });

    test('createPlayerAgent returns agent with decide method', () => {
      const agent = createPlayerAgent();
      expect(typeof agent.decide).toBe('function');
    });

    test('createPlayerAgent returns agent with log method', () => {
      const agent = createPlayerAgent();
      expect(typeof agent.log).toBe('function');
    });

    test('createPlayerAgent returns agent with detectLoop method', () => {
      const agent = createPlayerAgent();
      expect(typeof agent.detectLoop).toBe('function');
    });

    test('createPlayerAgent returns agent with getHistory method', () => {
      const agent = createPlayerAgent();
      expect(typeof agent.getHistory).toBe('function');
    });
  });

  describe('agent-runner.js exports', () => {

    test('exports playAdventure function', () => {
      expect(typeof playAdventure).toBe('function');
    });

    test('exports observeState function', () => {
      expect(typeof observeState).toBe('function');
    });

    test('exports executeAgentAction function', () => {
      expect(typeof executeAgentAction).toBe('function');
    });
  });

  describe('agent-reporter.js exports', () => {

    test('exports generateReport function', () => {
      expect(typeof generateReport).toBe('function');
    });
  });

  describe('Agent decision structure', () => {

    test('agent.decide returns object with action field', async () => {
      const agent = createPlayerAgent();
      const mockObservation = {
        scene: { id: 'test-scene', description: 'Test', availableActions: ['test'] },
        flags: [],
        inventory: { carried: [], stored: {} },
        recentHistory: [],
        currentGoal: 'Test goal',
        npcPresent: []
      };

      const decision = await agent.decide(mockObservation);
      expect(decision).toHaveProperty('action');
    });

    test('agent.decide returns object with reasoning field', async () => {
      const agent = createPlayerAgent();
      const mockObservation = {
        scene: { id: 'test-scene', description: 'Test', availableActions: ['test'] },
        flags: [],
        inventory: { carried: [], stored: {} },
        recentHistory: [],
        currentGoal: 'Test goal',
        npcPresent: []
      };

      const decision = await agent.decide(mockObservation);
      expect(decision).toHaveProperty('reasoning');
    });

    test('agent.decide returns object with concerns field', async () => {
      const agent = createPlayerAgent();
      const mockObservation = {
        scene: { id: 'test-scene', description: 'Test', availableActions: ['test'] },
        flags: [],
        inventory: { carried: [], stored: {} },
        recentHistory: [],
        currentGoal: 'Test goal',
        npcPresent: []
      };

      const decision = await agent.decide(mockObservation);
      expect(decision).toHaveProperty('concerns');
    });
  });

  describe('Loop detection', () => {

    test('detectLoop returns false with no history', () => {
      const agent = createPlayerAgent();
      expect(agent.detectLoop()).toBe(false);
    });

    test('detectLoop returns true after 3+ identical actions', () => {
      const agent = createPlayerAgent();
      const sameAction = { action: 'wait', scene: 'test-scene' };

      agent.log({ action: sameAction, observation: {}, result: {} });
      agent.log({ action: sameAction, observation: {}, result: {} });
      agent.log({ action: sameAction, observation: {}, result: {} });

      expect(agent.detectLoop()).toBe(true);
    });

    test('detectLoop returns false with varied actions', () => {
      const agent = createPlayerAgent();

      agent.log({ action: { action: 'talk', target: 'npc1' }, observation: {}, result: {} });
      agent.log({ action: { action: 'move', target: 'scene2' }, observation: {}, result: {} });
      agent.log({ action: { action: 'examine' }, observation: {}, result: {} });

      expect(agent.detectLoop()).toBe(false);
    });
  });

  describe('Observation structure', () => {

    test('observeState returns scene info', async () => {
      const mockSession = {
        storyState: { currentScene: 'scout-office', flags: {} },
        inventory: { carried: [], stored: {} }
      };

      const obs = await observeState(mockSession);
      expect(obs).toHaveProperty('scene');
      expect(obs.scene).toHaveProperty('id');
    });

    test('observeState returns flags array', async () => {
      const mockSession = {
        storyState: { currentScene: 'test', flags: { flag1: true, flag2: false } },
        inventory: { carried: [], stored: {} }
      };

      const obs = await observeState(mockSession);
      expect(Array.isArray(obs.flags)).toBe(true);
    });

    test('observeState returns inventory', async () => {
      const mockSession = {
        storyState: { currentScene: 'test', flags: {} },
        inventory: { carried: ['item1'], stored: { loc: ['item2'] } }
      };

      const obs = await observeState(mockSession);
      expect(obs).toHaveProperty('inventory');
      expect(obs.inventory).toHaveProperty('carried');
      expect(obs.inventory).toHaveProperty('stored');
    });
  });

  describe('Report generation', () => {

    test('generateReport returns result field', () => {
      const mockHistory = [
        { action: { action: 'talk' }, observation: { scene: { id: 's1' } }, result: {} }
      ];
      const report = generateReport(mockHistory, { completed: true });

      expect(report).toHaveProperty('result');
      expect(['completed', 'stuck', 'failed', 'abandoned']).toContain(report.result);
    });

    test('generateReport returns turns count', () => {
      const mockHistory = [
        { action: {}, observation: {}, result: {} },
        { action: {}, observation: {}, result: {} },
        { action: {}, observation: {}, result: {} }
      ];
      const report = generateReport(mockHistory, {});

      expect(report.turns).toBe(3);
    });

    test('generateReport returns scenesVisited array', () => {
      const mockHistory = [
        { action: {}, observation: { scene: { id: 'scene1' } }, result: {} },
        { action: {}, observation: { scene: { id: 'scene2' } }, result: {} },
        { action: {}, observation: { scene: { id: 'scene1' } }, result: {} }
      ];
      const report = generateReport(mockHistory, {});

      expect(Array.isArray(report.scenesVisited)).toBe(true);
      expect(report.scenesVisited).toContain('scene1');
      expect(report.scenesVisited).toContain('scene2');
    });

    test('generateReport returns concerns array', () => {
      const mockHistory = [
        { action: { concerns: 'Confusing NPC response' }, observation: { scene: { id: 's1' } }, result: {} },
        { action: { concerns: 'none' }, observation: { scene: { id: 's1' } }, result: {} }
      ];
      const report = generateReport(mockHistory, {});

      expect(Array.isArray(report.concerns)).toBe(true);
      expect(report.concerns.length).toBeGreaterThan(0);
    });

    test('generateReport filters out "none" concerns', () => {
      const mockHistory = [
        { action: { concerns: 'none' }, observation: { scene: { id: 's1' } }, result: {} },
        { action: { concerns: 'None' }, observation: { scene: { id: 's1' } }, result: {} }
      ];
      const report = generateReport(mockHistory, {});

      expect(report.concerns.length).toBe(0);
    });
  });

  describe('Action execution', () => {

    test('executeAgentAction handles talk action', async () => {
      const mockSession = { storyState: { currentScene: 'test' } };
      const action = { action: 'talk', target: 'test-npc', message: 'Hello' };

      // Should not throw
      const result = await executeAgentAction(mockSession, action);
      expect(result).toBeDefined();
    });

    test('executeAgentAction handles move action', async () => {
      const mockSession = { storyState: { currentScene: 'scene1' } };
      const action = { action: 'move', target: 'scene2' };

      const result = await executeAgentAction(mockSession, action);
      expect(result).toBeDefined();
    });

    test('executeAgentAction handles choice action', async () => {
      const mockSession = { storyState: { currentScene: 'test' } };
      const action = { action: 'choice', target: 'accept_mission' };

      const result = await executeAgentAction(mockSession, action);
      expect(result).toBeDefined();
    });
  });

  describe('Integration: Scout Office scene', () => {

    test('agent can observe scout-office scene', async () => {
      // Requires real adventure state
      const { loadAdventure } = require('../src/adventure-player');
      const adventure = loadAdventure('high-and-dry');

      const mockSession = {
        adventure,
        storyState: { currentScene: 'scout-office', flags: {} },
        inventory: { carried: [], stored: {} }
      };

      const obs = await observeState(mockSession);
      expect(obs.scene.id).toBe('scout-office');
    });

    test('agent produces valid action for scout-office', async () => {
      const agent = createPlayerAgent();
      const observation = {
        scene: {
          id: 'scout-office',
          description: 'You are in the Scout Office. Jeri Tallux offers you a mission.',
          availableActions: ['talk jeri-tallux', 'accept_mission', 'decline_mission', 'leave']
        },
        flags: [],
        inventory: { carried: [], stored: {} },
        recentHistory: [],
        currentGoal: 'Accept mission to find the downed scout ship',
        npcPresent: ['jeri-tallux']
      };

      const decision = await agent.decide(observation);
      expect(decision.action).toBeDefined();
      // Action should be one of the available ones or a talk action
      const validActions = ['talk', 'accept_mission', 'decline_mission', 'leave', 'examine'];
      const actionType = decision.action.action || decision.action;
      expect(validActions.some(v => actionType.includes(v) || v.includes(actionType))).toBe(true);
    });
  });

  describe('CLI script', () => {

    test('run-player-agent.js is executable', () => {
      const scriptPath = path.join(SCRIPTS_DIR, 'run-player-agent.js');
      const content = fs.readFileSync(scriptPath, 'utf8');
      // Should have shebang or be requireable
      expect(content.includes('require') || content.startsWith('#!')).toBe(true);
    });

    test('run-player-agent.js imports required modules', () => {
      const scriptPath = path.join(SCRIPTS_DIR, 'run-player-agent.js');
      const content = fs.readFileSync(scriptPath, 'utf8');

      expect(content.includes('player-agent') || content.includes('playAdventure')).toBe(true);
    });
  });
});
