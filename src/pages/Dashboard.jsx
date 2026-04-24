import { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, AlertCircle, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  fetchUpcomingFixtures,
  fetchLeagueStandings,
  SUPPORTED_LEAGUES
} from '@/lib/dataIngestion';
import { runEnsemble } from '@/lib/ensembleEngine';
import { validateMatchStatus } from '@/lib/matchValidator';

import MatchCard from '@/components/predictions/MatchCard';
import StatsBar from '@/components/predictions/StatsBar';
import LeagueFilter from '@/components/predictions/LeagueFilter';
import ConfidenceFilter from '@/components/predictions/ConfidenceFilter';
import MatchDetailModal from '@/components/predictions/MatchDetailModal';
import ModelWeightsPanel from '@/components/predictions/ModelWeightsPanel';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [selectedConfidence, setSelectedConfidence] = useState(null);
  const [selectedPrediction, setSelectedPrediction] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestLeague, setIngestLeague] = useState(null);
  const [ingestLog, setIngestLog] = useState([]);
  const [ingestError, setIngestError] = useState(null);

  const { data: predictions = [], refetch: refetchPredictions, isLoading: predsLoading } = useQuery({
    queryKey: ['predictions'],
    queryFn: () => apiClient.entities.Prediction.list('-created_date', 50),
    refetchInterval: 30000
  });

  const { data: matches = [], refetch: refetchMatches } = useQuery({
    queryKey: ['matches'],
    queryFn: () => apiClient.entities.Match.list('-match_date', 50),
    refetchInterval: 30000
  });

  const { data: latestMetrics } = useQuery({
    queryKey: ['model-metrics'],
    queryFn: async () => {
      const metrics = await apiClient.entities.ModelMetrics.list('-created_date', 1);
      return metrics[0] || null;
    }
  });

  const validatedMatches = matches.map(validateMatchStatus);

  const enrichedPredictions = predictions.map(pred => {
    const match = validatedMatches.find(m => m.id === pred.match_id) ||
      validatedMatches.find(m =>
        m.home_team_name === pred.home_team_name &&
        m.away_team_name === pred.away_team_name
      );

    return { prediction: pred, match: match || null };
  });

  const filtered = enrichedPredictions.filter(({ prediction }) => {
    if (selectedLeague && prediction.league_name !== selectedLeague) return false;
    if (selectedConfidence && prediction.value_rating !== selectedConfidence) return false;
    return true;
  });

  async function ingestDataForLeague(leagueName) {
    setIsIngesting(true);
    setIngestLeague(leagueName);
    setIngestLog([]);
    setIngestError(null);

    const log = (msg) => setIngestLog(prev => [...prev, msg]);

    try {
      const fixturesData = await fetchUpcomingFixtures(leagueName, log);
      const fixtures = fixturesData?.matches || [];
      log(`✓ Got ${fixtures.length} fixtures`);

      const standingsData = await fetchLeagueStandings(leagueName, log);
      const rawStandings = standingsData?.standings || [];

      log(`✓ Raw standings rows: ${rawStandings.length}`);

      // 🔥 SAFE NORMALIZATION (FIX)
      const standings = rawStandings
        .filter(Boolean)
        .map(s => ({
          team:
            s.team ||
            s.Team ||
            s.name ||
            s.Name ||
            'UNKNOWN_TEAM',

          played: s.played ?? s.P ?? 1,
          won: s.won ?? s.W ?? 0,
          drawn: s.drawn ?? s.D ?? 0,
          lost: s.lost ?? s.L ?? 0,

          goals_for: s.goals_for ?? s.GF ?? 0,
          goals_against: s.goals_against ?? s.GA ?? 0,
          points: s.points ?? s.Pts ?? 0,

          form: s.form || []
        }));

      log(`✓ Normalized standings: ${standings.length} teams`);

      const teamMap = {};

      for (const standing of standings) {
        if (!standing.team || standing.team === 'UNKNOWN_TEAM') {
          log(`⚠️ Skipped invalid team row`);
          continue;
        }

        const existing = await apiClient.entities.Team.filter({
          name: standing.team,
          league_name: leagueName
        });

        const teamData = {
          name: standing.team,
          league_name: leagueName,
          position: standing.position || 0,
          matches_played: standing.played,
          wins: standing.won,
          draws: standing.drawn,
          losses: standing.lost,
          goals_scored: standing.goals_for,
          goals_conceded: standing.goals_against,
          points: standing.points,
          form: standing.form,
          elo_rating: existing[0]?.elo_rating || 1500,
          season: '2024-25',
          last_updated: new Date().toISOString()
        };

        if (existing.length > 0) {
          await apiClient.entities.Team.update(existing[0].id, teamData);
          teamMap[standing.team] = { ...existing[0], ...teamData };
        } else {
          const created = await apiClient.entities.Team.create(teamData);
          teamMap[standing.team] = created;
        }
      }

      log(`✓ Upserted ${Object.keys(teamMap).length} teams`);

      let predictionsCreated = 0;

      for (const fixture of fixtures.slice(0, 10)) {
        const matchRecord = await apiClient.entities.Match.create({
          home_team_name: fixture.home_team,
          away_team_name: fixture.away_team,
          league_name: leagueName,
          match_date: fixture.match_date,
          status: fixture.status || 'UPCOMING'
        });

        const homeTeam = teamMap[fixture.home_team];
        const awayTeam = teamMap[fixture.away_team];

        if (!homeTeam || !awayTeam) {
          log(`⚠️ Missing team data: ${fixture.home_team} vs ${fixture.away_team}`);
          continue;
        }

        const predResult = runEnsemble(homeTeam, awayTeam);

        await apiClient.entities.Prediction.create({
          match_id: matchRecord.id,
          home_team_name: fixture.home_team,
          away_team_name: fixture.away_team,
          league_name: leagueName,
          match_date: fixture.match_date,
          ...predResult
        });

        predictionsCreated++;
      }

      log(`✓ Generated ${predictionsCreated} predictions`);
      log(`✅ Done ${leagueName}`);

      refetchPredictions();
      refetchMatches();

    } catch (err) {
      console.error(err);
      setIngestError(err.message);
    } finally {
      setIsIngesting(false);
      setIngestLeague(null);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>

        <button
          onClick={() => { refetchPredictions(); refetchMatches(); }}
          className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <StatsBar predictions={predictions} metrics={latestMetrics} />

      <div className="bg-card border rounded-xl p-4">
        <div className="text-sm font-semibold mb-3">Fetch Live Data</div>

        <div className="flex flex-wrap gap-2">
          {SUPPORTED_LEAGUES.map(league => (
            <button
              key={league.name}
              onClick={() => ingestDataForLeague(league.name)}
              disabled={isIngesting}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs border',
                isIngesting ? 'opacity-50' : ''
              )}
            >
              {league.short}
            </button>
          ))}
        </div>

        {ingestError && (
          <div className="mt-2 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-3 h-3" />
            {ingestError}
          </div>
        )}

        {ingestLog.map((l, i) => (
          <div key={i} className="text-xs text-muted-foreground font-mono">
            {l}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(({ prediction }) => (
          <MatchCard key={prediction.id} prediction={prediction} />
        ))}
      </div>

    </div>
  );
}
