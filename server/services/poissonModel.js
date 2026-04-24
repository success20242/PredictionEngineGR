/**
 * POISSON MODEL
 * Models goal scoring as a Poisson process.
 * Calculates match outcome probabilities based on expected goals.
 */

// Poisson probability mass function
function poissonPMF(k, lambda) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let result = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) {
    result *= lambda / i;
  }
  return result;
}

// Build score matrix for goals 0..maxGoals
function buildScoreMatrix(lambdaHome, lambdaAway, maxGoals = 6) {
  const matrix = [];
  for (let h = 0; h <= maxGoals; h++) {
    matrix[h] = [];
    for (let a = 0; a <= maxGoals; a++) {
      matrix[h][a] = poissonPMF(h, lambdaHome) * poissonPMF(a, lambdaAway);
    }
  }
  return matrix;
}

export function calculatePoissonProbabilities(homeTeam, awayTeam, leagueAvgGoals = 2.65) {
  // League average attack/defense baseline
  const leagueAvgHome = leagueAvgGoals * 0.55; // home teams score ~55% of avg
  const leagueAvgAway = leagueAvgGoals * 0.45;

  // Team attack/defense strengths (default to 1.0 if not available)
  const homeAttack = homeTeam?.attack_strength || 1.0;
  const homeDefense = homeTeam?.defense_strength || 1.0;
  const awayAttack = awayTeam?.attack_strength || 1.0;
  const awayDefense = awayTeam?.defense_strength || 1.0;

  // Expected goals using Dixon-Coles style
  const lambdaHome = homeAttack * awayDefense * leagueAvgHome;
  const lambdaAway = awayAttack * homeDefense * leagueAvgAway;

  const matrix = buildScoreMatrix(
    Math.max(0.1, lambdaHome),
    Math.max(0.1, lambdaAway)
  );

  let homeWin = 0, draw = 0, awayWin = 0;
  for (let h = 0; h <= 6; h++) {
    for (let a = 0; a <= 6; a++) {
      const p = matrix[h][a];
      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;
    }
  }

  // Normalize to sum to 1
  const total = homeWin + draw + awayWin;

  return {
    home_win: homeWin / total,
    draw: draw / total,
    away_win: awayWin / total,
    expected_home_goals: lambdaHome,
    expected_away_goals: lambdaAway,
    score_matrix: matrix,
    model: 'poisson'
  };
}

export function getMostLikelyScore(scoreMatrix, maxGoals = 6) {
  let maxProb = 0;
  let bestScore = { home: 1, away: 0 };
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      if (scoreMatrix[h][a] > maxProb) {
        maxProb = scoreMatrix[h][a];
        bestScore = { home: h, away: a };
      }
    }
  }
  return { ...bestScore, probability: maxProb };
}
