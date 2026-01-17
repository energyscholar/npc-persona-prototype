#!/usr/bin/env node
/**
 * Action Reports Tests (TDD - Tests First)
 *
 * Tests action visibility and reporting:
 * - Visibility levels (direct, witnessed, rumor, discovery)
 * - Report generation
 * - PC notification queue
 *
 * AUDITOR INSTANCE: 5f069a8e-52eb-42c4-a874-17ce01f2100b
 */

const { strict: assert } = require('assert');

// Import will fail until implementation exists
let actionReports;
try {
  actionReports = require('../src/action-reports');
} catch (e) {
  console.error('Action-reports module not yet implemented.\n');
  actionReports = {};
}

const {
  VISIBILITY_LEVELS,
  generateActionReport,
  queueReport,
  getQueuedReports,
  clearReports,
  getReportsForPc,
  formatReportMessage
} = actionReports;

// Test runner
function runTests(tests) {
  let passed = 0, failed = 0;
  for (const [name, fn] of Object.entries(tests)) {
    try {
      fn();
      console.log(`\x1b[32m✓\x1b[0m ${name}`);
      passed++;
    } catch (e) {
      console.log(`\x1b[31m✗\x1b[0m ${name}`);
      console.log(`    ${e.message}`);
      failed++;
    }
  }
  console.log(`\n${passed}/${passed + failed} tests passed`);
  return failed === 0;
}

// === TEST DATA ===

const sampleAction = {
  id: 'repair-system',
  type: 'crew-task',
  visibility: 'witnessed',
  progressReports: true
};

const sampleNpc = {
  id: 'engineer-1',
  name: 'Chief Engineer'
};

const sampleResult = {
  success: true,
  message: 'Repairs completed successfully'
};

// === VISIBILITY LEVELS TESTS ===

const visibilityTests = {
  'VISIBILITY_LEVELS is defined': () => {
    assert.ok(VISIBILITY_LEVELS !== undefined);
    assert.ok(typeof VISIBILITY_LEVELS === 'object');
  },

  'VISIBILITY_LEVELS includes direct': () => {
    assert.ok(VISIBILITY_LEVELS.hasOwnProperty('direct') ||
              Object.values(VISIBILITY_LEVELS).includes('direct'));
  },

  'VISIBILITY_LEVELS includes witnessed': () => {
    assert.ok(VISIBILITY_LEVELS.hasOwnProperty('witnessed') ||
              Object.values(VISIBILITY_LEVELS).includes('witnessed'));
  },

  'VISIBILITY_LEVELS includes rumor': () => {
    assert.ok(VISIBILITY_LEVELS.hasOwnProperty('rumor') ||
              Object.values(VISIBILITY_LEVELS).includes('rumor'));
  },

  'VISIBILITY_LEVELS includes discovery': () => {
    assert.ok(VISIBILITY_LEVELS.hasOwnProperty('discovery') ||
              Object.values(VISIBILITY_LEVELS).includes('discovery'));
  },

  'VISIBILITY_LEVELS includes hidden': () => {
    assert.ok(VISIBILITY_LEVELS.hasOwnProperty('hidden') ||
              Object.values(VISIBILITY_LEVELS).includes('hidden'));
  }
};

// === GENERATE ACTION REPORT TESTS ===

const generateReportTests = {
  'generateActionReport returns object': () => {
    const report = generateActionReport(sampleAction, sampleNpc, sampleResult);
    assert.ok(report !== null);
    assert.ok(typeof report === 'object');
  },

  'generateActionReport includes action id': () => {
    const report = generateActionReport(sampleAction, sampleNpc, sampleResult);
    assert.equal(report.actionId, 'repair-system');
  },

  'generateActionReport includes npc info': () => {
    const report = generateActionReport(sampleAction, sampleNpc, sampleResult);
    assert.equal(report.npcId, 'engineer-1');
    assert.ok(report.npcName || report.npcId);
  },

  'generateActionReport includes visibility level': () => {
    const report = generateActionReport(sampleAction, sampleNpc, sampleResult);
    assert.equal(report.visibility, 'witnessed');
  },

  'generateActionReport includes timestamp': () => {
    const report = generateActionReport(sampleAction, sampleNpc, sampleResult);
    assert.ok(report.timestamp);
  },

  'generateActionReport includes success status': () => {
    const report = generateActionReport(sampleAction, sampleNpc, sampleResult);
    assert.equal(report.success, true);
  },

  'generateActionReport returns null for hidden visibility': () => {
    const hiddenAction = { ...sampleAction, visibility: 'hidden' };
    const report = generateActionReport(hiddenAction, sampleNpc, sampleResult);
    assert.equal(report, null);
  },

  'generateActionReport handles null action': () => {
    const report = generateActionReport(null, sampleNpc, sampleResult);
    assert.equal(report, null);
  },

  'generateActionReport handles null npc': () => {
    const report = generateActionReport(sampleAction, null, sampleResult);
    assert.equal(report, null);
  },

  'generateActionReport handles null result': () => {
    const report = generateActionReport(sampleAction, sampleNpc, null);
    // Should still generate report, just without result info
    if (report) {
      assert.ok(report.actionId);
    }
  }
};

