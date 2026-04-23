import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

export default function ModelPerformanceChart({ metrics }) {
  if (!metrics) return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="text-sm font-semibold text-foreground mb-4">Model Performance</div>
      <div className="text-xs text-muted-foreground text-center py-8">No metrics available yet. Run predictions to generate data.</div>
    </div>
  );

  const radarData = [
    { subject: 'Accuracy', value: (metrics.accuracy || 0) * 100 },
    { subject: 'Win Rate', value: (metrics.win_rate || 0) * 100 },
    { subject: 'Strong Bet', value: (metrics.strong_bet_accuracy || 0) * 100 },
    { subject: 'Coverage', value: Math.min(100, (metrics.total_predictions || 0) / 2) },
    { subject: 'ROI Score', value: Math.max(0, 50 + (metrics.roi || 0)) }
  ];

  const leagueData = metrics.league_accuracy
    ? Object.entries(metrics.league_accuracy).map(([league, data]) => ({
        league: league.split(' ')[0],
        accuracy: parseFloat(((data.accuracy || 0) * 100).toFixed(1)),
        total: data.total
      }))
    : [];

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-5">
      <div className="text-sm font-semibold text-foreground">Model Performance</div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
            <Radar
              dataKey="value"
              stroke="hsl(var(--accent-blue))"
              fill="hsl(var(--accent-blue))"
              fillOpacity={0.15}
              strokeWidth={1.5}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {leagueData.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Accuracy by League</div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leagueData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="league" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                  formatter={(val) => [`${val}%`, 'Accuracy']}
                />
                <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                  {leagueData.map((_, i) => (
                    <Cell key={i} fill={`hsl(${200 + i * 25}, 70%, 60%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
