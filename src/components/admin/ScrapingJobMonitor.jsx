import { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Loader2, Clock, RefreshCw } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  COMPLETED: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  FAILED: { icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  RUNNING: { icon: Loader2, color: 'text-sky-400 animate-spin', bg: 'bg-sky-500/10' },
  PENDING: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' }
};

export default function ScrapingJobMonitor() {
  const { data: jobs = [], refetch, isLoading } = useQuery({
    queryKey: ['data-jobs'],
    queryFn: async () => {
      const res = await apiClient.get('/jobs?sort=-created_at&limit=20');
      return res.data || res; // depending on your backend response format
    },
    refetchInterval: 10000
  });

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-foreground">Data Jobs</div>
        <button onClick={refetch} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
          <RefreshCw className={cn('w-3.5 h-3.5 text-muted-foreground', isLoading && 'animate-spin')} />
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-6">No jobs recorded yet</div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {jobs.map(job => {
            const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.PENDING;
            const Icon = config.icon;
            return (
              <div key={job.id} className={cn('flex items-start gap-3 p-3 rounded-lg', config.bg)}>
                <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', config.color)} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground">
                    {job.job_type?.replace(/_/g, ' ')} — {job.league_name || 'All'}
                  </div>
                  {job.error_message && (
                    <div className="text-xs text-rose-400 mt-0.5 truncate">{job.error_message}</div>
                  )}
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {job.records_processed != null && `${job.records_processed} records · `}
                    {job.created_at && formatDistanceToNow(parseISO(job.created_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