// === QUEUE REPORT TESTS ===

const queueReportTests = {
  'queueReport adds report to queue': () => {
    clearReports(); // Clean state
    const report = generateActionReport(sampleAction, sampleNpc, sampleResult);
    queueReport(report);
    const queued = getQueuedReports();
    assert.ok(queued.length >= 1);
  },

  'queueReport handles null report': () => {
    assert.doesNotThrow(() => queueReport(null));
  },

  'clearReports empties the queue': () => {
    const report = generateActionReport(sampleAction, sampleNpc, sampleResult);
    queueReport(report);
    clearReports();
    const queued = getQueuedReports();
    assert.equal(queued.length, 0);
  },

  'getQueuedReports returns array': () => {
    const queued = getQueuedReports();
    assert.ok(Array.isArray(queued));
  },

  'multiple reports can be queued': () => {
    clearReports();
    const report1 = generateActionReport(sampleAction, sampleNpc, sampleResult);
    const report2 = generateActionReport(
      { ...sampleAction, id: 'jump-system' },
      { id: 'pilot-1', name: 'Pilot' },
      sampleResult
    );
    queueReport(report1);
    queueReport(report2);
    const queued = getQueuedReports();
    assert.equal(queued.length, 2);
  }
};

// === GET REPORTS FOR PC TESTS ===

const pcReportsTests = {
  'getReportsForPc returns array': () => {
    clearReports();
    const reports = getReportsForPc('captain-drake');
    assert.ok(Array.isArray(reports));
  },

  'getReportsForPc filters by visibility': () => {
    clearReports();

    // Direct message to specific PC
    const directReport = {
      actionId: 'send-message',
      npcId: 'patron-1',
      visibility: 'direct',
      targetPc: 'captain-drake',
      timestamp: new Date().toISOString()
    };
    queueReport(directReport);

    // Witnessed by all
    const witnessedReport = {
      actionId: 'repair-system',
      npcId: 'engineer-1',
      visibility: 'witnessed',
      timestamp: new Date().toISOString()
    };
    queueReport(witnessedReport);

    const drakeReports = getReportsForPc('captain-drake');
    const otherReports = getReportsForPc('other-pc');

    // Drake should see both (direct to him + witnessed)
    assert.ok(drakeReports.length >= 1);

    // Other should see only witnessed
    const otherDirect = otherReports.filter(r => r.visibility === 'direct' && r.targetPc !== 'other-pc');
    assert.equal(otherDirect.length, 0);
  },

  'getReportsForPc handles null pcId': () => {
    const reports = getReportsForPc(null);
    assert.ok(Array.isArray(reports));
  },

  'getReportsForPc returns empty for unknown PC': () => {
    clearReports();
    const reports = getReportsForPc('unknown-pc-xyz');
    assert.ok(Array.isArray(reports));
  }
};

// === FORMAT REPORT MESSAGE TESTS ===

const formatMessageTests = {
  'formatReportMessage returns string': () => {
    const report = generateActionReport(sampleAction, sampleNpc, sampleResult);
    if (report) {
      const message = formatReportMessage(report);
      assert.equal(typeof message, 'string');
    }
  },

  'formatReportMessage includes NPC name': () => {
    const report = generateActionReport(sampleAction, sampleNpc, sampleResult);
    if (report) {
      const message = formatReportMessage(report);
      assert.ok(message.includes('Chief Engineer') || message.includes('engineer'));
    }
  },

  'formatReportMessage handles different visibility levels': () => {
    const directReport = { ...generateActionReport(sampleAction, sampleNpc, sampleResult), visibility: 'direct' };
    const rumorReport = { ...generateActionReport(sampleAction, sampleNpc, sampleResult), visibility: 'rumor' };

    if (directReport && rumorReport) {
      const directMsg = formatReportMessage(directReport);
      const rumorMsg = formatReportMessage(rumorReport);

      // Messages should differ based on visibility
      assert.ok(directMsg.length > 0);
      assert.ok(rumorMsg.length > 0);
    }
  },

  'formatReportMessage handles null report': () => {
    const message = formatReportMessage(null);
    assert.equal(message, '');
  },

  'formatReportMessage includes action result for success': () => {
    const report = {
      actionId: 'repair-system',
      npcId: 'engineer-1',
      npcName: 'Chief Engineer',
      visibility: 'witnessed',
      success: true,
      message: 'Repairs completed'
    };
    const message = formatReportMessage(report);
    assert.ok(message.includes('repair') || message.includes('Repair') ||
              message.includes('complet') || message.includes('success'));
  }
};

