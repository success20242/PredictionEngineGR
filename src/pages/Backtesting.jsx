import { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, Play, RefreshCw, Award, AlertCircle } from 'lucide-react';
import { generateBacktestReport, evaluateModelAccuracies } from '@/lib/backtester';
import { rebalanceWeights } from '@/lib/ensembleEngine';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, parseISO } from 'date-fns';

export default function Backtesting() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastReport, setLastReport] = useState(null);
  const [log, setLog] = useState([]);
  const qc = useQueryClient();

  const { data: predictions = [] } = useQuery({
    queryKey: ['predictions-backtest'],
    queryFn: () => apiClient.get('/predictions?limit=500&sort=-created_date')
  });

  const { data: allMetrics = [] } = useQuery({
    queryKey: ['all-metrics'],
    queryFn: () => apiClient.get('/model-metrics?limit=20&sort=-created_date')
  });

  const resolvedPredictions = predictions.filter(p => p.actual_outcome);
  const pendingEval = predictions.filter(p => !p.actual_outcome && p.predicted_outcome);

  async function runBacktest() {
    setIsRunning(true);
    setLog([]);
    const addLog = (msg) => setLog(prev => [...prev, msg]);

    try {
      addLog(`Running backtest on ${resolvedPredictions.length} resolved predictions...`);

      const report = generateBacktestReport(resolvedPredictions, 'Ensemble v1.0');
      if (!report) {
        addLog('⚠️ Not enough resolved predictions to backtest. Predictions need actual_outcome set.');
        setIsRunning(false);
        return;
      }

      addLog(`✓ Accuracy: ${(report.accuracy * 100).toFixed(1)}%`);
      addLog(`✓ ROI: ${report.roi > 0 ? '+' : ''}${report.roi.toFixed(1)}%`);
      addLog(`✓ Win Rate: ${(report.win_rate * 100).toFixed(1)}%`);
      addLog(`✓ Grade: ${report.grade}`);

      const modelAccuracies = evaluateModelAccuracies(resolvedPredictions);
      addLog(`✓ Model accuracies computed`);

      const newWeights = rebalanceWeights(modelAccuracies);
      addLog(`✓ Rebalanced weights: Poisson ${(newWeights.poisson * 100).toFixed(0)}%, Elo ${(newWeights.elo * 100).toFixed(0)}%, Form ${(newWeights.form * 100).toFixed(0)}%, xG ${(newWeights.xg * 100).toFixed(0)}%`);

      const metricsRecord = await apiClient.post('/model-metrics', {
        model_name: 'Ensemble v1.0',
        version: `v1.0.${Date.now()}`,
        accuracy: report.accuracy,
        roi: report.roi,
        win_rate: report.win_rate,
        total_predictions: report.total_predictions,
        correct_predictions: report.correct_predictions,
        strong_bet_accuracy: report.strong_bet_accuracy,
        medium_accuracy: report.medium_accuracy,
        ensemble_weights: newWeights,
        league_accuracy: report.league_accuracy,
        evaluated_at: new Date().toISOString(),
        notes: report.summary
      });

      addLog(`✅ Metrics saved to database`);
      setLastReport({ ...report, new_weights: newWeights });
      qc.invalidateQueries({ queryKey: ['all-metrics'] });
      qc.invalidateQueries({ queryKey: ['model-metrics'] });

    } catch (err) {
      addLog(`❌ Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  }

  async function evaluatePredictions() {
    setIsRunning(true);
    setLog([]);
    const addLog = msg => setLog(prev => [...prev, msg]);

    try {
      const matches = await apiClient.get('/matches?limit=200&sort=-match_date');
      const finishedMatches = (matches || []).filter(m => m.status === 'FINISHED' && m.home_score != null);

      addLog(`Found ${finishedMatches.length} finished matches...`);
      let updated = 0;

      for (const match of finishedMatches) {
        const pred = predictions.find(p =>
          (p.match_id === match.id || (p.home_team_name === match.home_team_name && p.away_team_name === match.away_team_name))
          && !p.actual_outcome
        );

        if (pred) {
          const actual = match.home_score > match.away_score ? 'HOME_WIN' :
            match.home_score === match.away_score ? 'DRAW' : 'AWAY_WIN';

          await apiClient.put(`/predictions/${pred.id}`, {
            actual_outcome: actual,
            was_correct: pred.predicted_outcome === actual
          });

          updated++;
        }
      }

      addLog(`✓ Updated ${updated} predictions with actual outcomes`);
      qc.invalidateQueries({ queryKey: ['predictions-backtest'] });

    } catch (err) {
      addLog(`❌ Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  }

  const accuracyChartData = allMetrics.slice().reverse().map((m, i) => ({
    index: i + 1,
    accuracy: parseFloat(((m.accuracy || 0) * 100).toFixed(1)),
    roi: parseFloat((m.roi || 0).toFixed(1))
  }));

  const leagueChartData = allMetrics[0]?.league_accuracy
    ? Object.entries(allMetrics[0].league_accuracy).map(([league, data]) => ({
        league: league.split(' ')[0],
        accuracy: parseFloat(((data.accuracy || 0) * 100).toFixed(1)),
        total: data.total
      }))
    : [];

  const latestMetrics = allMetrics[0];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-violet-400" />
            Backtesting Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Self-learning evaluation · Auto-rebalances model weights
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={evaluatePredictions}
            disabled={isRunning}
            className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isRunning && 'animate-spin')} />
            Evaluate Results
          </button>

          <button
            onClick={runBacktest}
            disabled={isRunning || resolvedPredictions.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-violet-500/15 text-violet-400 border border-violet-500/30 rounded-lg text-sm font-medium"
          >
            <Play className="w-3.5 h-3.5" />
            Run Backtest
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Resolved', value: resolvedPredictions.length, color: 'text-sky-400' },
          { label: 'Accuracy', value: latestMetrics ? `${((latestMetrics.accuracy || 0) * 100).toFixed(1)}%` : '—', color: 'text-emerald-400' },
          { label: 'ROI', value: latestMetrics ? `${(latestMetrics.roi || 0).toFixed(1)}%` : '—', color: 'text-emerald-400' },
          { label: 'Strong Bet', value: latestMetrics ? `${((latestMetrics.strong_bet_accuracy || 0) * 100).toFixed(1)}%` : '—', color: 'text-amber-400' }
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className={cn('text-2xl font-bold', color)}>{value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-sm font-semibold mb-4">Accuracy Trend</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={accuracyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="index" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="accuracy" stroke="#60a5fa" />
              <Line type="monotone" dataKey="roi" stroke="#a78bfa" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-sm font-semibold mb-4">League Accuracy</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={leagueChartData}>
              <XAxis dataKey="league" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="accuracy" fill="#60a5fa" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="font-semibold mb-2">Backtest Log</div>
          {log.map((l, i) => (
            <div key={i} className="text-xs text-muted-foreground">{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}
