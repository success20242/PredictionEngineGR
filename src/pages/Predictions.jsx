import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Zap, RefreshCw, Filter } from 'lucide-react';
import { validateMatchStatus } from '@/lib/matchValidator';
import MatchCard from '@/components/predictions/MatchCard';
import MatchDetailModal from '@/components/predictions/MatchDetailModal';
import LeagueFilter from '@/components/predictions/LeagueFilter';
import ConfidenceFilter from '@/components/predictions/ConfidenceFilter';
import { cn } from '@/lib/utils';

const DATE_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Tomorrow', value: 'tomorrow' },
  { label: 'This Week', value: 'week' }
];

export default function Predictions() {
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [selectedConfidence, setSelectedConfidence] = useState(null);
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedPrediction, setSelectedPrediction] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [sortBy, setSortBy] = useState('confidence');

  const { data: predictions = [], isLoading, refetch } = useQuery({
    queryKey: ['all-predictions'],
    queryFn: () => base44.entities.Prediction.list('-created_date', 100),
    refetchInterval: 60000
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['all-matches'],
    queryFn: () => base44.entities.Match.list('-match_date', 100),
    refetchInterval: 60000
  });

  const validatedMatches = matches.map(validateMatchStatus);

  function matchesDateFilter(pred) {
    if (dateFilter === 'all') return true;
    const date = new Date(pred.match_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    if (dateFilter === 'today') return date >= today && date < tomorrow;
    if (dateFilter === 'tomorrow') return date >= tomorrow && date < new Date(tomorrow.getTime() + 86400000);
    if (dateFilter === 'week') return date >= today && date <= weekEnd;
    return true;
  }

  const filtered = predictions
    .filter(pred => {
      if (selectedLeague && pred.league_name !== selectedLeague) return false;
      if (selectedConfidence && pred.value_rating !== selectedConfidence) return false;
      if (!matchesDateFilter(pred)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'confidence') return (b.confidence || 0) - (a.confidence || 0);
      if (sortBy === 'date') return new Date(a.match_date) - new Date(b.match_date);
      if (sortBy === 'value') {
        const order = { STRONG_BET: 0, MEDIUM: 1, AVOID: 2 };
        return (order[a.value_rating] || 2) - (order[b.value_rating] || 2);
      }
      return 0;
    });

  const strongBets = filtered.filter(p => p.value_rating === 'STRONG_BET');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent-blue" />
            All Predictions
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} predictions · {strongBets.length} strong bets</p>
        </div>
        <button onClick={refetch} className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5" />
          Filters
        </div>
        <LeagueFilter selected={selectedLeague} onChange={setSelectedLeague} />
        <ConfidenceFilter selected={selectedConfidence} onChange={setSelectedConfidence} />

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Date:</span>
          {DATE_FILTERS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDateFilter(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                dateFilter === opt.value
                  ? 'bg-accent-blue/15 text-accent-blue border-accent-blue/30'
                  : 'bg-muted text-muted-foreground border-border hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}

          <span className="text-xs text-muted-foreground ml-3">Sort:</span>
          {[
            { label: 'Confidence', value: 'confidence' },
            { label: 'Date', value: 'date' },
            { label: 'Value', value: 'value' }
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                sortBy === opt.value
                  ? 'bg-accent-blue/15 text-accent-blue border-accent-blue/30'
                  : 'bg-muted text-muted-foreground border-border hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Predictions Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 h-52 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">🔍</div>
          <div className="font-medium">No predictions match your filters</div>
          <div className="text-sm mt-1">Try adjusting the filters above</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(prediction => {
            const match = validatedMatches.find(m =>
              m.id === prediction.match_id ||
              (m.home_team_name === prediction.home_team_name && m.away_team_name === prediction.away_team_name)
            );
            return (
              <MatchCard
                key={prediction.id}
                prediction={prediction}
                match={match}
                onClick={() => { setSelectedPrediction(prediction); setSelectedMatch(match || null); }}
              />
            );
          })}
        </div>
      )}

      {selectedPrediction && (
        <MatchDetailModal
          prediction={selectedPrediction}
          match={selectedMatch}
          onClose={() => { setSelectedPrediction(null); setSelectedMatch(null); }}
        />
      )}
    </div>
  );
}
