import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Mail, Clock, Trash2, Plus, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { exportPredictionsCSV, exportMetricsCSV, exportPredictionsPDF, buildEmailBody } from '@/lib/reportExporter';
import { SUPPORTED_LEAGUES } from '@/lib/dataIngestion';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

const FREQ_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
const TYPE_LABELS = { predictions: 'Predictions', performance: 'Performance Metrics', full: 'Full Report' };

export default function Reports() {
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);
  const [sendStatus, setSendStatus] = useState({});
  const qc = useQueryClient();

  const { data: predictions = [] } = useQuery({
    queryKey: ['reports-predictions'],
    queryFn: () => base44.entities.Prediction.list('-created_date', 500)
  });

  const { data: metrics = [] } = useQuery({
    queryKey: ['reports-metrics'],
    queryFn: () => base44.entities.ModelMetrics.list('-created_date', 10)
  });

  const { data: schedules = [], refetch: refetchSchedules } = useQuery({
    queryKey: ['report-schedules'],
    queryFn: () => base44.entities.ReportSchedule.list('-created_date', 50)
  });

  const latestMetrics = metrics[0] || null;

  async function handleExport(type, format) {
    setExportStatus('exporting');
    try {
      if (format === 'csv') {
        if (type === 'predictions') exportPredictionsCSV(predictions, latestMetrics);
        else if (type === 'performance') exportMetricsCSV(metrics);
        else {
          exportPredictionsCSV(predictions, latestMetrics);
          exportMetricsCSV(metrics);
        }
      } else {
        exportPredictionsPDF(predictions, latestMetrics);
      }
      setExportStatus('done');
      setTimeout(() => setExportStatus(null), 2500);
    } catch (e) {
      setExportStatus('error');
      setTimeout(() => setExportStatus(null), 3000);
    }
  }

  async function sendNow(schedule) {
    setSendStatus(prev => ({ ...prev, [schedule.id]: 'sending' }));
    try {
      const body = buildEmailBody(predictions, latestMetrics, schedule.frequency);
      await base44.integrations.Core.SendEmail({
        to: schedule.email,
        subject: `FootballIQ ${FREQ_LABELS[schedule.frequency]} ${TYPE_LABELS[schedule.report_type]} Report`,
        body
      });
      await base44.entities.ReportSchedule.update(schedule.id, {
        last_sent: new Date().toISOString()
      });
      setSendStatus(prev => ({ ...prev, [schedule.id]: 'sent' }));
      refetchSchedules();
      setTimeout(() => setSendStatus(prev => ({ ...prev, [schedule.id]: null })), 3000);
    } catch (e) {
      setSendStatus(prev => ({ ...prev, [schedule.id]: 'error' }));
      setTimeout(() => setSendStatus(prev => ({ ...prev, [schedule.id]: null })), 3000);
    }
  }

  async function deleteSchedule(id) {
    await base44.entities.ReportSchedule.delete(id);
    refetchSchedules();
  }

  async function toggleActive(schedule) {
    await base44.entities.ReportSchedule.update(schedule.id, { is_active: !schedule.is_active });
    refetchSchedules();
  }

  const strongBets = predictions.filter(p => p.value_rating === 'STRONG_BET').length;
  const resolved = predictions.filter(p => p.actual_outcome).length;
  const correct = predictions.filter(p => p.was_correct).length;
  const accuracy = resolved > 0 ? ((correct / resolved) * 100).toFixed(1) : null;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            Reports & Export
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Export analytics data · Schedule automated email reports</p>
        </div>
      </div>

      {/* Summary snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Predictions', value: predictions.length, color: 'text-sky-400' },
          { label: 'Strong Bets', value: strongBets, color: 'text-emerald-400' },
          { label: 'Accuracy', value: accuracy ? `${accuracy}%` : '—', color: 'text-violet-400' },
          { label: 'Schedules', value: schedules.filter(s => s.is_active).length, color: 'text-amber-400' }
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div className={cn('text-2xl font-bold', color)}>{value}</div>
          </div>
        ))}
      </div>

      {/* Export section */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-accent-blue" />
          <span className="text-sm font-semibold text-foreground">Export Data</span>
          {exportStatus === 'done' && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 ml-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> Exported!
            </span>
          )}
          {exportStatus === 'error' && (
            <span className="flex items-center gap-1 text-xs text-rose-400 ml-2">
              <AlertCircle className="w-3.5 h-3.5" /> Export failed
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              title: 'Predictions CSV',
              desc: `${predictions.length} predictions with probabilities, odds & outcomes`,
              icon: FileSpreadsheet,
              color: 'text-emerald-400',
              bg: 'bg-emerald-500/10 border-emerald-500/30',
              onClick: () => handleExport('predictions', 'csv')
            },
            {
              title: 'Performance CSV',
              desc: `${metrics.length} model evaluation records with accuracy & ROI`,
              icon: FileSpreadsheet,
              color: 'text-sky-400',
              bg: 'bg-sky-500/10 border-sky-500/30',
              onClick: () => handleExport('performance', 'csv')
            },
            {
              title: 'Full PDF Report',
              desc: 'Complete report with stats, top picks & model performance',
              icon: FileText,
              color: 'text-violet-400',
              bg: 'bg-violet-500/10 border-violet-500/30',
              onClick: () => handleExport('full', 'pdf')
            }
          ].map(({ title, desc, icon: Icon, color, bg, onClick }) => (
            <button
              key={title}
              onClick={onClick}
              disabled={exportStatus === 'exporting'}
              className={cn(
                'flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all hover:opacity-90 disabled:opacity-50',
                bg
              )}
            >
              <Icon className={cn('w-5 h-5', color)} />
              <div>
                <div className={cn('text-sm font-semibold', color)}>{title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
              </div>
              <div className={cn('text-xs font-medium flex items-center gap-1 mt-1', color)}>
                <Download className="w-3 h-3" />
                {exportStatus === 'exporting' ? 'Exporting...' : 'Download'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Scheduled reports */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-foreground">Scheduled Email Reports</span>
          </div>
          <button
            onClick={() => setShowScheduleForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue/15 hover:bg-accent-blue/25 text-accent-blue border border-accent-blue/30 rounded-lg text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Schedule
          </button>
        </div>

        {schedules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No scheduled reports yet. Create one to receive automated email reports.
          </div>
        ) : (
          <div className="space-y-2">
            {schedules.map(schedule => (
              <ScheduleRow
                key={schedule.id}
                schedule={schedule}
                sendStatus={sendStatus[schedule.id]}
                onSendNow={() => sendNow(schedule)}
                onToggle={() => toggleActive(schedule)}
                onDelete={() => deleteSchedule(schedule.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Schedule form modal */}
      {showScheduleForm && (
        <ScheduleFormModal
          onClose={() => setShowScheduleForm(false)}
          onSaved={() => { refetchSchedules(); setShowScheduleForm(false); }}
        />
      )}
    </div>
  );
}

function ScheduleRow({ schedule, sendStatus, onSendNow, onToggle, onDelete }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', schedule.is_active ? 'bg-emerald-400' : 'bg-muted-foreground')} />
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{schedule.email}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {FREQ_LABELS[schedule.frequency]} · {TYPE_LABELS[schedule.report_type]}
            {schedule.last_sent && ` · Last sent ${format(parseISO(schedule.last_sent), 'MMM d, HH:mm')}`}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onSendNow}
          disabled={sendStatus === 'sending'}
          className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-md text-xs font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50"
        >
          {sendStatus === 'sending' ? 'Sending...' : sendStatus === 'sent' ? '✓ Sent' : sendStatus === 'error' ? '✗ Failed' : (
            <><Mail className="w-3 h-3" /> Send Now</>
          )}
        </button>
        <button
          onClick={onToggle}
          className={cn('px-2.5 py-1 rounded-md text-xs font-medium border transition-colors', schedule.is_active ? 'bg-muted text-muted-foreground border-border hover:text-foreground' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20')}
        >
          {schedule.is_active ? 'Pause' : 'Resume'}
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-md text-muted-foreground hover:text-rose-400 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function ScheduleFormModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    email: '',
    frequency: 'weekly',
    report_type: 'predictions',
    league_filter: '',
    is_active: true
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.email) { setError('Email is required'); return; }
    setSaving(true);
    setError(null);

    // Calculate next send
    const next = new Date();
    if (form.frequency === 'daily') next.setDate(next.getDate() + 1);
    else if (form.frequency === 'weekly') next.setDate(next.getDate() + 7);
    else next.setMonth(next.getMonth() + 1);

    await base44.entities.ReportSchedule.create({
      ...form,
      next_send: next.toISOString()
    });
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          New Report Schedule
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="you@example.com"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent-blue"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Frequency</label>
              <select
                value={form.frequency}
                onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent-blue"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Report Type</label>
              <select
                value={form.report_type}
                onChange={e => setForm(f => ({ ...f, report_type: e.target.value }))}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent-blue"
              >
                <option value="predictions">Predictions</option>
                <option value="performance">Performance</option>
                <option value="full">Full Report</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">League Filter (optional)</label>
            <select
              value={form.league_filter}
              onChange={e => setForm(f => ({ ...f, league_filter: e.target.value }))}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent-blue"
            >
              <option value="">All Leagues</option>
              {SUPPORTED_LEAGUES.map(l => (
                <option key={l.name} value={l.name}>{l.name}</option>
              ))}
            </select>
          </div>

          {error && <div className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</div>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-accent-blue/15 text-accent-blue border border-accent-blue/30 rounded-lg text-sm font-medium hover:bg-accent-blue/25 transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
