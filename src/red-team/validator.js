/**
 * Validator - Check NPC responses against expected facts
 *
 * Part of red team validation system for NPC fact-checking.
 */

const fs = require('fs');
const path = require('path');
const { getFact } = require('./fact-database');
const { getQuery, getQueriesForNpc } = require('./query-engine');

const RESULTS_DIR = path.join(__dirname, '../../data/validation-results');

/**
 * Validation verdicts
 */
const VERDICT = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  WARN: 'WARN'
};

/**
 * Validate a response against a query's expectations
 * @param {string} response - NPC's response text
 * @param {Object} query - Query with expected/failure keywords
 * @returns {Object} Validation result
 */
function validateResponse(response, query) {
  const normalizedResponse = response.toLowerCase();

  const result = {
    query_id: query.id,
    fact_id: query.fact_id,
    verdict: VERDICT.PASS,
    expected_found: [],
    expected_missing: [],
    failure_found: [],
    details: ''
  };

  // Check for failure keywords (automatic FAIL)
  for (const keyword of query.failure_keywords || []) {
    if (normalizedResponse.includes(keyword.toLowerCase())) {
      result.failure_found.push(keyword);
    }
  }

  if (result.failure_found.length > 0) {
    result.verdict = VERDICT.FAIL;
    result.details = `Found failure keywords: ${result.failure_found.join(', ')}`;
    return result;
  }

  // Check for expected keywords
  for (const keyword of query.expected_keywords || []) {
    if (normalizedResponse.includes(keyword.toLowerCase())) {
      result.expected_found.push(keyword);
    } else {
      result.expected_missing.push(keyword);
    }
  }

  // Determine verdict based on expected keywords
  const expectedCount = query.expected_keywords?.length || 0;
  const foundCount = result.expected_found.length;

  if (expectedCount === 0) {
    result.verdict = VERDICT.PASS;
    result.details = 'No specific keywords required';
  } else if (foundCount === 0) {
    result.verdict = VERDICT.FAIL;
    result.details = `None of expected keywords found: ${result.expected_missing.join(', ')}`;
  } else if (foundCount < expectedCount / 2) {
    result.verdict = VERDICT.WARN;
    result.details = `Only ${foundCount}/${expectedCount} expected keywords found`;
  } else {
    result.verdict = VERDICT.PASS;
    result.details = `Found ${foundCount}/${expectedCount} expected keywords`;
  }

  return result;
}

/**
 * Run validation for a single query result
 * @param {Object} queryResult - Result from executeQuery
 * @returns {Object} Validation result with suggested patch
 */
function validateQueryResult(queryResult) {
  const query = getQuery(queryResult.query_id);

  if (!query) {
    return {
      ...queryResult,
      verdict: VERDICT.WARN,
      details: 'Query not found in database'
    };
  }

  if (queryResult.error) {
    return {
      ...queryResult,
      verdict: VERDICT.FAIL,
      details: `Query failed: ${queryResult.error}`
    };
  }

  const validation = validateResponse(queryResult.response, query);

  return {
    ...queryResult,
    ...validation,
    suggested_patch: validation.verdict === VERDICT.FAIL ? generatePatchSuggestion(query, validation) : null
  };
}

/**
 * Generate a patch suggestion for a failed validation
 * @param {Object} query - The failed query
 * @param {Object} validation - Validation result
 * @returns {Object} Suggested patch
 */
function generatePatchSuggestion(query, validation) {
  const fact = getFact(query.fact_id);

  if (!fact) {
    return null;
  }

  // Determine appropriate knowledge_base field
  let field = 'knowledge_base.';
  if (query.id.startsWith('Q00')) {
    field += 'ship_ownership';
  } else if (query.id.startsWith('Q01')) {
    field += 'walston_info';
  } else if (query.id.startsWith('Q02')) {
    field += 'customs_procedure';
  } else if (query.id.startsWith('Q03')) {
    field += 'local_culture';
  } else if (query.id.startsWith('Q04')) {
    field += 'mission_details';
  } else {
    field += 'general_knowledge';
  }

  return {
    field,
    value: fact.content,
    keywords_to_include: query.expected_keywords,
    reason: validation.details
  };
}

