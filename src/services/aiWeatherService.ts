import { SUGGESTED_QUESTIONS } from '../data/mockWeatherData';

export interface AIResponse {
  query: string;
  summary: string;
  riskLevel: 'Low' | 'Moderate' | 'High';
  timing: string;
  actionItems: string[];
  timestamp: string;
  sourceDisclaimer: string;
}

/**
 * Service to process WeatherGPT conversational intelligence.
 * Designed with standard request/response interfaces so Gemini SDK can be hooked up directly.
 */
export const aiWeatherService = {
  async askWeatherGPT(prompt: string, locationName = 'Bengaluru'): Promise<AIResponse> {
    // Artificial latency to simulate conversational AI processing
    await new Promise(resolve => setTimeout(resolve, 600));

    const clean = prompt.trim().toLowerCase();
    const matched = SUGGESTED_QUESTIONS.find(
      q => q.text.toLowerCase().includes(clean) || clean.includes(q.text.toLowerCase().slice(0, 15))
    );

    if (matched) {
      return {
        query: prompt,
        summary: matched.mockAnswer.summary,
        riskLevel: matched.mockAnswer.riskLevel,
        timing: matched.mockAnswer.timing,
        actionItems: matched.mockAnswer.actionItems,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sourceDisclaimer: 'Simulated WeatherGPT demonstration response • External API integration pending'
      };
    }

    // Default intelligent meteorological response
    return {
      query: prompt,
      summary: `For ${locationName}, localized atmospheric humidity is currently high (72%) with convective cloud formation detected in eastern and southern sectors. Commuters should prepare for intermittent rain activity.`,
      riskLevel: 'Moderate',
      timing: 'Primary convective window: 3:30 PM – 7:30 PM IST',
      actionItems: [
        'Check route waterlogging updates before initiating long road commutes.',
        'Keep rain protection handy if traveling on two-wheelers or foot.',
        'Monitor hourly forecast updates for rapid localized shifts.'
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sourceDisclaimer: 'Simulated WeatherGPT demonstration response • External API integration pending'
    };
  }
};
