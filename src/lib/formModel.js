/**
 * FORM & xG MODEL
 * Calculates team form-based probabilities and xG approximation.
 */

// Convert form string array ['W','D','L','W','W'] to weighted score
export function calculateFormScore(form, weights = [0.35, 0.25, 0.20, 0.12, 0.08]) {
  if (!form || form.length === 0) return 0.5;

  const recent = form.slice(-5);
  let score = 0;
  let totalWeight = 0;

  recent.forEach((result, idx) => {
    const w = weights[idx] || 0.05;
    totalWeight += w;
    if (result === 'W') score += w * 1.0;
    else if (result === 'D') score += w * 0.5;
    // L = 0
  });

  return totalWeight > 0 ? score / totalWeight : 0.5;
}

// Calculate momentum: recent trend (last 3 vs previous 3)
export function calculateMomentum(form) {
  if (!form || form.length < 3) return 0;
  const recent3 = form.slice(-3).map(r => r === 'W' ? 1 : r === 'D' ? 0.5 : 0);
  const prev3 = form.slice(-6, -3).map(r => r === 'W' ? 1 : r === 'D' ? 0.5 : 0);
  const recentAvg = recent3.reduce((a, b) => a + b, 0) / recent3.length;
  const prevAvg = prev3.length > 0 ? prev3.reduce((a, b) => a + b, 0) / prev3.length : recentAvg;
  return recentAvg - prevAvg; // positive = improving, negative = declining
}

export function calculateFormProbabilities(homeTeam, awayTeam) {
  const homeForm = calculateFormScore(homeTeam?.form);
  const homeHomeForm = calculateFormScore(homeTeam?.home_form);
  const awayForm = calculateFormScore(awayTeam?.form);
  const awayAwayForm = calculateFormScore(awayTeam?.away_form);

  // Blend overall form with venue-specific form
  const homeStrength = homeForm * 0.5 + homeHomeForm * 0.5;
  const awayStrength = awayForm * 0.5 + awayAwayForm * 0.5;

  const homeMomentum = calculateMomentum(homeTeam?.form);
  const awayMomentum = calculateMomentum(awayTeam?.form);

  // Adjust for momentum
  const homeAdj = homeStrength + homeMomentum * 0.1;
  const awayAdj = awayStrength + awayMomentum * 0.1;

  const total = homeAdj + awayAdj + 0.001;
  const rawHome = homeAdj / total;
  const rawAway = awayAdj / total;

  // Inject draw probability based on how close the teams are
  const closeness = 1 - Math.abs(rawHome - rawAway);
  const drawProb = 0.15 + closeness * 0.15;
  const scale = 1 - drawProb;

  return {
    home_win: rawHome * scale,
    draw: drawProb,
    away_win: rawAway * scale,
    home_form_score: homeStrength,
    away_form_score: awayStrength,
    home_momentum: homeMomentum,
    away_momentum: awayMomentum,
    model: 'form'
  };
}

export function calculateXGProbabilities(homeTeam, awayTeam) {
  // xG approximation from goals scored/conceded and match count
  const homeMatches = homeTeam?.matches_played || 10;
  const awayMatches = awayTeam?.matches_played || 10;

  const homeXgFor = homeTeam?.xg_for || (homeTeam?.goals_scored || 15) / homeMatches;
  const homeXgAgainst = homeTeam?.xg_against || (homeTeam?.goals_conceded || 12) / homeMatches;
  const awayXgFor = awayTeam?.xg_for || (awayTeam?.goals_scored || 12) / awayMatches;
  const awayXgAgainst = awayTeam?.xg_against || (awayTeam?.goals_conceded || 15) / awayMatches;

  // Expected goals in this match
  const homeExpectedGoals = (homeXgFor + awayXgAgainst) / 2;
  const awayExpectedGoals = (awayXgFor + homeXgAgainst) / 2;

  // Convert xG difference to probabilities
  const xgDiff = homeExpectedGoals - awayExpectedGoals;
  const homeProb = 0.5 + xgDiff * 0.15;
  const awayProb = 0.5 - xgDiff * 0.15;

  const drawProb = 0.25 - Math.abs(xgDiff) * 0.05;

  const total = homeProb + drawProb + awayProb;

  return {
    home_win: Math.max(0.05, homeProb / total),
    draw: Math.max(0.10, drawProb / total),
    away_win: Math.max(0.05, awayProb / total),
    home_xg: homeExpectedGoals,
    away_xg: awayExpectedGoals,
    model: 'xg'
  };
}
