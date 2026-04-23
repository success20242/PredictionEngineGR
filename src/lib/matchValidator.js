/**
 * MATCH STATE VALIDATOR
 * Validates match status based on UTC time — never trusts scraped status blindly.
 */

export function validateMatchStatus(match) {
  const now = new Date();
  const matchTime = new Date(match.match_date);
  const diffMinutes = (now - matchTime) / (1000 * 60);

  let validatedStatus = match.status;

  if (diffMinutes < -5) {
    validatedStatus = 'UPCOMING';
  } else if (diffMinutes >= -5 && diffMinutes <= 120) {
    // Could be LIVE — but if no score updates and marked LIVE, flag it
    if (match.status === 'LIVE' && match.minute === null) {
      validatedStatus = 'LIVE'; // trust with caution
    } else if (diffMinutes < 0) {
      validatedStatus = 'UPCOMING';
    } else {
      validatedStatus = match.status === 'FINISHED' ? 'FINISHED' : 'LIVE';
    }
  } else if (diffMinutes > 120) {
    // Force FINISHED regardless of scraped status
    validatedStatus = 'FINISHED';
  }

  return {
    ...match,
    status: validatedStatus,
    status_override: validatedStatus !== match.status,
    time_diff_minutes: Math.round(diffMinutes)
  };
}

export function isMatchLive(match) {
  const validated = validateMatchStatus(match);
  return validated.status === 'LIVE';
}

export function isMatchFinished(match) {
  const validated = validateMatchStatus(match);
  return validated.status === 'FINISHED';
}

export function isMatchUpcoming(match) {
  const validated = validateMatchStatus(match);
  return validated.status === 'UPCOMING';
}

export function getMatchMinute(match) {
  const matchTime = new Date(match.match_date);
  const now = new Date();
  const diffMinutes = (now - matchTime) / (1000 * 60);
  if (diffMinutes < 0) return null;
  if (diffMinutes <= 45) return Math.floor(diffMinutes);
  if (diffMinutes <= 60) return 45; // half time estimate
  if (diffMinutes <= 105) return Math.floor(diffMinutes - 15);
  return 90;
}
