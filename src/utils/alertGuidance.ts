/**
 * Deterministic point-wise safety guidance for weather alert types.
 * Strictly rule-based — never uses an LLM or Gemini.
 */

export const SAFETY_DISCLAIMER =
  'WeatherGPT provides weather-based guidance. Follow official local authority and emergency-service instructions during severe conditions.';

/**
 * Returns concise, point-wise instructions for a given alert type.
 */
export function getAlertGuidance(alertType: string): string[] {
  const normalized = (alertType || '').toLowerCase().trim();

  switch (normalized) {
    case 'heavy_rain':
      return [
        'Avoid low-lying and flood-prone roads.',
        'Do not enter waterlogged underpasses.',
        'Allow extra travel time.',
        'Keep checking local weather updates.'
      ];

    case 'flood':
    case 'flash_flood':
      return [
        'Move away from low-lying areas if conditions worsen.',
        'Avoid walking or driving through floodwater.',
        'Follow official local evacuation instructions.',
        'Keep emergency contacts accessible.'
      ];

    case 'thunderstorm':
    case 'lightning':
      return [
        'Move indoors where possible.',
        'Avoid exposed open areas and tall isolated objects.',
        'Stay away from windows during strong storms.',
        'Delay unnecessary outdoor travel.'
      ];

    case 'strong_wind':
    case 'gale':
    case 'cyclone':
      return [
        'Stay away from trees, temporary structures, and loose objects.',
        'Secure lightweight outdoor items if safe to do so.',
        'Avoid unnecessary travel during very strong winds.',
        'Watch for falling debris.'
      ];

    case 'extreme_heat':
    case 'heatwave':
      return [
        'Reduce strenuous outdoor activity.',
        'Stay hydrated.',
        'Spend time in shaded or cooler indoor areas.',
        'Check on vulnerable family members.'
      ];

    case 'extreme_cold':
    case 'coldwave':
      return [
        'Limit prolonged outdoor exposure.',
        'Wear appropriate warm layers.',
        'Keep vulnerable people indoors where possible.',
        'Follow local weather advisories.'
      ];

    case 'air_quality':
    case 'poor_air_quality':
      return [
        'Reduce prolonged outdoor exertion.',
        'Keep windows closed if outdoor air quality is poor.',
        'Follow official local air-quality guidance.',
        'People sensitive to pollution should take extra precautions.'
      ];

    default:
      return [
        'Monitor official weather updates.',
        'Avoid unnecessary exposure to hazardous conditions.',
        'Follow instructions from local authorities.'
      ];
  }
}
