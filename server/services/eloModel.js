/**
 * ELO RATING SYSTEM
 * Tracks team strength evolution over time.
 * Updates ratings based on actual vs expected results.
 */

const DEFAULT_ELO = 1500;
const K_FACTOR = 32; // Sensitivity of rating changes
const HOME_ADVANTAGE = 100; // Elo points added for home team

export function getExpectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function calculateEloProbabilities(homeTeam, awayTeam) {
  const homeElo = (homeTeam?.elo_rating || DEFAULT_ELO) + HOME_ADVANTAGE;
  const awayElo = awayTeam?.elo_rating || DEFAULT_ELO;

  const homeExpected = getExpectedScore(homeElo, awayElo);
  const awayExpected = 1 - homeExpected;

  // Convert to 3-way probabilities (Win/Draw/Loss)
  // Draw zone: when expected scores are close
  const drawFactor = 0.25 - Math.abs(homeExpected - 0.5) * 0.3;
  const drawProb = Math.max(0.10, Math.min(0.35, drawFactor));

  const homeWin = homeExpected * (1 - drawProb);
  const awayWin = awayExpected * (1 - drawProb);

  const total = homeWin + drawProb + awayWin;

  return {
    home_win: homeWin / total,
    draw: drawProb / total,
    away_win: awayWin / total,
    home_elo: homeElo,
    away_elo: awayElo,
    elo_diff: homeElo - awayElo,
    model: 'elo'
  };
}

export function updateEloRating(currentRating, actualScore, expectedScore) {
  return currentRating + K_FACTOR * (actualScore - expectedScore);
}

export function getEloUpdate(homeTeam, awayTeam, homeScore, awayScore) {
  const homeElo = (homeTeam?.elo_rating || DEFAULT_ELO) + HOME_ADVANTAGE;
  const awayElo = awayTeam?.elo_rating || DEFAULT_ELO;

  const homeExpected = getExpectedScore(homeElo, awayElo);
  const awayExpected = 1 - homeExpected;

  let homeActual, awayActual;
  if (homeScore > awayScore) { homeActual = 1; awayActual = 0; }
  else if (homeScore === awayScore) { homeActual = 0.5; awayActual = 0.5; }
  else { homeActual = 0; awayActual = 1; }

  return {
    new_home_elo: updateEloRating(homeTeam?.elo_rating || DEFAULT_ELO, homeActual, homeExpected),
    new_away_elo: updateEloRating(awayTeam?.elo_rating || DEFAULT_ELO, awayActual, awayExpected),
    home_delta: K_FACTOR * (homeActual - homeExpected),
    away_delta: K_FACTOR * (awayActual - awayExpected)
  };
}
