import { cn } from '@/lib/utils';
import { SUPPORTED_LEAGUES } from '@/lib/dataIngestion';

const ALL_OPTION = { name: 'All Leagues', short: 'All' };

export default function LeagueFilter({ selected, onChange }) {
  const leagues = [ALL_OPTION, ...SUPPORTED_LEAGUES];

  return (
    <div className="flex flex-wrap gap-2">
      {leagues.map(league => (
        <button
          key={league.name}
          onClick={() => onChange(league.name === 'All Leagues' ? null : league.name)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border',
            (selected === null && league.name === 'All Leagues') || selected === league.name
              ? 'bg-accent-blue/15 text-accent-blue border-accent-blue/30'
              : 'bg-muted text-muted-foreground border-border hover:border-accent-blue/20 hover:text-foreground'
          )}
        >
          {league.short || league.name}
        </button>
      ))}
    </div>
  );
}
