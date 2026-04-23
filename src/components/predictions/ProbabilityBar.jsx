import { cn } from '@/lib/utils';

export default function ProbabilityBar({ homeProb, drawProb, awayProb, predictedOutcome }) {
  const hp = ((homeProb || 0) * 100).toFixed(0);
  const dp = ((drawProb || 0) * 100).toFixed(0);
  const ap = ((awayProb || 0) * 100).toFixed(0);

  return (
    <div className="space-y-1">
      {/* Bar */}
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
        <div
          className={cn('h-full rounded-l-full transition-all', predictedOutcome === 'HOME_WIN' ? 'bg-accent-blue' : 'bg-accent-blue/30')}
          style={{ width: `${hp}%` }}
        />
        <div
          className={cn('h-full transition-all', predictedOutcome === 'DRAW' ? 'bg-amber-400' : 'bg-amber-400/30')}
          style={{ width: `${dp}%` }}
        />
        <div
          className={cn('h-full rounded-r-full transition-all', predictedOutcome === 'AWAY_WIN' ? 'bg-violet-400' : 'bg-violet-400/30')}
          style={{ width: `${ap}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className={cn(predictedOutcome === 'HOME_WIN' ? 'text-accent-blue font-semibold' : '')}>{hp}%</span>
        <span className={cn(predictedOutcome === 'DRAW' ? 'text-amber-400 font-semibold' : '')}>{dp}%</span>
        <span className={cn(predictedOutcome === 'AWAY_WIN' ? 'text-violet-400 font-semibold' : '')}>{ap}%</span>
      </div>
    </div>
  );
}
