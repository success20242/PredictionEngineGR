/**
 * ⚽ ELO RATING SYSTEM (CLEAN + CONSISTENT)
 * - Calculates win/draw/loss probabilities
 * - Updates ratings after matches
 * - Used by predictionEngine
 */

const DEFAULT_ELO = 1500;
const K_FACTOR = 32;
const HOME_ADVANTAGE = 100;

// ==========================
// 📊 EXPECTED SCORE FUNCTION
// ==========================
export function getExpectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

// ==========================
// ⚽ MAIN ELO PROBABILITY MODEL
// ==========================
export function calculateEloProbabilities(homeTeam, awayTeam) {
  const homeElo =
    (homeTeam?.elo_rating ?? DEFAULT_ELO) + HOME_ADVANTAGE;

  const awayElo =
    awayTeam?.elo_rating ?? DEFAULT_ELO;

  const homeExpected = getExpectedScore(homeElo, awayElo);
  const awayExpected = 1 - homeExpected;

  // ==========================
  // ⚖️ DRAW MODEL (STABLE)
  // ==========================
  const rawDraw =
    0.25 - Math.abs(homeExpected - 0.5) * 0.3;

  const drawProb = Math.min(
    0.35,
    Math.max(0.10, rawDraw)
  );

  const homeWin = homeExpected * (1 - drawProb);
  const awayWin = awayExpected * (1 - drawProb);

  const total = homeWin + drawProb + awayWin || 1;

  return {
    home_win: +(homeWin / total).toFixed(4),
    draw: +(drawProb / total).toFixed(4),
    away_win: +(awayWin / total).toFixed(4),

    home_elo: homeElo,
    away_elo: awayElo,
    elo_diff: homeElo - awayElo,

    model: "elo"
  };
}

// ==========================
// 📊 ELO UPDATE FUNCTION
// ==========================
export function updateEloRating(
  currentRating,
  actualScore,
  expectedScore
) {
  return (
    currentRating +
    K_FACTOR * (actualScore - expectedScore)
  );
}

// ==========================
// ⚽ POST-MATCH ELO UPDATE
// ==========================
export function getEloUpdate(
  homeTeam,
  awayTeam,
  homeScore,
  awayScore
) {
  const homeElo =
    (homeTeam?.elo_rating ?? DEFAULT_ELO) +
    HOME_ADVANTAGE;

  const awayElo =
    awayTeam?.elo_rating ?? DEFAULT_ELO;

  const homeExpected = getExpectedScore(homeElo, awayElo);
  const awayExpected = 1 - homeExpected;

  let homeActual = 0;
  let awayActual = 0;

  if (homeScore > awayScore) {
    homeActual = 1;
    awayActual = 0;
  } else if (homeScore === awayScore) {
    homeActual = 0.5;
    awayActual = 0.5;
  } else {
    homeActual = 0;
    awayActual = 1;
  }

  return {
    new_home_elo: updateEloRating(
      homeTeam?.elo_rating ?? DEFAULT_ELO,
      homeActual,
      homeExpected
    ),

    new_away_elo: updateEloRating(
      awayTeam?.elo_rating ?? DEFAULT_ELO,
      awayActual,
      awayExpected
    ),

    home_delta:
      K_FACTOR * (homeActual - homeExpected),

    away_delta:
      K_FACTOR * (awayActual - awayExpected)
  };
}
