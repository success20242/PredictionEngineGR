import { cn } from '@/lib/utils';

const OPTIONS = [
  { label: 'All', value: null },
  { label: 'Strong Bet', value: 'STRONG_BET' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'Avoid', value: 'AVOID' }
];

export default function ConfidenceFilter({ selected, onChange }) {
  return (
    <div className="flex gap-2">
      {OPTIONS.map(opt => (
        <button
          key={opt.label}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border',
            selected === opt.value
              ? 'bg-accent-blue/15 text-accent-blue border-accent-blue/30'
              : 'bg-muted text-muted-foreground border-border hover:border-accent-blue/20 hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