/**
 * Run full validation for an NPC
 * @param {string} npcId - NPC identifier
 * @param {Array} queryResults - Results from executeAllQueriesForNpc
 * @returns {Object} Full validation report
 */
function runNpcValidation(npcId, queryResults) {
  const report = {
    npc_id: npcId,
    timestamp: new Date().toISOString(),
    results: [],
    summary: {
      total: 0,
      pass: 0,
      fail: 0,
      warn: 0
    }
  };

  for (const queryResult of queryResults) {
    const validation = validateQueryResult(queryResult);
    report.results.push(validation);
    report.summary.total++;

    switch (validation.verdict) {
      case VERDICT.PASS:
        report.summary.pass++;
        break;
      case VERDICT.FAIL:
        report.summary.fail++;
        break;
      case VERDICT.WARN:
        report.summary.warn++;
        break;
    }
  }

  return report;
}

/**
 * Save validation report to file
 * @param {Object} report - Validation report
 */
function saveValidationReport(report) {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const date = new Date().toISOString().split('T')[0];
  const filename = `${report.npc_id}-${date}.json`;
  const filepath = path.join(RESULTS_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

  return filepath;
}

/**
 * Load validation report for an NPC
 * @param {string} npcId - NPC identifier
 * @param {string} [date] - Optional date (YYYY-MM-DD)
 * @returns {Object|null} Validation report or null
 */
function loadValidationReport(npcId, date = null) {
  if (!fs.existsSync(RESULTS_DIR)) {
    return null;
  }

  const files = fs.readdirSync(RESULTS_DIR)
    .filter(f => f.startsWith(npcId) && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    return null;
  }

  // Find specific date or most recent
  let targetFile = files[0];
  if (date) {
    targetFile = files.find(f => f.includes(date)) || targetFile;
  }

  try {
    return JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, targetFile), 'utf8'));
  } catch (e) {
    return null;
  }
}

/**
 * Get all validation reports
 * @returns {Array} All validation reports
 */
function getAllValidationReports() {
  if (!fs.existsSync(RESULTS_DIR)) {
    return [];
  }

  const reports = [];
  const files = fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const report = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, file), 'utf8'));
      reports.push(report);
    } catch (e) {
      // Skip invalid files
    }
  }

  return reports;
}

/**
 * Format validation report for display
 * @param {Object} report - Validation report
 * @returns {string} Formatted report
 */
function formatValidationReport(report) {
  const lines = [
    `\n═══════════════════════════════════════════════════════`,
    `  RED TEAM VALIDATION REPORT: ${report.npc_id}`,
    `  ${report.timestamp}`,
    `═══════════════════════════════════════════════════════`,
    ``,
    `  Summary: ${report.summary.pass} PASS, ${report.summary.fail} FAIL, ${report.summary.warn} WARN`,
    ``
  ];

  for (const result of report.results) {
    const icon = result.verdict === VERDICT.PASS ? '✓' : result.verdict === VERDICT.FAIL ? '✗' : '⚠';
    lines.push(`  ${icon} [${result.query_id}] ${result.verdict}`);
    lines.push(`    Query: ${result.query_text}`);

    if (result.details) {
      lines.push(`    ${result.details}`);
    }

    if (result.suggested_patch) {
      lines.push(`    Suggested: Add to ${result.suggested_patch.field}`);
    }

    lines.push('');
  }

  lines.push(`═══════════════════════════════════════════════════════\n`);

  return lines.join('\n');
}

module.exports = {
  VERDICT,
  validateResponse,
  validateQueryResult,
  runNpcValidation,
  saveValidationReport,
  loadValidationReport,
  getAllValidationReports,
  formatValidationReport,
  RESULTS_DIR
};
