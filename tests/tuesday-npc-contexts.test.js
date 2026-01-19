/**
 * Tuesday Campaign NPC Contexts Tests
 *
 * Auditor: These tests encode the invariants for location-aware NPC contexts.
 * Generator: Implement until all tests pass.
 */

const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../data/npcs');

// Module under test
let getContextsForNpc;
let CAMPAIGN_CONTEXTS;
let loadPersona;

describe('Tuesday Campaign NPC Contexts', () => {

  beforeAll(() => {
    try {
      const campaignContexts = require('../src/campaign-contexts');
      getContextsForNpc = campaignContexts.getContextsForNpc;
      CAMPAIGN_CONTEXTS = campaignContexts.CAMPAIGN_CONTEXTS;
    } catch (e) {
      // Module not yet implemented
    }

    try {
      const persona = require('../src/persona');
      loadPersona = persona.loadPersona;
    } catch (e) {
      // Already exists
    }
  });

  describe('campaign-contexts.js module', () => {

    test('module exports getContextsForNpc function', () => {
      expect(typeof getContextsForNpc).toBe('function');
    });

    test('module exports CAMPAIGN_CONTEXTS object', () => {
      expect(typeof CAMPAIGN_CONTEXTS).toBe('object');
    });

    test('CAMPAIGN_CONTEXTS has tuesday-spinward-marches', () => {
      expect(CAMPAIGN_CONTEXTS['tuesday-spinward-marches']).toBeDefined();
    });

    test('tuesday campaign has amishi (shipboard) contexts', () => {
      expect(CAMPAIGN_CONTEXTS['tuesday-spinward-marches']['amishi']).toBeDefined();
    });

    test('tuesday campaign has external (planet-side) contexts', () => {
      expect(CAMPAIGN_CONTEXTS['tuesday-spinward-marches']['external']).toBeDefined();
    });
  });

  describe('Shipboard contexts', () => {
    let shipboardContexts;

    beforeAll(() => {
      shipboardContexts = CAMPAIGN_CONTEXTS?.['tuesday-spinward-marches']?.['amishi'];
    });

    test('has on-duty context', () => {
      expect(shipboardContexts?.['on-duty']).toBeDefined();
      expect(shipboardContexts?.['on-duty'].label).toContain('Duty');
    });

    test('has off-duty context', () => {
      expect(shipboardContexts?.['off-duty']).toBeDefined();
    });

    test('has combat-stations context', () => {
      expect(shipboardContexts?.['combat-stations']).toBeDefined();
      expect(shipboardContexts?.['combat-stations'].label).toMatch(/combat|red alert/i);
    });

    test('has private-quarters context', () => {
      expect(shipboardContexts?.['private-quarters']).toBeDefined();
    });

    test('has intercom context', () => {
      expect(shipboardContexts?.['intercom']).toBeDefined();
    });

    test('each context has required fields', () => {
      for (const [id, ctx] of Object.entries(shipboardContexts || {})) {
        expect(ctx.key).toBeDefined();
        expect(ctx.label).toBeDefined();
        expect(ctx.promptModifier).toBeDefined();
      }
    });
  });

  describe('External contexts', () => {
    let externalContexts;

    beforeAll(() => {
      externalContexts = CAMPAIGN_CONTEXTS?.['tuesday-spinward-marches']?.['external'];
    });

    test('has their-office context', () => {
      expect(externalContexts?.['their-office']).toBeDefined();
    });

    test('has public-meeting context', () => {
      expect(externalContexts?.['public-meeting']).toBeDefined();
    });

    test('has comms-from-ship context', () => {
      expect(externalContexts?.['comms-from-ship']).toBeDefined();
    });

    test('has dockside context', () => {
      expect(externalContexts?.['dockside']).toBeDefined();
    });
  });

  describe('Vera NPC (updated)', () => {

    test('vera.json exists', () => {
      const veraPath = path.join(DATA_DIR, 'vera.json');
      expect(fs.existsSync(veraPath)).toBe(true);
    });

    test('Vera has correct campaign', () => {
      const vera = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'vera.json'), 'utf8'));
      expect(vera.campaign).toBe('tuesday-spinward-marches');
    });

    test('Vera has location amishi (shipboard)', () => {
      const vera = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'vera.json'), 'utf8'));
      expect(vera.location).toBe('amishi');
    });

    test('Vera is psionic trainer (not information broker)', () => {
      const vera = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'vera.json'), 'utf8'));
      expect(vera.title || vera.archetype).toMatch(/psionic|trainer/i);
    });

    test('Vera has relationship to Von Sydo', () => {
      const vera = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'vera.json'), 'utf8'));
      const hasVonSydo = vera.relationships?.['von-sydo'] ||
                         vera.background?.toLowerCase().includes('von sydo') ||
                         JSON.stringify(vera).toLowerCase().includes('von sydo');
      expect(hasVonSydo).toBeTruthy();
    });
  });

  describe('Shipboard NPCs have location field', () => {

    const SHIPBOARD_NPCS = [
      'anemone-lindqvist',
      'gamma-ag3',
      'jeri-tallux',
      'vera',
      'eddie-ed7',
      'sgt-tomas-reyes',
      'wellen-stova'
    ];

    test.each(SHIPBOARD_NPCS)('%s has location: amishi', (npcId) => {
      const npcPath = path.join(DATA_DIR, `${npcId}.json`);
      if (fs.existsSync(npcPath)) {
        const npc = JSON.parse(fs.readFileSync(npcPath, 'utf8'));
        expect(npc.location).toBe('amishi');
      }
    });
  });

  describe('External NPCs have location field', () => {

    const EXTERNAL_NPCS = [
      'marcus-chen',
      'commander-park',
      'commander-adele-reyes',
      'mira-koss'
    ];

    test.each(EXTERNAL_NPCS)('%s has location: external', (npcId) => {
      const npcPath = path.join(DATA_DIR, `${npcId}.json`);
      if (fs.existsSync(npcPath)) {
        const npc = JSON.parse(fs.readFileSync(npcPath, 'utf8'));
        expect(npc.location).toBe('external');
      }
    });
  });

  describe('getContextsForNpc returns correct contexts', () => {

    test('shipboard NPC gets shipboard contexts', () => {
      const contexts = getContextsForNpc?.('anemone-lindqvist', 'tuesday-spinward-marches');
      if (contexts) {
        expect(contexts['on-duty']).toBeDefined();
        expect(contexts['combat-stations']).toBeDefined();
      }
    });

    test('external NPC gets external contexts', () => {
      const contexts = getContextsForNpc?.('marcus-chen', 'tuesday-spinward-marches');
      if (contexts) {
        expect(contexts['their-office']).toBeDefined();
        expect(contexts['comms-from-ship']).toBeDefined();
      }
    });

    test('shipboard NPC does NOT get external contexts', () => {
      const contexts = getContextsForNpc?.('anemone-lindqvist', 'tuesday-spinward-marches');
      if (contexts) {
        expect(contexts['their-office']).toBeUndefined();
        expect(contexts['dockside']).toBeUndefined();
      }
    });
  });

  describe('NPC count verification', () => {

    test('at least 25 Tuesday campaign NPCs exist', () => {
      const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
      let tuesdayCount = 0;

      for (const file of files) {
        const npc = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
        if (npc.campaign === 'tuesday-spinward-marches') {
          tuesdayCount++;
        }
      }

      expect(tuesdayCount).toBeGreaterThanOrEqual(25);
    });
  });

  describe('Key NPCs exist with required fields', () => {

    const KEY_NPCS = [
      { id: 'vera', role: /psionic|trainer/i },
      { id: 'eddie-ed7', role: /engineer|ai/i },
      { id: 'sgt-tomas-reyes', role: /marine|nco/i },
      { id: 'wellen-stova', role: /medic|medical/i },
      { id: 'anemone-lindqvist', role: /gunner/i },
      { id: 'gamma-ag3', role: /gunner|ai/i },
      { id: 'jeri-tallux', role: /computer/i },
      { id: 'commander-adele-reyes', role: /jsi|handler/i },
      { id: 'mira-koss', role: /smuggler/i }
    ];

    test.each(KEY_NPCS)('$id exists with matching role', ({ id, role }) => {
      const npcPath = path.join(DATA_DIR, `${id}.json`);
      expect(fs.existsSync(npcPath)).toBe(true);

      const npc = JSON.parse(fs.readFileSync(npcPath, 'utf8'));
      const npcRole = npc.title || npc.archetype || '';
      expect(npcRole).toMatch(role);
    });
  });
});
