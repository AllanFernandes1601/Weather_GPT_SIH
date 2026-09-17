const ALERT_TYPE_LABELS: Record<string, string> = {
  heavy_rain: 'Heavy Rain',
  flood: 'Flood',
  thunderstorm: 'Thunderstorm',
  strong_wind: 'Strong Wind',
  extreme_heat: 'Extreme Heat',
  extreme_cold: 'Extreme Cold',
  air_quality: 'Air Quality'
};

const SEVERITY_LABELS: Record<string, string> = {
  low: 'LOW',
  moderate: 'MODERATE',
  high: 'HIGH',
  severe: 'SEVERE'
};

export function formatAlertType(alertType: string): string {
  if (ALERT_TYPE_LABELS[alertType]) {
    return ALERT_TYPE_LABELS[alertType];
  }

  return alertType
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatSeverity(severity: string): string {
  return SEVERITY_LABELS[severity] || severity.toUpperCase();
}
