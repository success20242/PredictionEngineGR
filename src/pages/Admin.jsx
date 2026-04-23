import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Database, Sliders, BarChart2, Trash2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import ScrapingJobMonitor from '@/components/admin/ScrapingJobMonitor';
import ModelPerformanceChart from '@/components/admin/ModelPerformanceChart';
import { DEFAULT_WEIGHTS } from '@/lib/ensembleEngine';
import { SUPPORTED_LEAGUES } from '@/lib/dataIngestion';
import { cn } from '@/lib/utils';

export default function Admin() {
  const qc = useQueryClient();
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [saveMsg, setSaveMsg] = useState(null);
  const [confirmClear, setConfirmClear] = useState(null);

  const { data: allPredictions = [] } = useQuery({
    queryKey: ['admin-predictions'],
    queryFn: () => base44.entities.Prediction.list('-created_date', 500)
  });

  const { data: allMatches = [] } = useQuery({
    queryKey: ['admin-matches'],
    queryFn: () => base44.entities.Match.list('-created_date', 200)
  });

  const { data: allTeams = [] } = useQuery({
    queryKey: ['admin-teams'],
    queryFn: () => base44.entities.Team.list('-created_date', 200)
  });

  const { data: latestMetrics } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: async () => {
      const m = await base44.entities.ModelMetrics.list('-created_date', 1);
      return m[0] || null;
    }
  });

  async function saveWeights() {
    // Apply new weights by creating a model metrics record
    await base44.entities.ModelMetrics.create({
      model_name: 'Manual Weight Override',
      version: `manual-${Date.now()}`,
      ensemble_weights: weights,
      evaluated_at: new Date().toISOString(),
      notes: 'Manually adjusted from Admin panel'
    });
    setSaveMsg('Weights saved!');
    qc.invalidateQueries({ queryKey: ['admin-metrics'] });
    setTimeout(() => setSaveMsg(null), 3000);
  }

  async function clearData(type) {
    if (type === 'predictions') {
      for (const p of allPredictions) {
        await base44.entities.Prediction.delete(p.id);
      }
    } else if (type === 'matches') {
      for (const m of allMatches) {
        await base44.entities.Match.delete(m.id);
      }
    }
    qc.invalidateQueries();
    setConfirmClear(null);
  }

  const resolved = allPredictions.filter(p => p.actual_outcome).length;
  const correct = allPredictions.filter(p => p.was_correct).length;
  const overallAccuracy = resolved > 0 ? (correct / resolved * 100).toFixed(1) : null;

  const leagueBreakdown = SUPPORTED_LEAGUES.map(league => {
    const preds = allPredictions.filter(p => p.league_name === league.name);
    const res = preds.filter(p => p.actual_outcome);
    const cor = preds.filter(p => p.was_correct);
    return {
      name: league.short,
      total: preds.length,
      resolved: res.length,
      accuracy: res.length > 0 ? (cor.length / res.length * 100).toFixed(1) : null
    };
  });

  const currentWeights = latestMetrics?.ensemble_weights || DEFAULT_WEIGHTS;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Admin Panel</h1>
      </div>

      {/* System overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Predictions', value: allPredictions.length, color: 'text-sky-400', icon: BarChart2 },
          { label: 'Matches Stored', value: allMatches.length, color: 'text-violet-400', icon: Database },
          { label: 'Teams Tracked', value: allTeams.length, color: 'text-amber-400', icon: Database },
          { label: 'Overall Accuracy', value: overallAccuracy ? `${overallAccuracy}%` : '—', color: 'text-emerald-400', icon: CheckCircle2 }
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={cn('w-3.5 h-3.5', color)} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <div className={cn('text-2xl font-bold', color)}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model weights control */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sliders className="w-4 h-4 text-accent-blue" />
            <div className="text-sm font-semibold text-foreground">Model Weight Control</div>
          </div>

          <div className="text-xs text-muted-foreground mb-4">
            Current weights (auto-set by backtester). Manual override will be applied to all new predictions.
          </div>

          <div className="space-y-4">
            {[
              { key: 'poisson', label: 'Poisson Model', desc: 'Goal distribution' },
              { key: 'elo', label: 'Elo Rating', desc: 'Team strength' },
              { key: 'form', label: 'Form Model', desc: 'Recent performance' },
              { key: 'xg', label: 'xG Model', desc: 'Expected goals' }
            ].map(({ key, label, desc }) => (
              <div key={key}>
                <div className="flex justify-between items-center mb-1.5">
                  <div>
                    <span className="text-xs font-medium text-foreground">{label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{desc}</span>
                  </div>
                  <span className="text-xs font-bold text-accent-blue">{Math.round(weights[key] * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(weights[key] * 100)}
                  onChange={e => {
                    const val = parseInt(e.target.value) / 100;
                    setWeights(prev => ({ ...prev, [key]: val }));
                  }}
                  className="w-full accent-accent-blue h-1.5 rounded-full"
                />
              </div>
            ))}
          </div>

          <div className="mt-2 text-xs text-muted-foreground">
            Total: {Math.round((weights.poisson + weights.elo + weights.form + weights.xg) * 100)}%
          </div>

          <button
            onClick={saveWeights}
            className="mt-4 w-full py-2 bg-accent-blue/15 hover:bg-accent-blue/25 text-accent-blue border border-accent-blue/30 rounded-lg text-sm font-medium transition-colors"
          >
            Save Weights
          </button>
          {saveMsg && <div className="mt-2 text-xs text-emerald-400 text-center">{saveMsg}</div>}
        </div>

        {/* Performance chart */}
        <ModelPerformanceChart metrics={latestMetrics} />
      </div>

      {/* League breakdown */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="text-sm font-semibold text-foreground mb-4">League Breakdown</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-left pb-2 font-medium">League</th>
                <th className="text-right pb-2 font-medium">Predictions</th>
                <th className="text-right pb-2 font-medium">Resolved</th>
                <th className="text-right pb-2 font-medium">Accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {leagueBreakdown.map(row => (
                <tr key={row.name} className="text-sm">
                  <td className="py-2.5 font-medium text-foreground">{row.name}</td>
                  <td className="py-2.5 text-right text-muted-foreground">{row.total}</td>
                  <td className="py-2.5 text-right text-muted-foreground">{row.resolved}</td>
                  <td className="py-2.5 text-right">
                    {row.accuracy
                      ? <span className={cn('font-semibold', parseFloat(row.accuracy) >= 50 ? 'text-emerald-400' : 'text-rose-400')}>{row.accuracy}%</span>
                      : <span className="text-muted-foreground">—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Jobs monitor */}
      <ScrapingJobMonitor />

      {/* Data management */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          Data Management
        </div>
        <div className="flex gap-3">
          {confirmClear === 'predictions' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-400">Delete all {allPredictions.length} predictions?</span>
              <button onClick={() => clearData('predictions')} className="px-3 py-1.5 bg-rose-500/15 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-medium">Confirm</button>
              <button onClick={() => setConfirmClear(null)} className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs font-medium">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmClear('predictions')} className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 rounded-lg text-xs font-medium transition-colors border border-border">
              <Trash2 className="w-3.5 h-3.5" />
              Clear Predictions
            </button>
          )}
          {confirmClear === 'matches' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-400">Delete all {allMatches.length} matches?</span>
              <button onClick={() => clearData('matches')} className="px-3 py-1.5 bg-rose-500/15 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-medium">Confirm</button>
              <button onClick={() => setConfirmClear(null)} className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs font-medium">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmClear('matches')} className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 rounded-lg text-xs font-medium transition-colors border border-border">
              <Trash2 className="w-3.5 h-3.5" />
              Clear Matches
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
