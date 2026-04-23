import { DEFAULT_WEIGHTS } from '@/lib/ensembleEngine';

export default function ModelWeightsPanel({ weights = DEFAULT_WEIGHTS, accuracies = {} }) {
  const models = [
    { key: 'poisson', label: 'Poisson', desc: 'Goal distribution model' },
    { key: 'elo', label: 'Elo Rating', desc: 'Team strength evolution' },
    { key: 'form', label: 'Form + xG', desc: 'Recent performance' },
    { key: 'xg', label: 'Expected Goals', desc: 'xG approximation' }
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-sm font-semibold text-foreground mb-4">Model Weights</div>
      <div className="space-y-3">
        {models.map(({ key, label, desc }) => {
          const weight = weights[key] || 0;
          const accuracy = accuracies[key];
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-xs font-medium text-foreground">{label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{desc}</span>
                </div>
                <div className="flex items-center gap-2">
                  {accuracy && (
                    <span className="text-xs text-muted-foreground">{(accuracy * 100).toFixed(0)}% acc</span>
                  )}
                  <span className="text-xs font-bold text-accent-blue">{(weight * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-blue rounded-full transition-all duration-500"
                  style={{ width: `${weight * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
