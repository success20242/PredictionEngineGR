import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, Zap, Shield, ArrowRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import ProbabilityBar from './ProbabilityBar';
import { cn } from '@/lib/utils';

export default function MatchDetailModal({ prediction, match, onClose }) {
  if (!prediction && !match) return null;

  const homeTeam = prediction?.home_team_name || match?.home_team_name;
  const awayTeam = prediction?.away_team_name || match?.away_team_name;
  const matchDate = (match?.match_date || prediction?.match_date) ? parseISO(match?.match_date || prediction?.match_date) : null;

  const subModels = prediction ? [
    { key: 'Poisson', probs: prediction.poisson_probs, weight: prediction.ensemble_weights?.poisson },
    { key: 'Elo', probs: prediction.elo_probs, weight: prediction.ensemble_weights?.elo },
    { key: 'Form', probs: prediction.form_probs, weight: prediction.ensemble_weights?.form },
    { key: 'xG', probs: prediction.xg_probs, weight: prediction.ensemble_weights?.xg }
  ] : [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={e => e.stopPropagation()}
          className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div>
              <div className="text-xs text-muted-foreground mb-1">{prediction?.league_name || match?.league_name}</div>
              <div className="font-bold text-foreground">{homeTeam} vs {awayTeam}</div>
              {matchDate && <div className="text-xs text-muted-foreground mt-0.5">{format(matchDate, 'EEE, MMM d yyyy · HH:mm')}</div>}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Main prediction */}
            {prediction && (
              <>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ensemble Prediction</div>
                  <ProbabilityBar
                    homeProb={prediction.home_win_prob}
                    drawProb={prediction.draw_prob}
                    awayProb={prediction.away_win_prob}
                    predictedOutcome={prediction.predicted_outcome}
                  />
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {[
                      { label: homeTeam, prob: prediction.home_win_prob, odds: prediction.implied_home_odds },
                      { label: 'Draw', prob: prediction.draw_prob, odds: prediction.implied_draw_odds },
                      { label: awayTeam, prob: prediction.away_win_prob, odds: prediction.implied_away_odds }
                    ].map(({ label, prob, odds }) => (
                      <div key={label} className="bg-muted rounded-lg p-3 text-center">
                        <div className="text-xs text-muted-foreground truncate mb-1">{label}</div>
                        <div className="text-lg font-bold text-foreground">{odds?.toFixed(2) || '—'}</div>
                        <div className="text-xs text-muted-foreground">{((prob || 0) * 100).toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Expected score */}
                <div className="bg-muted/50 rounded-xl p-4 flex items-center justify-between">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Expected Goals</div>
                    <div className="text-2xl font-bold text-foreground">{prediction.predicted_home_goals?.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-20">{homeTeam}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Expected Goals</div>
                    <div className="text-2xl font-bold text-foreground">{prediction.predicted_away_goals?.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-20">{awayTeam}</div>
                  </div>
                </div>

                {/* Sub-model breakdown */}
                {subModels.some(m => m.probs) && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Model Breakdown</div>
                    <div className="space-y-2.5">
                      {subModels.filter(m => m.probs).map(({ key, probs, weight }) => (
                        <div key={key} className="bg-muted/50 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-medium text-foreground">{key}</span>
                            {weight && <span className="text-xs text-accent-blue">{(weight * 100).toFixed(0)}% weight</span>}
                          </div>
                          <ProbabilityBar
                            homeProb={probs.home_win}
                            drawProb={probs.draw}
                            awayProb={probs.away_win}
                            predictedOutcome={null}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Confidence + reliability */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Zap className="w-3.5 h-3.5 text-accent-blue" />
                      <span className="text-xs text-muted-foreground">Confidence</span>
                    </div>
                    <div className="text-xl font-bold text-accent-blue">{((prediction.confidence || 0) * 100).toFixed(0)}%</div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Shield className="w-3.5 h-3.5 text-violet-400" />
                      <span className="text-xs text-muted-foreground">Reliability</span>
                    </div>
                    <div className="text-xl font-bold text-violet-400">{((prediction.reliability_score || 0.75) * 100).toFixed(0)}%</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
