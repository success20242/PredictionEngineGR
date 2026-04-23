import { motion } from 'framer-motion';
import { TrendingUp, Shield, Zap, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import ProbabilityBar from './ProbabilityBar';

const VALUE_CONFIG = {
  STRONG_BET: { label: 'Strong Bet', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  MEDIUM: { label: 'Medium', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  AVOID: { label: 'Avoid', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30', dot: 'bg-rose-400' }
};

const OUTCOME_LABELS = { HOME_WIN: 'Home Win', DRAW: 'Draw', AWAY_WIN: 'Away Win' };
const STATUS_CONFIG = {
  LIVE: { label: 'LIVE', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30', pulse: true },
  UPCOMING: { label: 'Upcoming', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30', pulse: false },
  FINISHED: { label: 'FT', color: 'text-muted-foreground bg-muted border-border', pulse: false }
};

export default function MatchCard({ prediction, match, onClick }) {
  const valueConfig = VALUE_CONFIG[prediction?.value_rating] || VALUE_CONFIG.AVOID;
  const statusConfig = STATUS_CONFIG[match?.status] || STATUS_CONFIG.UPCOMING;

  const matchDate = match?.match_date ? parseISO(match.match_date) : null;
  const confidence = prediction?.confidence || 0;
  const reliability = prediction?.reliability_score || match?.reliability_score || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-accent-blue/40 hover:shadow-lg hover:shadow-accent-blue/5 transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
            {match?.league_name || prediction?.league_name}
          </span>
          {match?.round && (
            <span className="text-xs text-muted-foreground">{match.round}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-md border', statusConfig.color)}>
            {statusConfig.pulse && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse mr-1.5" />
            )}
            {match?.status === 'LIVE' && match?.minute ? `${match.minute}'` : statusConfig.label}
          </span>
        </div>
      </div>

      {/* Teams + Score */}
      <div className="grid grid-cols-3 items-center gap-2 mb-4">
        <div className="text-left">
          <div className="font-semibold text-foreground text-sm leading-tight">{prediction?.home_team_name || match?.home_team_name}</div>
          {match?.status !== 'UPCOMING' && (
            <div className="text-2xl font-bold text-foreground mt-1">{match?.home_score ?? '-'}</div>
          )}
        </div>

        <div className="text-center">
          {match?.status === 'UPCOMING' ? (
            <div className="space-y-1">
              <div className="text-lg font-bold text-muted-foreground/50">vs</div>
              {matchDate && (
                <div className="text-xs text-muted-foreground">
                  <div>{format(matchDate, 'MMM d')}</div>
                  <div className="font-medium text-foreground/70">{format(matchDate, 'HH:mm')}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-lg font-bold text-muted-foreground">—</div>
          )}
        </div>

        <div className="text-right">
          <div className="font-semibold text-foreground text-sm leading-tight">{prediction?.away_team_name || match?.away_team_name}</div>
          {match?.status !== 'UPCOMING' && (
            <div className="text-2xl font-bold text-foreground mt-1">{match?.away_score ?? '-'}</div>
          )}
        </div>
      </div>

      {/* Prediction Section */}
      {prediction && (
        <>
          <ProbabilityBar
            homeProb={prediction.home_win_prob}
            drawProb={prediction.draw_prob}
            awayProb={prediction.away_win_prob}
            predictedOutcome={prediction.predicted_outcome}
          />

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Value rating badge */}
              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1', valueConfig.color)}>
                <span className={cn('w-1.5 h-1.5 rounded-full', valueConfig.dot)} />
                {valueConfig.label}
              </span>

              {/* Predicted outcome */}
              <span className="text-xs text-muted-foreground">
                {OUTCOME_LABELS[prediction.predicted_outcome]}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {/* Confidence */}
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-accent-blue" />
                <span className={cn(confidence > 0.4 ? 'text-accent-blue font-semibold' : '')}>
                  {(confidence * 100).toFixed(0)}%
                </span>
              </div>
              {/* Reliability */}
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                <span>{(reliability * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* Implied odds row */}
          <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-3 gap-1 text-center">
            <div>
              <div className="text-xs text-muted-foreground">1</div>
              <div className="text-sm font-bold text-foreground">{prediction.implied_home_odds?.toFixed(2) || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">X</div>
              <div className="text-sm font-bold text-foreground">{prediction.implied_draw_odds?.toFixed(2) || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">2</div>
              <div className="text-sm font-bold text-foreground">{prediction.implied_away_odds?.toFixed(2) || '—'}</div>
            </div>
          </div>

          {/* Result accuracy indicator for finished matches */}
          {match?.status === 'FINISHED' && prediction.was_correct !== null && prediction.was_correct !== undefined && (
            <div className={cn(
              'mt-2 flex items-center gap-1.5 text-xs font-medium',
              prediction.was_correct ? 'text-emerald-400' : 'text-rose-400'
            )}>
              {prediction.was_correct ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {prediction.was_correct ? 'Correct prediction' : 'Incorrect prediction'}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
