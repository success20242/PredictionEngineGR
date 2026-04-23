import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Activity, RefreshCw, Clock } from 'lucide-react';
import { validateMatchStatus, getMatchMinute } from '@/lib/matchValidator';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, parseISO } from 'date-fns';

export default function LiveMatches() {
  const { data: matches = [], refetch, isLoading } = useQuery({
    queryKey: ['live-matches'],
    queryFn: () => base44.entities.Match.list('-match_date', 100),
    refetchInterval: 30000
  });

  const { data: predictions = [] } = useQuery({
    queryKey: ['predictions-live'],
    queryFn: () => base44.entities.Prediction.list('-created_date', 100),
    refetchInterval: 30000
  });

  const validated = matches.map(validateMatchStatus);
  const liveMatches = validated.filter(m => m.status === 'LIVE');
  const upcomingMatches = validated.filter(m => m.status === 'UPCOMING').slice(0, 20);

  const getPrediction = (match) => predictions.find(p =>
    p.match_id === match.id ||
    (p.home_team_name === match.home_team_name && p.away_team_name === match.away_team_name)
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-rose-400" />
            Live Matches
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Real-time validated match states · Refreshes every 30s</p>
        </div>
        <button onClick={refetch} className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-colors">
          <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* LIVE */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
          <span className="text-sm font-semibold text-foreground">In Progress ({liveMatches.length})</span>
        </div>
        {liveMatches.length === 0 ? (
          <div className="text-sm text-muted-foreground bg-card border border-border rounded-xl p-6 text-center">
            No live matches right now
          </div>
        ) : (
          <div className="space-y-3">
            {liveMatches.map(match => {
              const pred = getPrediction(match);
              const minute = match.minute || getMatchMinute(match);
              return (
                <LiveMatchRow key={match.id} match={match} prediction={pred} minute={minute} />
              );
            })}
          </div>
        )}
      </div>

      {/* Upcoming */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-semibold text-foreground">Upcoming ({upcomingMatches.length})</span>
        </div>
        {upcomingMatches.length === 0 ? (
          <div className="text-sm text-muted-foreground bg-card border border-border rounded-xl p-6 text-center">
            No upcoming matches. Fetch fixtures from the Dashboard.
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingMatches.map(match => {
              const pred = getPrediction(match);
              return (
                <UpcomingMatchRow key={match.id} match={match} prediction={pred} />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function LiveMatchRow({ match, prediction, minute }) {
  return (
    <div className="bg-card border border-rose-500/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{match.league_name} · {match.round}</span>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
          <span className="text-xs font-bold text-rose-400">{minute ? `${minute}'` : 'LIVE'}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 items-center">
        <div className="font-semibold text-sm">{match.home_team_name}</div>
        <div className="text-center text-2xl font-bold text-foreground">
          {match.home_score ?? 0} – {match.away_score ?? 0}
        </div>
        <div className="font-semibold text-sm text-right">{match.away_team_name}</div>
      </div>
      {prediction && (
        <div className="mt-3 pt-3 border-t border-border/50 flex justify-between text-xs text-muted-foreground">
          <span>Predicted: <span className="text-foreground font-medium">{prediction.predicted_outcome?.replace('_', ' ')}</span></span>
          <span>Confidence: <span className="text-accent-blue font-medium">{((prediction.confidence || 0) * 100).toFixed(0)}%</span></span>
        </div>
      )}
    </div>
  );
}

function UpcomingMatchRow({ match, prediction }) {
  const matchDate = match.match_date ? parseISO(match.match_date) : null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="text-xs text-muted-foreground w-16">
          {matchDate ? formatDistanceToNow(matchDate, { addSuffix: true }) : ''}
        </div>
        <div className="text-sm font-medium text-foreground">
          {match.home_team_name} <span className="text-muted-foreground">vs</span> {match.away_team_name}
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{match.league_name}</span>
        {prediction && (
          <span className={cn(
            'px-2 py-0.5 rounded-md font-medium border',
            prediction.value_rating === 'STRONG_BET' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
            prediction.value_rating === 'MEDIUM' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
            'text-muted-foreground bg-muted border-border'
          )}>
            {prediction.value_rating?.replace('_', ' ')}
          </span>
        )}
      </div>
    </div>
  );
}
