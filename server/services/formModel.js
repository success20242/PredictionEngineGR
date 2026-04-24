/**
 * FORM & xG MODEL (CLEAN + STABLE)
 * Calculates:
 * - Form strength
 * - Momentum trend
 * - xG-based probabilities
 */

// ==========================
// 📊 FORM SCORE (weighted last 5 matches)
// ==========================
export function calculateFormScore(form, weights = [0.35, 0.25, 0.20, 0.12, 0.08]) {
  if (!Array.isArray(form) || form.length === 0) return 0.5;

  const recent = form.slice(-5);

  let score = 0;
  let totalWeight = 0;

  for (let i = 0; i < recent.length; i++) {
    const result = recent[i];
    const w = weights[i] || 0.05;

    totalWeight += w;

    if (result === "W") score += w * 1;
    else if (result === "D") score += w * 0.5;
    // L = 0
  }

  return totalWeight > 0 ? +(score / totalWeight).toFixed(3) : 0.5;
}

// ==========================
// 📈 MOMENTUM (trend detection)
// ==========================
export function calculateMomentum(form) {
  if (!Array.isArray(form) || form.length < 3) return 0;

  const map = (r) => (r === "W" ? 1 : r === "D" ? 0.5 : 0);

  const recent3 = form.slice(-3).map(map);
  const prev3 = form.slice(-6, -3).map(map);

  const recentAvg =
    recent3.reduce((a, b) => a + b, 0) / (recent3.length || 1);

  const prevAvg =
    prev3.length > 0
      ? prev3.reduce((a, b) => a + b, 0) / prev3.length
      : recentAvg;

  return +(recentAvg - prevAvg).toFixed(3);
}

// ==========================
// ⚽ FORM-BASED PROBABILITIES
// ==========================
export function calculateFormProbabilities(homeTeam, awayTeam) {
  const homeForm = calculateFormScore(homeTeam?.form);
  const awayForm = calculateFormScore(awayTeam?.form);

  const homeVenue = calculateFormScore(homeTeam?.home_form);
  const awayVenue = calculateFormScore(awayTeam?.away_form);

  const homeStrength = homeForm * 0.5 + homeVenue * 0.5;
  const awayStrength = awayForm * 0.5 + awayVenue * 0.5;

  const homeMomentum = calculateMomentum(homeTeam?.form);
  const awayMomentum = calculateMomentum(awayTeam?.form);

  const homeAdj = homeStrength + homeMomentum * 0.1;
  const awayAdj = awayStrength + awayMomentum * 0.1;

  const total = homeAdj + awayAdj + 0.0001;

  const rawHome = homeAdj / total;
  const rawAway = awayAdj / total;

  const closeness = 1 - Math.abs(rawHome - rawAway);

  const drawProb = Math.min(0.35, 0.15 + closeness * 0.15);

  const scale = 1 - drawProb;

  return {
    home_win: +(rawHome * scale).toFixed(3),
    draw: +drawProb.toFixed(3),
    away_win: +(rawAway * scale).toFixed(3),

    home_form_score: homeStrength,
    away_form_score: awayStrength,

    home_momentum: homeMomentum,
    away_momentum: awayMomentum,

    model: "form"
  };
}

// ==========================
// ⚽ xG MODEL (EXPECTED GOALS)
// ==========================
export function calculateXGProbabilities(homeTeam, awayTeam) {
  const homeMatches = homeTeam?.matches_played || 10;
  const awayMatches = awayTeam?.matches_played || 10;

  const homeXgFor =
    homeTeam?.xg_for ??
    (homeTeam?.goals_scored || 15) / homeMatches;

  const homeXgAgainst =
    homeTeam?.xg_against ??
    (homeTeam?.goals_conceded || 12) / homeMatches;

  const awayXgFor =
    awayTeam?.xg_for ??
    (awayTeam?.goals_scored || 12) / awayMatches;

  const awayXgAgainst =
    awayTeam?.xg_against ??
    (awayTeam?.goals_conceded || 15) / awayMatches;

  const homeExpectedGoals =
    (homeXgFor + awayXgAgainst) / 2;

  const awayExpectedGoals =
    (awayXgFor + homeXgAgainst) / 2;

  const diff = homeExpectedGoals - awayExpectedGoals;

  const homeProb = 0.5 + diff * 0.15;
  const awayProb = 0.5 - diff * 0.15;

  const drawProb = Math.max(0.1, 0.25 - Math.abs(diff) * 0.05);

  const total = homeProb + drawProb + awayProb;

  return {
    home_win: +(Math.max(0.05, homeProb / total)).toFixed(3),
    draw: +(Math.max(0.1, drawProb / total)).toFixed(3),
    away_win: +(Math.max(0.05, awayProb / total)).toFixed(3),

    home_xg: +homeExpectedGoals.toFixed(2),
    away_xg: +awayExpectedGoals.toFixed(2),

    model: "xg"
  };
}
