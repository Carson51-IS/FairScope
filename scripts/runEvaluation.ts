/**
 * Evaluation harness: runs the analysis pipeline against a gold set
 * and compares predicted factor directions to expected values.
 *
 * Usage:
 *   npx tsx scripts/runEvaluation.ts
 */

import "dotenv/config";

// Use dynamic import for ESM compatibility
async function main() {
  const { analyzeScenario } = await import("../src/lib/analysis");
  const fs = await import("fs");
  const path = await import("path");

  const goldSetPath = path.resolve(__dirname, "../evaluation/goldSet.json");
  const raw = fs.readFileSync(goldSetPath, "utf-8");
  const goldSet: {
    scenario: Parameters<typeof analyzeScenario>[0];
    expected_factor_bias: Record<string, string>;
  }[] = JSON.parse(raw);

  console.log(`Running evaluation on ${goldSet.length} scenarios...\n`);

  const DIRECTION_SCORE: Record<string, number> = {
    strongly_favors: 2,
    favors: 1,
    neutral: 0,
    slightly_against: -0.5,
    mixed: 0,
    against: -1,
    strongly_against: -2,
  };

  let totalFactors = 0;
  let exactMatch = 0;
  let directionMatch = 0;
  let totalError = 0;

  for (let i = 0; i < goldSet.length; i++) {
    const { scenario, expected_factor_bias } = goldSet[i];
    console.log(`--- Scenario ${i + 1}: ${scenario.description.slice(0, 80)}...`);

    const result = await analyzeScenario(scenario);

    for (const fs of result.factor_scores) {
      const expectedKey = `factor_${fs.factor_number}`;
      const expected = expected_factor_bias[expectedKey];
      if (!expected) continue;

      totalFactors++;

      const predictedScore = DIRECTION_SCORE[fs.direction] ?? 0;
      const expectedScore = DIRECTION_SCORE[expected] ?? 0;

      const error = Math.abs(predictedScore - expectedScore);
      totalError += error;

      const sameDirection =
        (predictedScore > 0 && expectedScore > 0) ||
        (predictedScore < 0 && expectedScore < 0) ||
        (predictedScore === 0 && expectedScore === 0);

      if (fs.direction === expected) {
        exactMatch++;
        directionMatch++;
        console.log(
          `  Factor ${fs.factor_number}: EXACT ✓  predicted=${fs.direction}  expected=${expected}`
        );
      } else if (sameDirection) {
        directionMatch++;
        console.log(
          `  Factor ${fs.factor_number}: DIR ✓    predicted=${fs.direction}  expected=${expected}`
        );
      } else {
        console.log(
          `  Factor ${fs.factor_number}: MISS ✗   predicted=${fs.direction}  expected=${expected}`
        );
      }
    }

    console.log(
      `  Confidence: ${result.confidence} | Source: ${result.analysis_source ?? "rule-based"}\n`
    );
  }

  console.log("=== EVALUATION RESULTS ===");
  console.log(`Total factors evaluated: ${totalFactors}`);
  console.log(
    `Exact match accuracy:     ${exactMatch}/${totalFactors} (${((exactMatch / totalFactors) * 100).toFixed(1)}%)`
  );
  console.log(
    `Direction match accuracy: ${directionMatch}/${totalFactors} (${((directionMatch / totalFactors) * 100).toFixed(1)}%)`
  );
  console.log(
    `Mean absolute error:      ${(totalError / totalFactors).toFixed(3)}`
  );
}

main().catch((err) => {
  console.error("Evaluation failed:", err);
  process.exit(1);
});
