/**
 * Campaign Filtering Tests
 *
 * Auditor: These tests encode the invariants for campaign-aware NPC filtering.
 * Generator: Implement until all tests pass.
 */

const path = require('path');
const fs = require('fs');

// Module under test - will be implemented
let listPersonasByCampaign;
let displayCampaignMenu;

// Mock data paths
const DATA_DIR = path.join(__dirname, '../data/npcs');
const CAMPAIGNS_PATH = path.join(__dirname, '../data/campaigns/campaigns.json');

describe('Campaign Filtering System', () => {

  beforeAll(() => {
    // Load modules after they exist
    try {
      const persona = require('../src/persona');
      listPersonasByCampaign = persona.listPersonasByCampaign;
    } catch (e) {
      // Function not yet implemented
    }

    try {
      const tuiMenu = require('../src/tui-menu');
      displayCampaignMenu = tuiMenu.displayCampaignMenu;
    } catch (e) {
      // Function not yet implemented
    }
  });

  describe('listPersonasByCampaign', () => {

    test('function exists and is exported', () => {
      expect(typeof listPersonasByCampaign).toBe('function');
    });

    test('returns array of NPC IDs for solo-high-and-dry campaign', () => {
      const npcs = listPersonasByCampaign('solo-high-and-dry');
      expect(Array.isArray(npcs)).toBe(true);
      expect(npcs.length).toBeGreaterThan(0);
    });

    test('returns array of NPC IDs for tuesday-spinward-marches campaign', () => {
      const npcs = listPersonasByCampaign('tuesday-spinward-marches');
      expect(Array.isArray(npcs)).toBe(true);
      expect(npcs.length).toBeGreaterThan(0);
    });

    test('solo campaign includes captain-corelli', () => {
      const npcs = listPersonasByCampaign('solo-high-and-dry');
      expect(npcs).toContain('captain-corelli');
    });

    test('solo campaign includes minister-greener', () => {
      const npcs = listPersonasByCampaign('solo-high-and-dry');
      expect(npcs).toContain('minister-greener');
    });

    test('tuesday campaign includes vera-santos', () => {
      const npcs = listPersonasByCampaign('tuesday-spinward-marches');
      expect(npcs).toContain('vera-santos');
    });

    test('tuesday campaign includes anemone-lindqvist', () => {
      const npcs = listPersonasByCampaign('tuesday-spinward-marches');
      expect(npcs).toContain('anemone-lindqvist');
    });

    test('system NPC (assistant-gm) appears in solo campaign', () => {
      const npcs = listPersonasByCampaign('solo-high-and-dry');
      expect(npcs).toContain('assistant-gm');
    });

    test('system NPC (assistant-gm) appears in tuesday campaign', () => {
      const npcs = listPersonasByCampaign('tuesday-spinward-marches');
      expect(npcs).toContain('assistant-gm');
    });

    test('CROSS-LEAK: vera-santos NOT in solo campaign', () => {
      const npcs = listPersonasByCampaign('solo-high-and-dry');
      expect(npcs).not.toContain('vera-santos');
    });

    test('CROSS-LEAK: anemone-lindqvist NOT in solo campaign', () => {
      const npcs = listPersonasByCampaign('solo-high-and-dry');
      expect(npcs).not.toContain('anemone-lindqvist');
    });

    test('CROSS-LEAK: captain-corelli NOT in tuesday campaign', () => {
      const npcs = listPersonasByCampaign('tuesday-spinward-marches');
      expect(npcs).not.toContain('captain-corelli');
    });

    test('CROSS-LEAK: minister-greener NOT in tuesday campaign', () => {
      const npcs = listPersonasByCampaign('tuesday-spinward-marches');
      expect(npcs).not.toContain('minister-greener');
    });

    test('returns empty array for unknown campaign', () => {
      const npcs = listPersonasByCampaign('nonexistent-campaign');
      // Should only return system NPCs
      expect(npcs.length).toBeLessThanOrEqual(1);
    });

    test('handles null campaignId gracefully', () => {
      expect(() => listPersonasByCampaign(null)).not.toThrow();
    });

    test('solo campaign has expected count (10-11 NPCs)', () => {
      const npcs = listPersonasByCampaign('solo-high-and-dry');
      // 10 solo NPCs + 1 system = 11, or 9 if alex-ryder moved
      expect(npcs.length).toBeGreaterThanOrEqual(10);
      expect(npcs.length).toBeLessThanOrEqual(12);
    });

    test('tuesday campaign has expected count (34 NPCs)', () => {
      const npcs = listPersonasByCampaign('tuesday-spinward-marches');
      // 33 tuesday NPCs + 1 system = 34
      expect(npcs.length).toBe(34);
    });
  });

  describe('campaigns.json', () => {

    test('campaigns.json file exists', () => {
      expect(fs.existsSync(CAMPAIGNS_PATH)).toBe(true);
    });

    test('campaigns.json is valid JSON', () => {
      const content = fs.readFileSync(CAMPAIGNS_PATH, 'utf8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    test('contains solo-high-and-dry campaign', () => {
      const campaigns = JSON.parse(fs.readFileSync(CAMPAIGNS_PATH, 'utf8'));
      expect(campaigns['solo-high-and-dry']).toBeDefined();
    });

    test('contains tuesday-spinward-marches campaign', () => {
      const campaigns = JSON.parse(fs.readFileSync(CAMPAIGNS_PATH, 'utf8'));
      expect(campaigns['tuesday-spinward-marches']).toBeDefined();
    });

    test('campaigns have required fields', () => {
      const campaigns = JSON.parse(fs.readFileSync(CAMPAIGNS_PATH, 'utf8'));
      for (const [id, campaign] of Object.entries(campaigns)) {
        expect(campaign.id).toBe(id);
        expect(campaign.name).toBeDefined();
        expect(typeof campaign.name).toBe('string');
      }
    });
  });

  describe('displayCampaignMenu', () => {

    test('function exists and is exported', () => {
      expect(typeof displayCampaignMenu).toBe('function');
    });

    test('returns string output', () => {
      const campaigns = [
        { id: 'test', name: 'Test Campaign' }
      ];
      const output = displayCampaignMenu(campaigns);
      expect(typeof output).toBe('string');
    });

    test('includes campaign names in output', () => {
      const campaigns = [
        { id: 'solo', name: 'High and Dry' },
        { id: 'tuesday', name: 'Tuesday Game' }
      ];
      const output = displayCampaignMenu(campaigns);
      expect(output).toContain('High and Dry');
      expect(output).toContain('Tuesday Game');
    });

    test('includes numbered options', () => {
      const campaigns = [
        { id: 'solo', name: 'High and Dry' },
        { id: 'tuesday', name: 'Tuesday Game' }
      ];
      const output = displayCampaignMenu(campaigns);
      expect(output).toContain('1.');
      expect(output).toContain('2.');
    });
  });
});
