import { useState } from 'react';
import { base44 } from '@/api/base44Client';
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
    queryFn: () => base44.entities.Prediction.list('-created_date', 500)
  });

  const { data: allMetrics = [] } = useQuery({
    queryKey: ['all-metrics'],
    queryFn: () => base44.entities.ModelMetrics.list('-created_date', 20)
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

      // Evaluate individual model accuracies
      const modelAccuracies = evaluateModelAccuracies(resolvedPredictions);
      addLog(`✓ Model accuracies computed`);

      // Rebalance weights based on performance
      const newWeights = rebalanceWeights(modelAccuracies);
      addLog(`✓ Rebalanced weights: Poisson ${(newWeights.poisson * 100).toFixed(0)}%, Elo ${(newWeights.elo * 100).toFixed(0)}%, Form ${(newWeights.form * 100).toFixed(0)}%, xG ${(newWeights.xg * 100).toFixed(0)}%`);

      // Save metrics
      const metricsRecord = await base44.entities.ModelMetrics.create({
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

  // Auto-evaluate predictions where we have match results
  async function evaluatePredictions() {
    setIsRunning(true);
    setLog([]);
    const addLog = msg => setLog(prev => [...prev, msg]);

    try {
      const { data: matches } = await base44.entities.Match.list('-match_date', 200);
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
          await base44.entities.Prediction.update(pred.id, {
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

  // Chart data
  const accuracyChartData = allMetrics.slice().reverse().map((m, i) => ({
    index: i + 1,
    accuracy: parseFloat(((m.accuracy || 0) * 100).toFixed(1)),
    roi: parseFloat((m.roi || 0).toFixed(1))
  }));

  const leagueChartData = lastReport?.league_accuracy
    ? Object.entries(lastReport.league_accuracy).map(([league, data]) => ({
        league: league.split(' ')[0],
        accuracy: parseFloat(((data.accuracy || 0) * 100).toFixed(1)),
        total: data.total
      }))
    : allMetrics[0]?.league_accuracy
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
          <p className="text-sm text-muted-foreground mt-0.5">Self-learning evaluation · Auto-rebalances model weights</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={evaluatePredictions}
            disabled={isRunning}
            className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isRunning && 'animate-spin')} />
            Evaluate Results
          </button>
          <button
            onClick={runBacktest}
            disabled={isRunning || resolvedPredictions.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-violet-500/15 hover:bg-violet-500/25 text-violet-400 border border-violet-500/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            Run Backtest
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Resolved', value: resolvedPredictions.length, sub: 'predictions with outcomes', color: 'text-sky-400' },
          { label: 'Accuracy', value: latestMetrics ? `${((latestMetrics.accuracy || 0) * 100).toFixed(1)}%` : '—', sub: 'overall correctness', color: 'text-emerald-400' },
          { label: 'ROI', value: latestMetrics ? `${(latestMetrics.roi || 0) > 0 ? '+' : ''}${(latestMetrics.roi || 0).toFixed(1)}%` : '—', sub: 'return on investment', color: (latestMetrics?.roi || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400' },
          { label: 'Strong Bet', value: latestMetrics?.strong_bet_accuracy ? `${((latestMetrics.strong_bet_accuracy) * 100).toFixed(1)}%` : '—', sub: 'high confidence accuracy', color: 'text-amber-400' }
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div className={cn('text-2xl font-bold', color)}>{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accuracy over time */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-sm font-semibold text-foreground mb-4">Accuracy Trend</div>
          {accuracyChartData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={accuracyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="index" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                    formatter={(val, name) => [name === 'roi' ? `${val}%` : `${val}%`, name === 'roi' ? 'ROI' : 'Accuracy']}
                  />
                  <Line type="monotone" dataKey="accuracy" stroke="#60a5fa" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="roi" stroke="#a78bfa" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Run a backtest to see trends</div>
          )}
        </div>

        {/* League accuracy */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-sm font-semibold text-foreground mb-4">Accuracy by League</div>
          {leagueChartData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leagueChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="league" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                    {leagueChartData.map((entry, i) => (
                      <Cell key={i} fill={`hsl(${200 + i * 30}, 65%, 60%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No league data yet</div>
          )}
        </div>
      </div>

      {/* Log output */}
      {log.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            {isRunning && <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent-blue" />}
            Backtest Log
          </div>
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto font-mono">
            {log.map((msg, i) => (
              <div key={i} className={cn(
                'text-xs',
                msg.includes('❌') ? 'text-rose-400' :
                msg.includes('✅') || msg.includes('✓') ? 'text-emerald-400' :
                'text-muted-foreground'
              )}>{msg}</div>
            ))}
          </div>
        </div>
      )}

      {/* Last report */}
      {lastReport && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-amber-400" />
            <div className="text-sm font-semibold text-foreground">Latest Report — Grade: {lastReport.grade}</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              { label: 'Total', value: lastReport.total_predictions },
              { label: 'Correct', value: lastReport.correct_predictions },
              { label: 'Max Drawdown', value: `${lastReport.max_drawdown?.toFixed(1)} units` },
              { label: 'Net Profit', value: `${lastReport.net_profit_units > 0 ? '+' : ''}${lastReport.net_profit_units?.toFixed(1)} units` }
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">{label}</div>
                <div className="font-semibold text-foreground">{value}</div>
              </div>
            ))}
          </div>
          {lastReport.new_weights && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Rebalanced Weights</div>
              <div className="flex gap-3 flex-wrap">
                {Object.entries(lastReport.new_weights).map(([model, weight]) => (
                  <div key={model} className="bg-accent-blue/10 border border-accent-blue/20 rounded-lg px-3 py-1.5 text-xs">
                    <span className="text-muted-foreground capitalize">{model}: </span>
                    <span className="font-bold text-accent-blue">{(weight * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Historical runs */}
      {allMetrics.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-sm font-semibold text-foreground mb-4">Historical Evaluations</div>
          <div className="space-y-2">
            {allMetrics.map(m => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 text-sm">
                <div>
                  <span className="font-medium text-foreground">{m.model_name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {m.evaluated_at ? formatDistanceToNow(parseISO(m.evaluated_at), { addSuffix: true }) : ''}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-emerald-400">{((m.accuracy || 0) * 100).toFixed(1)}% acc</span>
                  <span className={cn(m.roi >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{m.roi > 0 ? '+' : ''}{(m.roi || 0).toFixed(1)}% ROI</span>
                  <span className="text-muted-foreground">{m.total_predictions} preds</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