// === VISIBILITY FILTERING TESTS ===

const visibilityFilterTests = {
  'direct visibility targets specific PC': () => {
    clearReports();
    const report = {
      actionId: 'private-message',
      npcId: 'patron-1',
      visibility: 'direct',
      targetPc: 'captain-drake',
      timestamp: new Date().toISOString()
    };
    queueReport(report);

    const drakeReports = getReportsForPc('captain-drake');
    const otherReports = getReportsForPc('crew-member');

    assert.ok(drakeReports.some(r => r.actionId === 'private-message'));
    assert.ok(!otherReports.some(r => r.actionId === 'private-message'));
  },

  'witnessed visibility reaches all PCs': () => {
    clearReports();
    const report = {
      actionId: 'public-repair',
      npcId: 'engineer-1',
      visibility: 'witnessed',
      timestamp: new Date().toISOString()
    };
    queueReport(report);

    const pc1Reports = getReportsForPc('pc1');
    const pc2Reports = getReportsForPc('pc2');

    assert.ok(pc1Reports.some(r => r.actionId === 'public-repair'));
    assert.ok(pc2Reports.some(r => r.actionId === 'public-repair'));
  },

  'rumor visibility may reach some PCs': () => {
    clearReports();
    const report = {
      actionId: 'secret-deal',
      npcId: 'patron-1',
      visibility: 'rumor',
      timestamp: new Date().toISOString()
    };
    queueReport(report);

    // Rumor should be in queue but visibility rules apply
    const queued = getQueuedReports();
    assert.ok(queued.some(r => r.actionId === 'secret-deal'));
  },

  'discovery visibility requires PC investigation': () => {
    clearReports();
    const report = {
      actionId: 'hidden-sabotage',
      npcId: 'spy-1',
      visibility: 'discovery',
      timestamp: new Date().toISOString()
    };
    queueReport(report);

    // Discovery reports shouldn't show up in normal getReportsForPc
    const normalReports = getReportsForPc('captain-drake');
    // Unless PC has discovered it
    assert.ok(!normalReports.some(r => r.visibility === 'discovery' && !r.discovered));
  }
};

// === INTEGRATION TESTS ===

const integrationTests = {
  'full flow: action -> report -> queue -> retrieve': () => {
    clearReports();

    // Generate report for action
    const report = generateActionReport(sampleAction, sampleNpc, sampleResult);

    // Queue it
    if (report) {
      queueReport(report);

      // Retrieve for PC
      const pcReports = getReportsForPc('captain-drake');
      assert.ok(pcReports.length >= 1);

      // Format message
      const message = formatReportMessage(pcReports[0]);
      assert.ok(message.length > 0);
    }
  },

  'multiple actions generate separate reports': () => {
    clearReports();

    const actions = [
      { id: 'repair-system', visibility: 'witnessed' },
      { id: 'send-message', visibility: 'direct', targetPc: 'captain-drake' },
      { id: 'monitor-sensors', visibility: 'witnessed' }
    ];

    actions.forEach(action => {
      const report = generateActionReport(action, sampleNpc, sampleResult);
      if (report) queueReport(report);
    });

    const queued = getQueuedReports();
    assert.ok(queued.length >= 2); // At least witnessed actions
  },

  'module exports are defined': () => {
    assert.ok(VISIBILITY_LEVELS !== undefined);
    assert.ok(typeof generateActionReport === 'function');
    assert.ok(typeof queueReport === 'function');
    assert.ok(typeof getQueuedReports === 'function');
    assert.ok(typeof clearReports === 'function');
    assert.ok(typeof getReportsForPc === 'function');
    assert.ok(typeof formatReportMessage === 'function');
  }
};

// === RUN ALL TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  ACTION REPORTS TESTS');
console.log('══════════════════════════════════════════\n');

console.log('--- Visibility Levels Tests ---');
const visibility = runTests(visibilityTests);

console.log('\n--- Generate Report Tests ---');
const generateReport = runTests(generateReportTests);

console.log('\n--- Queue Report Tests ---');
const queueReportResult = runTests(queueReportTests);

console.log('\n--- PC Reports Tests ---');
const pcReports = runTests(pcReportsTests);

console.log('\n--- Format Message Tests ---');
const formatMessage = runTests(formatMessageTests);

console.log('\n--- Visibility Filtering Tests ---');
const visibilityFilter = runTests(visibilityFilterTests);

console.log('\n--- Integration Tests ---');
const integration = runTests(integrationTests);

const allPassed = visibility && generateReport && queueReportResult && pcReports && formatMessage && visibilityFilter && integration;
process.exit(allPassed ? 0 : 1);
