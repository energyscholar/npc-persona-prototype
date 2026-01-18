/**
 * Resource lookup module
 * Provides dynamic resource queries for narrator improvisation
 */

const path = require('path');
const fs = require('fs');

// Cache for loaded resources
const resourceCache = new Map();

/**
 * Load resources data for an adventure
 */
function loadResources(adventureId) {
  if (resourceCache.has(adventureId)) {
    return resourceCache.get(adventureId);
  }

  const resourcePath = path.join(
    __dirname,
    '../data/adventures',
    adventureId,
    'resources/walston-resources.json'
  );

  if (!fs.existsSync(resourcePath)) {
    return null;
  }

  const data = JSON.parse(fs.readFileSync(resourcePath, 'utf8'));
  resourceCache.set(adventureId, data);
  return data;
}

/**
 * Get available resources by category and optional location
 * @param {string} adventureId - Adventure ID
 * @param {string} category - Resource category (transportation, equipment, services)
 * @param {string} [location] - Optional location filter
 * @returns {Object[]} Array of available resource sources
 */
function getAvailableResources(adventureId, category, location) {
  const resources = loadResources(adventureId);
  if (!resources || !resources[category]) {
    return [];
  }

  const categoryData = resources[category];
  const results = [];

  // Iterate through subcategories (air_vehicles, ground_vehicles, etc.)
  for (const [subcat, subcatData] of Object.entries(categoryData)) {
    if (subcatData.sources) {
      for (const source of subcatData.sources) {
        // If location specified, filter by it
        if (location) {
          if (source.location === location ||
              source.availability?.toLowerCase().includes(location.toLowerCase())) {
            results.push({
              ...source,
              category: subcat,
              availability_level: subcatData.availability
            });
          }
        } else {
          results.push({
            ...source,
            category: subcat,
            availability_level: subcatData.availability
          });
        }
      }
    }
  }

  return results;
}

/**
 * Check if a PC can obtain a specific resource
 * @param {string} adventureId - Adventure ID
 * @param {string} resourceId - Resource ID to check
 * @param {Object} pcSkills - PC's skills object
 * @param {number} pcCredits - PC's available credits
 * @returns {Object} Availability result with reason
 */
function canPCObtain(adventureId, resourceId, pcSkills = {}, pcCredits = 0) {
  const resources = loadResources(adventureId);
  if (!resources) {
    return { available: false, reason: 'Resources not found' };
  }

  // Search for resource by ID
  const resource = findResourceById(resources, resourceId);
  if (!resource) {
    return { available: false, reason: 'Resource not found' };
  }

  // Check cost if applicable
  if (resource.cost) {
    const costMatch = resource.cost.match(/Cr(\d+)/);
    if (costMatch && parseInt(costMatch[1]) > pcCredits) {
      return { available: false, reason: `Insufficient credits (need Cr${costMatch[1]})` };
    }
  }

  // Check special requirements
  if (resource.availability === 'Emergency only, requires Masterton\'s approval') {
    return { available: false, reason: 'Requires government approval' };
  }

  if (resource.availability === 'Must retrieve from crash site') {
    return { available: false, reason: 'Must retrieve from Highndry crash site' };
  }

  return { available: true, resource };
}

/**
 * Find a resource by ID across all categories
 */
function findResourceById(resources, resourceId) {
  for (const category of Object.values(resources)) {
    if (typeof category !== 'object') continue;
    for (const subcategory of Object.values(category)) {
      if (subcategory.sources) {
        const found = subcategory.sources.find(s => s.id === resourceId);
        if (found) return found;
      }
    }
  }
  return null;
}

/**
 * Suggest alternatives for a requested resource
 * @param {string} adventureId - Adventure ID
 * @param {string} requestedResource - What the PC asked for
 * @returns {string[]} Array of alternative resource IDs/descriptions
 */
function suggestAlternatives(adventureId, requestedResource) {
  const resources = loadResources(adventureId);
  if (!resources) {
    return [];
  }

  const requested = requestedResource.toLowerCase();
  const alternatives = [];

  // Map common requests to resource categories
  const airRequests = ['helicopter', 'aircraft', 'plane', 'flying', 'aerial', 'fly'];
  const groundRequests = ['car', 'vehicle', 'transport', 'ride'];
  const boatRequests = ['boat', 'ship', 'water'];

  if (airRequests.some(r => requested.includes(r))) {
    // Suggest air alternatives
    const airVehicles = resources.transportation?.air_vehicles?.sources || [];
    for (const av of airVehicles) {
      alternatives.push(av.id);
    }
    // Also suggest ground as fallback
    alternatives.push('atv-rental');
    alternatives.push('Consider hiring guide with ATV to reach destination by ground');
  } else if (groundRequests.some(r => requested.includes(r))) {
    const groundVehicles = resources.transportation?.ground_vehicles?.sources || [];
    for (const gv of groundVehicles) {
      alternatives.push(gv.id);
    }
  } else if (boatRequests.some(r => requested.includes(r))) {
    const waterVehicles = resources.transportation?.water?.sources || [];
    for (const wv of waterVehicles) {
      alternatives.push(wv.id);
    }
  }

  // If no matches, return general transportation options
  if (alternatives.length === 0) {
    alternatives.push('atv-rental');
    alternatives.push('rail-service');
    alternatives.push('local-guide');
  }

  return alternatives;
}

/**
 * Get narrator redirect text for a resource type
 * @param {string} adventureId - Adventure ID
 * @param {string} resourceType - Type of resource (e.g., 'air_vehicles')
 * @returns {string|null} Redirect suggestion for narrator
 */
function getNarratorRedirect(adventureId, resourceType) {
  const resources = loadResources(adventureId);
  if (!resources) {
    return null;
  }

  // Search through categories for narrator_redirect
  for (const category of Object.values(resources)) {
    if (typeof category !== 'object') continue;
    if (category[resourceType]?.narrator_redirect) {
      return category[resourceType].narrator_redirect;
    }
  }

  return null;
}

/**
 * Clear cache (for testing)
 */
function clearCache() {
  resourceCache.clear();
}

module.exports = {
  loadResources,
  getAvailableResources,
  canPCObtain,
  suggestAlternatives,
  getNarratorRedirect,
  clearCache
};
