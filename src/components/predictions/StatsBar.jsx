import { TrendingUp, Target, Zap, Shield } from 'lucide-react';

export default function StatsBar({ predictions, metrics }) {
  const total = predictions?.length || 0;
  const strong = predictions?.filter(p => p.value_rating === 'STRONG_BET').length || 0;
  const medium = predictions?.filter(p => p.value_rating === 'MEDIUM').length || 0;
  const accuracy = metrics?.accuracy ? `${(metrics.accuracy * 100).toFixed(1)}%` : '—';
  const roi = metrics?.roi != null ? `${metrics.roi > 0 ? '+' : ''}${metrics.roi.toFixed(1)}%` : '—';

  const stats = [
    { icon: Target, label: 'Total Predictions', value: total, color: 'text-sky-400' },
    { icon: Zap, label: 'Strong Bets', value: strong, color: 'text-emerald-400' },
    { icon: TrendingUp, label: 'Accuracy', value: accuracy, color: 'text-violet-400' },
    { icon: Shield, label: 'ROI', value: roi, color: metrics?.roi > 0 ? 'text-emerald-400' : 'text-rose-400' }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon className={`w-4 h-4 ${color}`} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
        </div>
      ))}
    </div>
  );
}
