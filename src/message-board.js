/**
 * Message Board System
 *
 * Handles threaded messaging between PCs and NPCs.
 * Threads stored as JSON files in data/threads/
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const THREADS_DIR = path.join(__dirname, '../data/threads');

/**
 * Generate a unique ID
 * @returns {string} Short unique ID
 */
function generateId() {
  return crypto.randomBytes(4).toString('hex');
}

/**
 * Get current Traveller date (DDD-YYYY format)
 * Maps real dates to Imperial calendar year 1105
 * @returns {string} Traveller date
 */
function getTravellerDate() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  const dayStr = String(dayOfYear).padStart(3, '0');
  return `${dayStr}-1105`;
}

/**
 * Ensure threads directory exists
 */
function ensureThreadsDir() {
  if (!fs.existsSync(THREADS_DIR)) {
    fs.mkdirSync(THREADS_DIR, { recursive: true });
  }
}

/**
 * Load a thread by ID
 * @param {string} threadId - Thread identifier
 * @returns {Object|null} Thread or null if not found
 */
function loadThread(threadId) {
  const filePath = path.join(THREADS_DIR, `${threadId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

/**
 * Save a thread
 * @param {Object} thread - Thread object
 */
function saveThread(thread) {
  ensureThreadsDir();
  const filePath = path.join(THREADS_DIR, `${thread.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(thread, null, 2));
}

/**
 * Create a new thread
 * @param {Object} from - Sender { type: 'pc'|'npc', id: string }
 * @param {Object} to - Recipient { type: 'pc'|'npc', id: string }
 * @param {string} subject - Thread subject
 * @param {string} content - Initial message content
 * @returns {Object} New thread with first message
 */
function createThread(from, to, subject, content) {
  const threadId = `thread-${generateId()}`;
  const messageId = `msg-${generateId()}`;
  const timestamp = new Date().toISOString();
  const gameDate = getTravellerDate();

  const thread = {
    id: threadId,
    subject,
    participants: [
      `${from.type}:${from.id}`,
      `${to.type}:${to.id}`
    ],
    created: timestamp,
    updated: timestamp,
    gameDate,
    messages: [
      {
        id: messageId,
        from,
        to,
        content,
        timestamp,
        gameDate,
        read: { [from.id]: true }
      }
    ]
  };

  saveThread(thread);
  return thread;
}

/**
 * Add a message to an existing thread
 * @param {string} threadId - Thread ID
 * @param {Object} from - Sender { type: 'pc'|'npc', id: string }
 * @param {string} content - Message content
 * @returns {Object} Updated thread
 */
function addMessage(threadId, from, content) {
  const thread = loadThread(threadId);
  if (!thread) {
    throw new Error(`Thread not found: ${threadId}`);
  }

  const messageId = `msg-${generateId()}`;
  const timestamp = new Date().toISOString();
  const gameDate = getTravellerDate();

  // Determine recipient (the other participant)
  const fromKey = `${from.type}:${from.id}`;
  const toKey = thread.participants.find(p => p !== fromKey);
  const [toType, toId] = toKey.split(':');

  const message = {
    id: messageId,
    from,
    to: { type: toType, id: toId },
    content,
    timestamp,
    gameDate,
    read: { [from.id]: true }
  };

  thread.messages.push(message);
  thread.updated = timestamp;

  saveThread(thread);
  return thread;
}

/**
 * Get all threads (for listing)
 * @returns {Object[]} Array of thread objects
 */
function getAllThreads() {
  ensureThreadsDir();
  const files = fs.readdirSync(THREADS_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const content = fs.readFileSync(path.join(THREADS_DIR, f), 'utf8');
    return JSON.parse(content);
  });
}

/**
 * Get threads involving a specific participant
 * @param {string} type - 'pc' or 'npc'
 * @param {string} id - Participant ID
 * @returns {Object[]} Filtered threads, newest first
 */
function getThreadsFor(type, id) {
  const key = `${type}:${id}`;
  return getAllThreads()
    .filter(t => t.participants.includes(key))
    .sort((a, b) => new Date(b.updated) - new Date(a.updated));
}

/**
 * Get inbox for a PC (threads they're involved in)
 * @param {string} pcId - PC identifier
 * @returns {Object[]} Threads with unread status
 */
function getInbox(pcId) {
  const threads = getThreadsFor('pc', pcId);

  return threads.map(t => {
    const lastMessage = t.messages[t.messages.length - 1];
    const unreadCount = t.messages.filter(m => !m.read[pcId]).length;

    // Get the other participant's name
    const otherKey = t.participants.find(p => p !== `pc:${pcId}`);
    const [otherType, otherId] = otherKey.split(':');

    return {
      id: t.id,
      subject: t.subject,
      otherParticipant: { type: otherType, id: otherId },
      lastMessage: lastMessage.content.slice(0, 50) + (lastMessage.content.length > 50 ? '...' : ''),
      lastDate: lastMessage.gameDate,
      unreadCount,
      messageCount: t.messages.length
    };
  });
}

/**
 * Mark messages in a thread as read for a participant
 * @param {string} threadId - Thread ID
 * @param {string} participantId - Who is reading
 */
function markThreadRead(threadId, participantId) {
  const thread = loadThread(threadId);
  if (!thread) return;

  thread.messages.forEach(msg => {
    if (!msg.read) msg.read = {};
    msg.read[participantId] = true;
  });

  saveThread(thread);
}

/**
 * Find existing thread between two participants on a subject
 * @param {string} participant1 - First participant key (type:id)
 * @param {string} participant2 - Second participant key (type:id)
 * @param {string} subject - Optional subject to match
 * @returns {Object|null} Existing thread or null
 */
function findThread(participant1, participant2, subject = null) {
  const threads = getAllThreads();
  return threads.find(t => {
    const hasParticipants = t.participants.includes(participant1) &&
      t.participants.includes(participant2);
    if (!hasParticipants) return false;
    if (subject && t.subject !== subject) return false;
    return true;
  }) || null;
}

/**
 * Get thread history formatted for NPC context
 * @param {string} threadId - Thread ID
 * @returns {Object[]} Messages formatted for prompt
 */
function getThreadHistory(threadId) {
  const thread = loadThread(threadId);
  if (!thread) return [];

  return thread.messages.map(m => ({
    role: m.from.type === 'npc' ? 'assistant' : 'user',
    content: m.content,
    from: m.from,
    gameDate: m.gameDate
  }));
}

module.exports = {
  generateId,
  getTravellerDate,
  loadThread,
  saveThread,
  createThread,
  addMessage,
  getAllThreads,
  getThreadsFor,
  getInbox,
  markThreadRead,
  findThread,
  getThreadHistory
};
