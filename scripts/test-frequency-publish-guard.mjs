#!/usr/bin/env node
import assert from 'node:assert/strict';
import { assertFrequencyPublishSafe, evaluateFrequencyPublishGuard } from '../functions/_lib/frequency-publish-guard.js';

const rows = count => Array.from({ length: count }, (_, index) => ({ frequency: String(10000 + index), pol: 'H' }));

const blocked = evaluateFrequencyPublishGuard({
  baselineItems: rows(1000),
  mergedItems: rows(700),
  removedItems: rows(300),
  env: { FREQUENCY_MIN_BASELINE_RETAIN_RATIO: '0.75', FREQUENCY_MAX_REMOVALS_PER_RUN: '250' }
});
assert.equal(blocked.safe, false);
assert.equal(blocked.ratioOk, false);
assert.equal(blocked.removalsOk, false);
assert.equal(blocked.removedRowCount, 300);

const ordinary = assertFrequencyPublishSafe({
  baselineItems: rows(1000),
  mergedItems: rows(800),
  removedItems: rows(200),
  env: { FREQUENCY_MIN_BASELINE_RETAIN_RATIO: '0.75', FREQUENCY_MAX_REMOVALS_PER_RUN: '250' }
});
assert.equal(ordinary.safe, true);
assert.equal(ordinary.retainedRatio, 0.8);

const rejectedByRemovalCap = evaluateFrequencyPublishGuard({
  baselineItems: rows(1000),
  mergedItems: rows(750),
  removedItems: rows(250),
  env: { FREQUENCY_MIN_BASELINE_RETAIN_RATIO: '0.75', FREQUENCY_MAX_REMOVALS_PER_RUN: '200' }
});
assert.equal(rejectedByRemovalCap.safe, false);
assert.equal(rejectedByRemovalCap.ratioOk, true);
assert.equal(rejectedByRemovalCap.removalsOk, false);

const overridden = assertFrequencyPublishSafe({
  baselineItems: rows(1000),
  mergedItems: rows(400),
  removedItems: rows(600),
  env: {
    FREQUENCY_MIN_BASELINE_RETAIN_RATIO: '0.75',
    FREQUENCY_MAX_REMOVALS_PER_RUN: '250',
    FREQUENCY_ALLOW_PUBLISH_SHRINK: '1'
  }
});
assert.equal(overridden.override, true);
assert.equal(overridden.safe, true);

const consensusRemoval = assertFrequencyPublishSafe({
  baselineItems: rows(1000),
  mergedItems: rows(400),
  removedItems: rows(600).map((item, index) => ({
    ...item,
    removedReason: 'closed-by-source-consensus',
    closedSourceCount: 2,
    confirmationSites: ['kingofsat.net', 'dthsat.com'],
    index
  })),
  env: { FREQUENCY_MIN_BASELINE_RETAIN_RATIO: '0.75', FREQUENCY_MAX_REMOVALS_PER_RUN: '250' }
});
assert.equal(consensusRemoval.consensusRemovalOnly, true);
assert.equal(consensusRemoval.safe, true);

const singleSourceRemoval = evaluateFrequencyPublishGuard({
  baselineItems: rows(1000),
  mergedItems: rows(400),
  removedItems: rows(600).map(item => ({ ...item, removedReason: 'closed-by-source-consensus', closedSourceCount: 1 })),
  env: { FREQUENCY_MIN_BASELINE_RETAIN_RATIO: '0.75', FREQUENCY_MAX_REMOVALS_PER_RUN: '250' }
});
assert.equal(singleSourceRemoval.consensusRemovalOnly, false);
assert.equal(singleSourceRemoval.safe, false);

console.log('✓ publish guard blocks untrusted shrink, accepts ordinary changes, allows only multi-site closure shrink, and requires explicit override otherwise');
