import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Download, AlertCircle, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchUpcomingFixtures, fetchLeagueStandings, SUPPORTED_LEAGUES } from '@/lib/dataIngestion';
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
    queryFn: () => base44.entities.Prediction.list('-created_date', 50),
    refetchInterval: 30000
  });

  const { data: matches = [], refetch: refetchMatches } = useQuery({
    queryKey: ['matches'],
    queryFn: () => base44.entities.Match.list('-match_date', 50),
    refetchInterval: 30000
  });

  const { data: latestMetrics } = useQuery({
    queryKey: ['model-metrics'],
    queryFn: async () => {
      const metrics = await base44.entities.ModelMetrics.list('-created_date', 1);
      return metrics[0] || null;
    }
  });

  // Validate all match statuses
  const validatedMatches = matches.map(validateMatchStatus);

  // Merge predictions with match data
  const enrichedPredictions = predictions.map(pred => {
    const match = validatedMatches.find(m => m.id === pred.match_id) ||
      validatedMatches.find(m =>
        m.home_team_name === pred.home_team_name &&
        m.away_team_name === pred.away_team_name
      );
    return { prediction: pred, match: match || null };
  });

  // Filter
  const filtered = enrichedPredictions.filter(({ prediction, match }) => {
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

    // Create job record
    let jobRecord;
    try {
      jobRecord = await base44.entities.DataJob.create({
        job_type: 'FETCH_FIXTURES',
        league_name: leagueName,
        status: 'RUNNING',
        started_at: new Date().toISOString()
      });
    } catch (e) { /* non-critical */ }

    try {
      // Step 1: Fetch fixtures
      const fixturesData = await fetchUpcomingFixtures(leagueName, log);
      const fixtures = fixturesData.matches || [];
      log(`✓ Got ${fixtures.length} fixtures`);

      // Step 2: Fetch standings (for team stats)
      const standingsData = await fetchLeagueStandings(leagueName, log);
      const standings = standingsData.standings || [];
      log(`✓ Got ${standings.length} teams from standings`);

      // Step 3: Upsert teams
      const teamMap = {};
      for (const standing of standings) {
        const existing = await base44.entities.Team.filter({ name: standing.team, league_name: leagueName });
        const teamData = {
          name: standing.team,
          league_name: leagueName,
          position: standing.position,
          matches_played: standing.played,
          wins: standing.won,
          draws: standing.drawn,
          losses: standing.lost,
          goals_scored: standing.goals_for,
          goals_conceded: standing.goals_against,
          points: standing.points,
          form: standing.form || [],
          attack_strength: standing.attack_strength || 1.0,
          defense_strength: standing.defense_strength || 1.0,
          elo_rating: existing[0]?.elo_rating || 1500,
          season: '2024-25',
          last_updated: new Date().toISOString()
        };

        if (existing.length > 0) {
          await base44.entities.Team.update(existing[0].id, teamData);
          teamMap[standing.team] = { ...existing[0], ...teamData };
        } else {
          const created = await base44.entities.Team.create(teamData);
          teamMap[standing.team] = created;
        }
      }
      log(`✓ Upserted ${Object.keys(teamMap).length} teams`);

      // Step 4: Create matches + predictions
      const league = SUPPORTED_LEAGUES.find(l => l.name === leagueName);
      let predictionsCreated = 0;

      for (const fixture of fixtures.slice(0, 10)) { // limit for performance
        // Check if match already exists
        const existing = await base44.entities.Match.filter({
          home_team_name: fixture.home_team,
          away_team_name: fixture.away_team,
          league_name: leagueName
        });

        let matchRecord;
        const matchData = {
          home_team_name: fixture.home_team,
          away_team_name: fixture.away_team,
          league_name: leagueName,
          match_date: fixture.match_date,
          status: fixture.status || 'UPCOMING',
          venue: fixture.venue,
          round: fixture.round,
          season: '2024-25',
          reliability_score: fixture.reliability_score || 0.75,
          data_sources: fixturesData.sources || []
        };

        if (existing.length > 0) {
          await base44.entities.Match.update(existing[0].id, matchData);
          matchRecord = { ...existing[0], ...matchData };
        } else {
          matchRecord = await base44.entities.Match.create(matchData);
        }

        // Generate prediction
        const homeTeam = teamMap[fixture.home_team] || standingsData.standings?.find(s => s.team === fixture.home_team);
        const awayTeam = teamMap[fixture.away_team] || standingsData.standings?.find(s => s.team === fixture.away_team);

        if (homeTeam || awayTeam) {
          const predResult = runEnsemble(homeTeam, awayTeam, league);

          const predExisting = await base44.entities.Prediction.filter({ match_id: matchRecord.id });
          const predData = {
            match_id: matchRecord.id,
            home_team_name: fixture.home_team,
            away_team_name: fixture.away_team,
            league_name: leagueName,
            match_date: fixture.match_date,
            ...predResult,
            reliability_score: fixture.reliability_score || 0.75,
            model_version: 'v1.0'
          };

          if (predExisting.length > 0) {
            await base44.entities.Prediction.update(predExisting[0].id, predData);
          } else {
            await base44.entities.Prediction.create(predData);
            predictionsCreated++;
          }
        }
      }

      log(`✓ Generated ${predictionsCreated} predictions`);

      // Mark job complete
      if (jobRecord) {
        await base44.entities.DataJob.update(jobRecord.id, {
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          records_processed: fixtures.length
        });
      }

      refetchPredictions();
      refetchMatches();
      log(`✅ Done! ${leagueName} data updated.`);
    } catch (err) {
      setIngestError(err.message);
      if (jobRecord) {
        await base44.entities.DataJob.update(jobRecord.id, {
          status: 'FAILED',
          error_message: err.message
        });
      }
    } finally {
      setIsIngesting(false);
      setIngestLeague(null);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Multi-model ensemble predictions · Auto-refreshes every 30s</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/reports"
            className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-medium transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Reports
          </Link>
          <button
            onClick={() => { refetchPredictions(); refetchMatches(); }}
            className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium text-foreground transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <StatsBar predictions={predictions} metrics={latestMetrics} />

      {/* Data Ingestion */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="text-sm font-semibold text-foreground mb-3">Fetch Live Data</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {SUPPORTED_LEAGUES.map(league => (
            <button
              key={league.name}
              onClick={() => ingestDataForLeague(league.name)}
              disabled={isIngesting}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                isIngesting && ingestLeague === league.name
                  ? 'bg-accent-blue/20 text-accent-blue border-accent-blue/40 animate-pulse'
                  : 'bg-muted text-muted-foreground border-border hover:border-accent-blue/30 hover:text-foreground disabled:opacity-50'
              )}
            >
              {isIngesting && ingestLeague === league.name ? (
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  {league.short}...
                </span>
              ) : league.short}
            </button>
          ))}
        </div>

        {/* Ingestion log */}
        {ingestLog.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
            {ingestLog.map((msg, i) => (
              <div key={i} className="text-xs font-mono text-muted-foreground">{msg}</div>
            ))}
          </div>
        )}
        {ingestError && (
          <div className="flex items-center gap-2 mt-2 text-xs text-rose-400">
            <AlertCircle className="w-3.5 h-3.5" />
            {ingestError}
          </div>
        )}
      </div>

      {/* Filters + Grid */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <LeagueFilter selected={selectedLeague} onChange={setSelectedLeague} />
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <ConfidenceFilter selected={selectedConfidence} onChange={setSelectedConfidence} />
          </div>

          {predsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4 h-48 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="text-4xl mb-3">⚽</div>
              <div className="font-medium">No predictions yet</div>
              <div className="text-sm mt-1">Click a league above to fetch live data and generate predictions</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map(({ prediction, match }) => (
                <MatchCard
                  key={prediction.id}
                  prediction={prediction}
                  match={match}
                  onClick={() => { setSelectedPrediction(prediction); setSelectedMatch(match); }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="lg:w-72 space-y-4">
          <ModelWeightsPanel />
          {latestMetrics && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="text-sm font-semibold text-foreground">Last Evaluation</div>
              <div className="space-y-2">
                {[
                  { label: 'Accuracy', value: `${((latestMetrics.accuracy || 0) * 100).toFixed(1)}%` },
                  { label: 'ROI', value: `${latestMetrics.roi > 0 ? '+' : ''}${(latestMetrics.roi || 0).toFixed(1)}%` },
                  { label: 'Predictions', value: latestMetrics.total_predictions || 0 }
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
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
