export interface AIResponse {
  query: string;
  summary: string;
  riskLevel: 'Low' | 'Moderate' | 'High';
  timing: string;
  actionItems: string[];
  timestamp: string;
  sourceDisclaimer: string;
  locationUsed?: string;
  isLive?: boolean;
  needsClarification?: boolean;
  isError?: boolean;
}

/**
 * Service to process WeatherGPT conversational intelligence.
 * Dispatches to server-side Open-Meteo retrieval and grounded Gemini AI reasoning.
 */
export const aiWeatherService = {
  async askWeatherGPT(
    prompt: string,
    locationName = 'Bengaluru',
    latitude?: number,
    longitude?: number
  ): Promise<AIResponse> {
    const trimmed = prompt.trim();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      const res = await fetch('/api/ai/weather-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmed,
          locationName,
          latitude,
          longitude
        })
      });

      const data = await res.json();

      if (res.ok && data.summary) {
        return {
          query: data.query || trimmed,
          summary: data.summary,
          riskLevel: data.riskLevel || 'Moderate',
          timing: data.timing || 'Current Window',
          actionItems: data.actionItems || [],
          timestamp: data.timestamp || timestamp,
          sourceDisclaimer: data.sourceDisclaimer || 'Live Open-Meteo telemetry • Grounded by Gemini AI',
          locationUsed: data.locationUsed,
          isLive: data.isLive ?? true,
          needsClarification: data.needsClarification
        };
      }

      // Handle server-side handled errors (e.g. 502 Open-Meteo failure or 400 validation)
      if (data.summary || data.error) {
        return {
          query: trimmed,
          summary: data.summary || data.error || 'Failed to retrieve real-time weather information.',
          riskLevel: data.riskLevel || 'Moderate',
          timing: data.timing || 'Unavailable',
          actionItems: data.actionItems || ['Please retry in a few moments or verify network connection.'],
          timestamp,
          sourceDisclaimer: data.sourceDisclaimer || 'Service notification',
          locationUsed: data.locationUsed || locationName,
          isLive: false,
          isError: true
        };
      }
    } catch (apiErr: any) {
      console.error('[AI Weather Service Error]:', apiErr);
      return {
        query: trimmed,
        summary: `Unable to connect to WeatherGPT server. Live telemetry could not be retrieved from Open-Meteo.`,
        riskLevel: 'Moderate',
        timing: 'Connection Error',
        actionItems: [
          'Verify server connectivity.',
          'Retry your query once the connection is restored.'
        ],
        timestamp,
        sourceDisclaimer: 'Connection Error',
        locationUsed: locationName,
        isLive: false,
        isError: true
      };
    }

    return {
      query: trimmed,
      summary: `Unable to complete query for ${locationName}. Please try again.`,
      riskLevel: 'Low',
      timing: 'Unavailable',
      actionItems: ['Please retry with a specific city name.'],
      timestamp,
      sourceDisclaimer: 'WeatherGPT Service',
      locationUsed: locationName,
      isLive: false
    };
  }
};

