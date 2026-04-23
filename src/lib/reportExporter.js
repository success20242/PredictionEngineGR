import { format } from 'date-fns';

/**
 * Export predictions data as CSV and trigger download
 */
export function exportPredictionsCSV(predictions, metrics) {
  const rows = [
    ['Home Team', 'Away Team', 'League', 'Match Date', 'Predicted Outcome', 'Home Win %', 'Draw %', 'Away Win %', 'Confidence', 'Value Rating', 'Home Odds', 'Draw Odds', 'Away Odds', 'Actual Outcome', 'Correct']
  ];

  for (const p of predictions) {
    rows.push([
      p.home_team_name || '',
      p.away_team_name || '',
      p.league_name || '',
      p.match_date ? format(new Date(p.match_date), 'yyyy-MM-dd HH:mm') : '',
      p.predicted_outcome || '',
      p.home_win_prob != null ? (p.home_win_prob * 100).toFixed(1) : '',
      p.draw_prob != null ? (p.draw_prob * 100).toFixed(1) : '',
      p.away_win_prob != null ? (p.away_win_prob * 100).toFixed(1) : '',
      p.confidence != null ? (p.confidence * 100).toFixed(1) : '',
      p.value_rating || '',
      p.implied_home_odds?.toFixed(2) || '',
      p.implied_draw_odds?.toFixed(2) || '',
      p.implied_away_odds?.toFixed(2) || '',
      p.actual_outcome || '',
      p.was_correct != null ? (p.was_correct ? 'Yes' : 'No') : ''
    ]);
  }

  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  downloadFile(csv, `footballiq-predictions-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv');
}

/**
 * Export performance metrics as CSV
 */
export function exportMetricsCSV(metrics) {
  if (!metrics || metrics.length === 0) return;

  const rows = [
    ['Model', 'Version', 'Evaluated At', 'Accuracy %', 'ROI %', 'Win Rate %', 'Total Predictions', 'Correct', 'Strong Bet Accuracy %', 'Medium Accuracy %']
  ];

  for (const m of metrics) {
    rows.push([
      m.model_name || '',
      m.version || '',
      m.evaluated_at ? format(new Date(m.evaluated_at), 'yyyy-MM-dd HH:mm') : '',
      m.accuracy != null ? (m.accuracy * 100).toFixed(1) : '',
      m.roi?.toFixed(1) || '',
      m.win_rate != null ? (m.win_rate * 100).toFixed(1) : '',
      m.total_predictions || '',
      m.correct_predictions || '',
      m.strong_bet_accuracy != null ? (m.strong_bet_accuracy * 100).toFixed(1) : '',
      m.medium_accuracy != null ? (m.medium_accuracy * 100).toFixed(1) : ''
    ]);
  }

  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  downloadFile(csv, `footballiq-metrics-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv');
}

/**
 * Generate a simple HTML-based PDF report and print it
 */
export function exportPredictionsPDF(predictions, metrics) {
  const now = format(new Date(), 'MMMM d, yyyy HH:mm');
  const total = predictions.length;
  const strongBets = predictions.filter(p => p.value_rating === 'STRONG_BET').length;
  const resolved = predictions.filter(p => p.actual_outcome).length;
  const correct = predictions.filter(p => p.was_correct).length;
  const accuracy = resolved > 0 ? ((correct / resolved) * 100).toFixed(1) : 'N/A';

  const predRows = predictions.slice(0, 50).map(p => `
    <tr>
      <td>${p.home_team_name} vs ${p.away_team_name}</td>
      <td>${p.league_name || '—'}</td>
      <td>${p.match_date ? format(new Date(p.match_date), 'MMM d, HH:mm') : '—'}</td>
      <td>${p.predicted_outcome?.replace('_', ' ') || '—'}</td>
      <td>${p.confidence != null ? (p.confidence * 100).toFixed(0) + '%' : '—'}</td>
      <td style="color:${p.value_rating === 'STRONG_BET' ? '#10b981' : p.value_rating === 'MEDIUM' ? '#f59e0b' : '#6b7280'}">${p.value_rating?.replace('_', ' ') || '—'}</td>
      <td>${p.actual_outcome ? (p.was_correct ? '✓' : '✗') : '—'}</td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>FootballIQ Analytics Report</title>
  <style>
    body { font-family: -apple-system, sans-serif; color: #111; margin: 40px; font-size: 13px; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .subtitle { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .stat-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
    .stat-label { color: #6b7280; font-size: 11px; margin-bottom: 4px; }
    .stat-value { font-size: 20px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead tr { background: #f9fafb; }
    th { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151; }
    td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; }
    tr:last-child td { border-bottom: none; }
    .footer { margin-top: 24px; color: #9ca3af; font-size: 11px; text-align: center; }
  </style>
</head>
<body>
  <h1>⚽ FootballIQ Analytics Report</h1>
  <div class="subtitle">Generated on ${now}</div>

  <div class="stats">
    <div class="stat-box"><div class="stat-label">Total Predictions</div><div class="stat-value">${total}</div></div>
    <div class="stat-box"><div class="stat-label">Strong Bets</div><div class="stat-value" style="color:#10b981">${strongBets}</div></div>
    <div class="stat-box"><div class="stat-label">Resolved</div><div class="stat-value">${resolved}</div></div>
    <div class="stat-box"><div class="stat-label">Accuracy</div><div class="stat-value" style="color:#3b82f6">${accuracy}${accuracy !== 'N/A' ? '%' : ''}</div></div>
  </div>

  ${metrics ? `
  <h2 style="font-size:15px;font-weight:600;margin-bottom:12px;">Model Performance</h2>
  <div class="stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:24px;">
    <div class="stat-box"><div class="stat-label">Model Accuracy</div><div class="stat-value">${((metrics.accuracy || 0) * 100).toFixed(1)}%</div></div>
    <div class="stat-box"><div class="stat-label">ROI</div><div class="stat-value" style="color:${(metrics.roi || 0) >= 0 ? '#10b981' : '#ef4444'}">${(metrics.roi || 0) > 0 ? '+' : ''}${(metrics.roi || 0).toFixed(1)}%</div></div>
    <div class="stat-box"><div class="stat-label">Strong Bet Accuracy</div><div class="stat-value">${metrics.strong_bet_accuracy ? (metrics.strong_bet_accuracy * 100).toFixed(1) + '%' : '—'}</div></div>
  </div>
  ` : ''}

  <h2 style="font-size:15px;font-weight:600;margin-bottom:12px;">Predictions${predictions.length > 50 ? ' (top 50)' : ''}</h2>
  <table>
    <thead>
      <tr>
        <th>Match</th><th>League</th><th>Date</th><th>Prediction</th><th>Confidence</th><th>Value</th><th>Result</th>
      </tr>
    </thead>
    <tbody>${predRows}</tbody>
  </table>

  <div class="footer">FootballIQ Prediction Engine · Confidential Analytics Report</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.print();
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Build email body text for a report
 */
export function buildEmailBody(predictions, metrics, frequency) {
  const total = predictions.length;
  const strongBets = predictions.filter(p => p.value_rating === 'STRONG_BET');
  const resolved = predictions.filter(p => p.actual_outcome);
  const correct = predictions.filter(p => p.was_correct);
  const accuracy = resolved.length > 0 ? ((correct.length / resolved.length) * 100).toFixed(1) : 'N/A';

  const topPicks = strongBets.slice(0, 5).map(p =>
    `• ${p.home_team_name} vs ${p.away_team_name} (${p.league_name}) — ${p.predicted_outcome?.replace('_', ' ')}, Confidence: ${(p.confidence * 100).toFixed(0)}%`
  ).join('\n');

  return `FootballIQ ${frequency} Analytics Report
Generated: ${format(new Date(), 'MMMM d, yyyy HH:mm')}

SUMMARY
───────
Total Predictions: ${total}
Strong Bets: ${strongBets.length}
Resolved: ${resolved.length}
Accuracy: ${accuracy}${accuracy !== 'N/A' ? '%' : ''}
${metrics ? `Model ROI: ${(metrics.roi || 0) > 0 ? '+' : ''}${(metrics.roi || 0).toFixed(1)}%` : ''}

TOP STRONG BET PICKS
────────────────────
${topPicks || 'No strong bets at this time.'}

View full report in your FootballIQ dashboard.
`;
}
