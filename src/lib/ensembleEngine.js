/**
 * ENSEMBLE PREDICTION ENGINE
 * Combines Poisson, Elo, Form, and xG models using weighted averaging.
 * Self-adjusting weights based on historical performance.
 */

import { calculatePoissonProbabilities, getMostLikelyScore } from './poissonModel';
import { calculateEloProbabilities } from './eloModel';
import { calculateFormProbabilities, calculateXGProbabilities } from './formModel';

// Default weights — adjusted by self-learning system
export const DEFAULT_WEIGHTS = {
  poisson: 0.30,
  elo: 0.25,
  form: 0.25,
  xg: 0.20
};

export function runEnsemble(homeTeam, awayTeam, leagueData = {}, customWeights = null) {
  const weights = customWeights || DEFAULT_WEIGHTS;
  const leagueAvgGoals = leagueData?.avg_goals_per_match || 2.65;

  // Run all models
  const poissonResult = calculatePoissonProbabilities(homeTeam, awayTeam, leagueAvgGoals);
  const eloResult = calculateEloProbabilities(homeTeam, awayTeam);
  const formResult = calculateFormProbabilities(homeTeam, awayTeam);
  const xgResult = calculateXGProbabilities(homeTeam, awayTeam);

  // Weighted ensemble
  const ensembleHome =
    poissonResult.home_win * weights.poisson +
    eloResult.home_win * weights.elo +
    formResult.home_win * weights.form +
    xgResult.home_win * weights.xg;

  const ensembleDraw =
    poissonResult.draw * weights.poisson +
    eloResult.draw * weights.elo +
    formResult.draw * weights.form +
    xgResult.draw * weights.xg;

  const ensembleAway =
    poissonResult.away_win * weights.poisson +
    eloResult.away_win * weights.elo +
    formResult.away_win * weights.form +
    xgResult.away_win * weights.xg;

  // Normalize
  const total = ensembleHome + ensembleDraw + ensembleAway;
  const homeWin = ensembleHome / total;
  const draw = ensembleDraw / total;
  const awayWin = ensembleAway / total;

  // Predicted outcome
  const maxProb = Math.max(homeWin, draw, awayWin);
  let predictedOutcome;
  if (maxProb === homeWin) predictedOutcome = 'HOME_WIN';
  else if (maxProb === draw) predictedOutcome = 'DRAW';
  else predictedOutcome = 'AWAY_WIN';

  // Confidence: how decisive the top prediction is
  const sorted = [homeWin, draw, awayWin].sort((a, b) => b - a);
  const confidence = sorted[0] - sorted[1]; // gap between 1st and 2nd
  const confidenceScore = Math.min(1, confidence * 3.5); // scale to 0-1

  // Implied odds
  const impliedHomeOdds = homeWin > 0 ? (1 / homeWin).toFixed(2) : null;
  const impliedDrawOdds = draw > 0 ? (1 / draw).toFixed(2) : null;
  const impliedAwayOdds = awayWin > 0 ? (1 / awayWin).toFixed(2) : null;

  // Value rating
  const valueRating = getValueRating(confidenceScore, maxProb, predictedOutcome);

  // Most likely score from Poisson
  const likelyScore = getMostLikelyScore(poissonResult.score_matrix);

  return {
    home_win_prob: parseFloat(homeWin.toFixed(4)),
    draw_prob: parseFloat(draw.toFixed(4)),
    away_win_prob: parseFloat(awayWin.toFixed(4)),
    predicted_outcome: predictedOutcome,
    confidence: parseFloat(confidenceScore.toFixed(4)),
    value_rating: valueRating,
    predicted_home_goals: parseFloat(poissonResult.expected_home_goals.toFixed(2)),
    predicted_away_goals: parseFloat(poissonResult.expected_away_goals.toFixed(2)),
    most_likely_score: likelyScore,
    implied_home_odds: parseFloat(impliedHomeOdds),
    implied_draw_odds: parseFloat(impliedDrawOdds),
    implied_away_odds: parseFloat(impliedAwayOdds),
    poisson_probs: { home_win: poissonResult.home_win, draw: poissonResult.draw, away_win: poissonResult.away_win },
    elo_probs: { home_win: eloResult.home_win, draw: eloResult.draw, away_win: eloResult.away_win },
    form_probs: { home_win: formResult.home_win, draw: formResult.draw, away_win: formResult.away_win },
    xg_probs: { home_win: xgResult.home_win, draw: xgResult.draw, away_win: xgResult.away_win },
    ensemble_weights: weights,
    model_details: { poisson: poissonResult, elo: eloResult, form: formResult, xg: xgResult }
  };
}

function getValueRating(confidence, maxProb, outcome) {
  if (confidence > 0.25 && maxProb > 0.55) return 'STRONG_BET';
  if (confidence > 0.12 && maxProb > 0.40) return 'MEDIUM';
  return 'AVOID';
}

// Adjust weights based on historical model performance
export function rebalanceWeights(modelAccuracies) {
  const { poisson = 0.5, elo = 0.5, form = 0.5, xg = 0.5 } = modelAccuracies;
  const totalAcc = poisson + elo + form + xg;

  if (totalAcc === 0) return DEFAULT_WEIGHTS;

  // Softmax-style normalization
  const raw = {
    poisson: Math.exp(poisson * 3),
    elo: Math.exp(elo * 3),
    form: Math.exp(form * 3),
    xg: Math.exp(xg * 3)
  };
  const rawTotal = raw.poisson + raw.elo + raw.form + raw.xg;

  return {
    poisson: parseFloat((raw.poisson / rawTotal).toFixed(3)),
    elo: parseFloat((raw.elo / rawTotal).toFixed(3)),
    form: parseFloat((raw.form / rawTotal).toFixed(3)),
    xg: parseFloat((raw.xg / rawTotal).toFixed(3))
  };
}
