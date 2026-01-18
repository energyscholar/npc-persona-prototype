/**
 * PC Inventory System
 * Tracks items that unlock barriers and enable actions
 */

/**
 * Initialize inventory on storyState
 * @param {Object} storyState - Story state object
 * @returns {Array} The inventory array
 */
function initializeInventory(storyState) {
  storyState.inventory = storyState.inventory || [];
  return storyState.inventory;
}

/**
 * Add item to inventory
 * @param {Object} session - Session object with storyState
 * @param {Object} item - Item to add
 * @returns {boolean} True if added, false if duplicate
 */
function addToInventory(session, item) {
  const inv = session.storyState.inventory;
  if (!inv.find(i => i.id === item.id)) {
    inv.push({
      ...item,
      acquired_at: new Date().toISOString(),
      acquired_scene: session.storyState.currentScene
    });
    return true;
  }
  return false; // Already have it
}

/**
 * Check if inventory contains item
 * @param {Object} session - Session object
 * @param {string} itemId - Item ID to check
 * @returns {boolean} True if item is in inventory
 */
function hasItem(session, itemId) {
  return session.storyState.inventory.some(i => i.id === itemId);
}

/**
 * Get all items of a specific type
 * @param {Object} session - Session object
 * @param {string} type - Item type to filter by
 * @returns {Array} Items matching the type
 */
function getItemsOfType(session, type) {
  return session.storyState.inventory.filter(i => i.type === type);
}

/**
 * Check if any item unlocks a specific key
 * @param {Object} session - Session object
 * @param {string} unlockKey - Key to check
 * @returns {boolean} True if any item unlocks this key
 */
function checkUnlock(session, unlockKey) {
  return session.storyState.inventory.some(i =>
    i.unlocks && i.unlocks.includes(unlockKey)
  );
}

/**
 * Get all cargo items
 * @param {Object} session - Session object
 * @returns {Array} Cargo items
 */
function getCargoItems(session) {
  return session.storyState.inventory.filter(i => i.type === 'cargo');
}

/**
 * Get human-readable description of inventory
 * @param {Object} session - Session object
 * @returns {string} Inventory description
 */
function describeInventory(session) {
  const inv = session.storyState.inventory;
  if (inv.length === 0) return "You're not carrying anything notable.";

  const docs = inv.filter(i => i.type === 'document');
  const cargo = inv.filter(i => i.type === 'cargo');
  const other = inv.filter(i => !['document', 'cargo'].includes(i.type));

  let desc = '';
  if (docs.length) desc += `Documents: ${docs.map(d => d.name).join(', ')}\n`;
  if (cargo.length) desc += `Cargo: ${cargo.map(c => c.name).join(', ')}\n`;
  if (other.length) desc += `Other: ${other.map(o => o.name).join(', ')}\n`;

  return desc.trim();
}

module.exports = {
  initializeInventory,
  addToInventory,
  hasItem,
  getItemsOfType,
  checkUnlock,
  getCargoItems,
  describeInventory
};
