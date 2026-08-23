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

console.log('✓ publish guard blocks catastrophic shrink, accepts ordinary changes, enforces removal cap, and requires explicit override for exceptional shrink');
