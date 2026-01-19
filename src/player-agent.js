/**
 * Player Agent - Autonomous decision engine for playing adventures
 *
 * Creates an AI agent that can observe game state and decide on actions.
 */

require('dotenv').config();

const { createClient, chat } = require('./ai-client');

const PLAYER_AGENT_SYSTEM = `You are Alex Ryder, playing through the High and Dry adventure.

Your goals:
1. Complete the mission (find and claim the downed scout ship)
2. Explore thoroughly but don't get stuck
3. Be a "reasonable player" - make choices a typical player would make
4. Note when things are confusing, inconsistent, or frustrating

When given a situation, respond ONLY with valid JSON in this exact format:
{
  "action": "ACTION_TYPE target_or_details",
  "reasoning": "Brief explanation of why you chose this action",
  "concerns": "Any issues noticed, or 'none' if everything seems fine"
}

ACTION_TYPE must be one of:
- talk NPC_ID "message" - Talk to an NPC
- choice CHOICE_ID - Select a menu option
- move SCENE_ID - Go to a different scene
- examine - Look around or at something
- inventory - Check your items
- wait - Pass time

Example response:
{
  "action": "talk mr-casarii \"Hello, I'm here about my ship inheritance.\"",
  "reasoning": "Mr. Casarii is the NPC present and this is the scout office - I should ask about my ship",
  "concerns": "none"
}`;

/**
 * Create a player agent instance
 * @param {Object} [options] - Configuration options
 * @param {number} [options.maxTurns=100] - Maximum turns before stopping
 * @param {boolean} [options.verbose=false] - Enable verbose logging
 * @returns {Object} Agent instance with decide, log, detectLoop, getHistory methods
 */
function createPlayerAgent(options = {}) {
  const { maxTurns = 100, verbose = false } = options;

  const history = [];
  let client = null;
  let turnCount = 0;

  /**
   * Initialize AI client lazily
   */
  function getClient() {
    if (!client) {
      client = createClient();
    }
    return client;
  }

  /**
   * Decide next action based on observation
   * @param {Object} observation - Current game state observation
   * @returns {Promise<Object>} Decision with action, reasoning, concerns
   */
  async function decide(observation) {
    const prompt = formatObservationPrompt(observation);

    try {
      const aiClient = getClient();
      const response = await chat(aiClient, PLAYER_AGENT_SYSTEM, prompt, {
        model: 'haiku', // Use fast model for agent decisions
        maxTokens: 500
      });

      // Parse JSON response
      const decision = parseAgentResponse(response);

      if (verbose) {
        console.log(`[Agent] Action: ${decision.action}`);
        console.log(`[Agent] Reasoning: ${decision.reasoning}`);
      }

      return decision;
    } catch (error) {
      // Fallback decision if AI fails
      return {
        action: 'examine',
        reasoning: 'AI decision failed, examining surroundings as fallback',
        concerns: `AI error: ${error.message}`
      };
    }
  }

  /**
   * Format observation into prompt for AI
   */
  function formatObservationPrompt(observation) {
    const sceneInfo = observation.scene || {};
    const flags = observation.flags || [];
    const history = observation.recentHistory || [];
    const npcs = observation.npcPresent || [];
    const goal = observation.currentGoal || 'Complete the adventure';

    let prompt = `CURRENT SITUATION:

Scene: ${sceneInfo.id || 'unknown'}
Description: ${sceneInfo.description || 'No description available'}

Available Actions: ${(sceneInfo.availableActions || []).join(', ') || 'none specified'}

NPCs Present: ${npcs.length > 0 ? npcs.join(', ') : 'none'}

Current Goal: ${goal}

Active Flags: ${flags.length > 0 ? flags.join(', ') : 'none'}`;

    if (history.length > 0) {
      prompt += `\n\nRecent History:`;
      history.slice(-5).forEach(h => {
        prompt += `\n- Turn ${h.turn}: ${h.action} → ${h.response || 'ok'}`;
      });
    }

    prompt += `\n\nWhat do you do next? Respond with JSON only.`;

    return prompt;
  }

  /**
   * Parse agent response into structured decision
   */
  function parseAgentResponse(response) {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          action: parsed.action || 'examine',
          reasoning: parsed.reasoning || 'No reasoning provided',
          concerns: parsed.concerns || 'none'
        };
      }
    } catch (e) {
      // Parse failed
    }

    // Fallback: try to extract action from plain text
    return {
      action: response.trim().split('\n')[0] || 'examine',
      reasoning: 'Could not parse structured response',
      concerns: 'Response parsing failed'
    };
  }

  /**
   * Log a turn's action, observation, and result
   * @param {Object} entry - { action, observation, result }
   */
  function log(entry) {
    turnCount++;
    history.push({
      turn: turnCount,
      timestamp: new Date().toISOString(),
      ...entry
    });
  }

  /**
   * Detect if agent is stuck in a loop
   * @returns {boolean} True if repeating same action 3+ times
   */
  function detectLoop() {
    if (history.length < 3) return false;

    const recent = history.slice(-3);
    const actions = recent.map(h => {
      const action = h.action;
      if (typeof action === 'object') {
        return JSON.stringify(action);
      }
      return String(action);
    });

    // Check if all 3 recent actions are identical
    return actions.every(a => a === actions[0]);
  }

  /**
   * Get action history
   * @returns {Object[]} Array of logged entries
   */
  function getHistory() {
    return [...history];
  }

  /**
   * Get turn count
   * @returns {number} Current turn count
   */
  function getTurnCount() {
    return turnCount;
  }

  /**
   * Check if max turns exceeded
   * @returns {boolean}
   */
  function isMaxTurnsExceeded() {
    return turnCount >= maxTurns;
  }

  return {
    decide,
    log,
    detectLoop,
    getHistory,
    getTurnCount,
    isMaxTurnsExceeded
  };
}

module.exports = {
  createPlayerAgent,
  PLAYER_AGENT_SYSTEM
};
