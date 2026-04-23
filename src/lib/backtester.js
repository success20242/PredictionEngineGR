/**
 * BACKTESTING ENGINE
 * Runs predictions against historical results.
 * Computes accuracy, ROI, win rate, drawdown.
 */

import { runEnsemble } from './ensembleEngine';

export function backtestPredictions(predictions) {
  const resolved = predictions.filter(p => p.actual_outcome && p.predicted_outcome);
  if (resolved.length === 0) return null;

  let correct = 0;
  let strongBetCorrect = 0;
  let strongBetTotal = 0;
  let mediumCorrect = 0;
  let mediumTotal = 0;

  // ROI simulation: 1 unit bet on each predicted outcome
  let totalBets = 0;
  let totalReturn = 0;
  let maxDrawdown = 0;
  let currentLoss = 0;
  let peakBalance = 0;
  let balance = 0;

  const leagueStats = {};

  resolved.forEach(pred => {
    const isCorrect = pred.predicted_outcome === pred.actual_outcome;
    if (isCorrect) correct++;

    // ROI calculation (using implied odds)
    const oddsMap = {
      HOME_WIN: pred.implied_home_odds,
      DRAW: pred.implied_draw_odds,
      AWAY_WIN: pred.implied_away_odds
    };
    const betOdds = oddsMap[pred.predicted_outcome] || 2.0;

    totalBets += 1;
    if (isCorrect) {
      const profit = betOdds - 1;
      totalReturn += profit;
      balance += profit;
    } else {
      totalReturn -= 1;
      balance -= 1;
    }

    if (balance > peakBalance) peakBalance = balance;
    const drawdown = peakBalance - balance;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

    // Value rating breakdown
    if (pred.value_rating === 'STRONG_BET') {
      strongBetTotal++;
      if (isCorrect) strongBetCorrect++;
    } else if (pred.value_rating === 'MEDIUM') {
      mediumTotal++;
      if (isCorrect) mediumCorrect++;
    }

    // League breakdown
    const league = pred.league_name || 'Unknown';
    if (!leagueStats[league]) leagueStats[league] = { total: 0, correct: 0 };
    leagueStats[league].total++;
    if (isCorrect) leagueStats[league].correct++;
  });

  const accuracy = correct / resolved.length;
  const roi = totalBets > 0 ? (totalReturn / totalBets) * 100 : 0;
  const winRate = correct / resolved.length;

  const leagueAccuracy = {};
  Object.entries(leagueStats).forEach(([league, stats]) => {
    leagueAccuracy[league] = {
      accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
      total: stats.total
    };
  });

  return {
    total_predictions: resolved.length,
    correct_predictions: correct,
    accuracy: parseFloat(accuracy.toFixed(4)),
    roi: parseFloat(roi.toFixed(2)),
    win_rate: parseFloat(winRate.toFixed(4)),
    max_drawdown: parseFloat(maxDrawdown.toFixed(2)),
    strong_bet_accuracy: strongBetTotal > 0 ? parseFloat((strongBetCorrect / strongBetTotal).toFixed(4)) : null,
    strong_bet_total: strongBetTotal,
    medium_accuracy: mediumTotal > 0 ? parseFloat((mediumCorrect / mediumTotal).toFixed(4)) : null,
    medium_total: mediumTotal,
    league_accuracy: leagueAccuracy,
    net_profit_units: parseFloat(totalReturn.toFixed(2))
  };
}

export function evaluateModelAccuracies(predictions) {
  const resolved = predictions.filter(p => p.actual_outcome && p.predicted_outcome);
  if (resolved.length === 0) return null;

  const modelCorrect = { poisson: 0, elo: 0, form: 0, xg: 0 };
  const modelTotal = { poisson: 0, elo: 0, form: 0, xg: 0 };

  resolved.forEach(pred => {
    const actual = pred.actual_outcome;

    // Check each sub-model's prediction
    const models = {
      poisson: pred.poisson_probs,
      elo: pred.elo_probs,
      form: pred.form_probs,
      xg: pred.xg_probs
    };

    Object.entries(models).forEach(([modelName, probs]) => {
      if (!probs) return;
      const preds = { home_win: probs.home_win || 0, draw: probs.draw || 0, away_win: probs.away_win || 0 };
      const modelPrediction = Object.entries(preds).reduce((a, b) => a[1] > b[1] ? a : b)[0].toUpperCase().replace('_', '_');
      const outcomeMap = { 'HOME_WIN': 'HOME_WIN', 'DRAW': 'DRAW', 'AWAY_WIN': 'AWAY_WIN' };
      const predicted = outcomeMap[modelPrediction] || 'HOME_WIN';
      modelTotal[modelName]++;
      if (predicted === actual) modelCorrect[modelName]++;
    });
  });

  return {
    poisson: modelTotal.poisson > 0 ? modelCorrect.poisson / modelTotal.poisson : 0.5,
    elo: modelTotal.elo > 0 ? modelCorrect.elo / modelTotal.elo : 0.5,
    form: modelTotal.form > 0 ? modelCorrect.form / modelTotal.form : 0.5,
    xg: modelTotal.xg > 0 ? modelCorrect.xg / modelTotal.xg : 0.5
  };
}

export function generateBacktestReport(predictions, modelName = 'Ensemble v1') {
  const metrics = backtestPredictions(predictions);
  if (!metrics) return null;

  const grade = metrics.accuracy >= 0.55 ? 'A' :
    metrics.accuracy >= 0.50 ? 'B' :
    metrics.accuracy >= 0.45 ? 'C' : 'D';

  return {
    ...metrics,
    model_name: modelName,
    grade,
    summary: `${modelName}: ${(metrics.accuracy * 100).toFixed(1)}% accuracy, ${metrics.roi > 0 ? '+' : ''}${metrics.roi.toFixed(1)}% ROI over ${metrics.total_predictions} predictions`,
    evaluated_at: new Date().toISOString()
  };
}
