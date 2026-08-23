const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function numericOption(env, key, fallback, minimum = 0) {
  const raw = env && env[key] !== undefined && env[key] !== null && env[key] !== '' ? Number(env[key]) : fallback;
  return Number.isFinite(raw) ? Math.max(minimum, raw) : fallback;
}

function isEnabled(value) {
  return TRUE_VALUES.has(String(value || '').trim().toLowerCase());
}

/**
 * Evaluate whether a merged frequency snapshot is safe to publish compared
 * with the snapshot currently used as the baseline.
 *
 * The guard intentionally measures row-count collapse, not ordinary channel
 * name changes. It is a last line of defence against publishing a partial
 * source scan after several providers fail or block automated requests.
 */
export function evaluateFrequencyPublishGuard({ baselineItems = [], mergedItems = [], removedItems = [], env = {} } = {}) {
  const baselineCount = Array.isArray(baselineItems) ? baselineItems.length : 0;
  const mergedCount = Array.isArray(mergedItems) ? mergedItems.length : 0;
  const removedRowCount = Math.max(0, baselineCount - mergedCount);
  const minRetainRatio = numericOption(env, 'FREQUENCY_MIN_BASELINE_RETAIN_RATIO', 0.75, 0);
  const maxRemovalsPerRun = numericOption(env, 'FREQUENCY_MAX_REMOVALS_PER_RUN', 250, 0);
  const override = isEnabled(env.FREQUENCY_ALLOW_PUBLISH_SHRINK);
  const retainedRatio = baselineCount ? mergedCount / baselineCount : 1;
  const ratioOk = baselineCount === 0 || retainedRatio >= minRetainRatio;
  const removalsOk = baselineCount === 0 || removedRowCount <= maxRemovalsPerRun;
  const safe = override || (ratioOk && removalsOk);
  const reasons = [];
  if (!ratioOk) reasons.push(`retained ratio ${retainedRatio.toFixed(4)} is below ${minRetainRatio}`);
  if (!removalsOk) reasons.push(`removed ${removedRowCount} rows, above ${maxRemovalsPerRun}`);
  if (override) reasons.push('explicit FREQUENCY_ALLOW_PUBLISH_SHRINK override enabled');

  return {
    safe,
    override,
    baselineCount,
    mergedCount,
    removedRowCount,
    removedItemCount: Array.isArray(removedItems) ? removedItems.length : 0,
    retainedRatio: Number(retainedRatio.toFixed(4)),
    minRetainRatio,
    maxRemovalsPerRun,
    ratioOk,
    removalsOk,
    reasons
  };
}

export function assertFrequencyPublishSafe(options = {}) {
  const result = evaluateFrequencyPublishGuard(options);
  if (!result.safe) {
    throw new Error(
      `Refusing to publish a collapsed frequency snapshot: baseline=${result.baselineCount}, merged=${result.mergedCount}, retainedRatio=${result.retainedRatio}, removedRows=${result.removedRowCount}; ${result.reasons.join('; ')}. Set FREQUENCY_ALLOW_PUBLISH_SHRINK=1 only after manual review.`
    );
  }
  return result;
}
