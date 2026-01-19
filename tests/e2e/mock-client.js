/**
 * Mock Client - Deterministic AI client for testing
 * Returns predictable responses based on input patterns.
 */

/**
 * Default responses for common scenarios
 */
const DEFAULT_RESPONSES = {
  greeting: '[NARRATOR]\nThe scene begins.\n\n[SPEAKS: narrator]\n"Welcome, traveller."',
  narration: '[NARRATOR]\nThe story continues as expected.',
  dialogue: '[SPEAKS: npc]\n"I understand. Let me help you with that."',
  action: '[NARRATOR]\nYou complete the action successfully.',
  transition: '[NARRATOR]\nThe scene shifts.\n\n[SCENE: next-scene]'
};

/**
 * Scene-specific response mappings
 */
const SCENE_RESPONSES = {
  'scout-office': {
    default: '[NARRATOR]\nThe Scout Service office is busy with morning activity.\n\n[SPEAKS: mr-casarii]\n"Ah, you must be the new detached duty scout. I have your paperwork ready."',
    accept: '[NARRATOR]\nMr. Casarii hands you a datapad with your mission details.\n\n[SPEAKS: mr-casarii]\n"The Highndry awaits. Safe travels, Scout."\n\n[BEAT_COMPLETE: mission-accepted]'
  },
  'starport-arrival': {
    default: '[NARRATOR]\nThe customs officer examines your documents.\n\n[SPEAKS: customs-officer-walston]\n"Welcome to Walston. Purpose of visit?"',
    weapons: '[NARRATOR]\nYour weapons are checked and stored safely.\n\n[SPEAKS: customs-officer-walston]\n"Firearms secured. Here is your claim ticket."'
  },
  'meeting-greener': {
    default: '[NARRATOR]\nMinister Greener regards you with measured interest.\n\n[SPEAKS: minister-greener]\n"So you are the one claiming the stranded scout ship. Interesting."',
    negotiate: '[SPEAKS: minister-greener]\n"I can arrange transport to Mount Salbarii. In exchange, you will conduct a brief survey for me."'
  },
  'aftermath': {
    default: '[NARRATOR]\nWith the eruption subsiding, you survey the aftermath. The Highndry is yours.\n\n[BEAT_COMPLETE: adventure-complete]'
  }
};

/**
 * Hash function for deterministic responses
 * @param {string} str - Input string
 * @returns {number} Hash value
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Create a mock client with deterministic responses
 * @param {Object} options - Configuration options
 * @returns {Object} Mock client with chat method
 */
function createMockClient(options = {}) {
  const responseCache = new Map();
  const customResponses = options.responses || {};

  return {
    /**
     * Simulate chat completion
     * @param {string} prompt - System prompt or user message
     * @param {Object[]} messages - Message history (optional)
     * @returns {Object} Response object with content
     */
    chat(prompt, messages = []) {
      // Create cache key from input
      const cacheKey = JSON.stringify({ prompt, messages });

      // Return cached response if available
      if (responseCache.has(cacheKey)) {
        return responseCache.get(cacheKey);
      }

      // Determine response based on content
      let content = DEFAULT_RESPONSES.narration;

      // Check for scene-specific responses
      for (const [scene, responses] of Object.entries(SCENE_RESPONSES)) {
        if (prompt.includes(scene) || prompt.toLowerCase().includes(scene.replace(/-/g, ' '))) {
          content = responses.default;

          // Check for action-specific responses within scene
          const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
          if (lastMessage.includes('accept') && responses.accept) {
            content = responses.accept;
          } else if (lastMessage.includes('weapon') && responses.weapons) {
            content = responses.weapons;
          } else if (lastMessage.includes('negotiate') && responses.negotiate) {
            content = responses.negotiate;
          }
          break;
        }
      }

      // Check custom responses
      for (const [pattern, response] of Object.entries(customResponses)) {
        if (prompt.includes(pattern)) {
          content = response;
          break;
        }
      }

      // Check for common patterns
      const inputText = (prompt + ' ' + messages.map(m => m.content).join(' ')).toLowerCase();

      if (inputText.includes('greet') || inputText.includes('hello')) {
        content = DEFAULT_RESPONSES.greeting;
      } else if (inputText.includes('say') || inputText.includes('ask') || inputText.includes('talk')) {
        content = DEFAULT_RESPONSES.dialogue;
      } else if (inputText.includes('go to') || inputText.includes('travel') || inputText.includes('proceed')) {
        content = DEFAULT_RESPONSES.transition;
      }

      const response = { content };

      // Cache for determinism
      responseCache.set(cacheKey, response);

      return response;
    },

    /**
     * Clear response cache
     */
    clearCache() {
      responseCache.clear();
    },

    /**
     * Add custom response mapping
     * @param {string} pattern - Pattern to match
     * @param {string} response - Response to return
     */
    addResponse(pattern, response) {
      customResponses[pattern] = response;
    }
  };
}

/**
 * Create a recording client that logs all interactions
 * @returns {Object} Recording client
 */
function createRecordingClient() {
  const recordings = [];
  const mockClient = createMockClient();

  return {
    chat(prompt, messages) {
      const response = mockClient.chat(prompt, messages);
      recordings.push({
        timestamp: new Date().toISOString(),
        prompt,
        messages,
        response
      });
      return response;
    },

    getRecordings() {
      return recordings;
    },

    clearRecordings() {
      recordings.length = 0;
    }
  };
}

module.exports = {
  createMockClient,
  createRecordingClient,
  DEFAULT_RESPONSES,
  SCENE_RESPONSES
};
