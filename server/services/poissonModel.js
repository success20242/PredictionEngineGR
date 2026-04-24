/**
 * ⚽ POISSON MODEL (CLEAN + SAFE VERSION)
 * Models goals as independent Poisson processes
 * Outputs match probabilities + expected goals
 */

// ==========================
// 📊 POISSON PMF
// ==========================
function poissonPMF(k, lambda) {
  if (lambda <= 0) return k === 0 ? 1 : 0;

  let result = Math.exp(-lambda);

  for (let i = 1; i <= k; i++) {
    result *= lambda / i;
  }

  return result;
}

// ==========================
// 📊 SCORE MATRIX (0–maxGoals)
// ==========================
function buildScoreMatrix(lambdaHome, lambdaAway, maxGoals = 6) {
  const matrix = [];

  for (let h = 0; h <= maxGoals; h++) {
    matrix[h] = [];

    for (let a = 0; a <= maxGoals; a++) {
      matrix[h][a] =
        poissonPMF(h, lambdaHome) *
        poissonPMF(a, lambdaAway);
    }
  }

  return matrix;
}

// ==========================
// ⚽ MAIN POISSON MODEL
// ==========================
export function calculatePoissonProbabilities(
  homeTeam,
  awayTeam,
  leagueAvgGoals = 2.65
) {
  // safety fallback
  const safeLeagueAvg = leagueAvgGoals || 2.65;

  // league distribution split
  const leagueAvgHome = safeLeagueAvg * 0.55;
  const leagueAvgAway = safeLeagueAvg * 0.45;

  // ==========================
  // 🧠 TEAM STRENGTHS (SAFE)
  // ==========================
  const homeAttack = Number(homeTeam?.attack_strength ?? 1);
  const homeDefense = Number(homeTeam?.defense_strength ?? 1);

  const awayAttack = Number(awayTeam?.attack_strength ?? 1);
  const awayDefense = Number(awayTeam?.defense_strength ?? 1);

  // ==========================
  // ⚽ EXPECTED GOALS
  // ==========================
  const lambdaHome = Math.max(
    0.1,
    homeAttack * awayDefense * leagueAvgHome
  );

  const lambdaAway = Math.max(
    0.1,
    awayAttack * homeDefense * leagueAvgAway
  );

  const matrix = buildScoreMatrix(lambdaHome, lambdaAway);

  // ==========================
  // 📊 OUTCOME CALCULATION
  // ==========================
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  for (let h = 0; h <= 6; h++) {
    for (let a = 0; a <= 6; a++) {
      const p = matrix[h][a];

      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;
    }
  }

  const total = homeWin + draw + awayWin || 1;

  // ==========================
  // 📤 RETURN NORMALIZED OUTPUT
  // ==========================
  return {
    home_win: +(homeWin / total).toFixed(4),
    draw: +(draw / total).toFixed(4),
    away_win: +(awayWin / total).toFixed(4),

    expected_home_goals: +lambdaHome.toFixed(2),
    expected_away_goals: +lambdaAway.toFixed(2),

    score_matrix: matrix,
    model: "poisson"
  };
}

// ==========================
// 🎯 MOST LIKELY SCORE
// ==========================
export function getMostLikelyScore(scoreMatrix, maxGoals = 6) {
  let maxProb = 0;

  let bestScore = {
    home: 0,
    away: 0
  };

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = scoreMatrix[h][a];

      if (p > maxProb) {
        maxProb = p;

        bestScore = {
          home: h,
          away: a
        };
      }
    }
  }

  return {
    ...bestScore,
    probability: +maxProb.toFixed(4)
  };
}
