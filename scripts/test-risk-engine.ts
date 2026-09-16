import assert from 'node:assert/strict';
import { calculateRiskFromInputs, RiskInputs } from '../src/utils/riskEngine';

const base: RiskInputs = {
  rainMm24h: 4,
  maxTemperatureC: 31,
  apparentTemperatureC: 33,
  humidityPercent: 65,
  windGustKmh: 20,
  aqi: 45,
  aqiScale: 'us',
  dfsiNormalized: 0.5,
  dfsiRaw: 12,
  rainMlProbability: null,
  rainMlWillRain: null,
  useBengaluruMl: false,
  sourceLabel: 'Test source',
  updatedAt: '2026-09-16T12:00:00.000Z'
};
const baseBeforeCalculation = JSON.stringify(base);

const bengaluru = calculateRiskFromInputs({
  ...base,
  rainMlProbability: 0.72,
  rainMlWillRain: true,
  useBengaluruMl: true
});
assert.equal(bengaluru.assessments.rain.displayValue, '72%');
assert.equal(bengaluru.assessments.rain.method, 'ml-model');
assert.equal(bengaluru.assessments.rain.level, 'High');

const heavyRain = calculateRiskFromInputs({ ...base, rainMm24h: 80 });
assert.equal(heavyRain.assessments.rain.level, 'High');
assert.match(heavyRain.assessments.rain.reason, /heavy rainfall/i);

const hot = calculateRiskFromInputs({ ...base, maxTemperatureC: 45, apparentTemperatureC: 46 });
assert.equal(hot.assessments.heat.level, 'High');
assert.match(hot.assessments.heat.limitation, /not an IMD heatwave declaration/i);

const windy = calculateRiskFromInputs({ ...base, windGustKmh: 90 });
assert.equal(windy.assessments.wind.level, 'Severe');

const noDistrict = calculateRiskFromInputs({ ...base, dfsiNormalized: null, dfsiRaw: null });
assert.equal(noDistrict.assessments.flood.level, 'Unavailable');
assert.match(noDistrict.assessments.flood.limitation, /does not invent/i);

const flood = calculateRiskFromInputs({ ...base, rainMm24h: 115.5, dfsiNormalized: 1, dfsiRaw: 19.3 });
assert.equal(flood.assessments.flood.level, 'Severe');
assert.match(flood.assessments.flood.limitation, /not a hydrological flood probability/i);
assert.equal(flood.assessments.flood.contributions?.length, 2);
assert.equal(flood.assessments.flood.contributions?.[0].label, 'Rainfall load');
assert.equal(flood.assessments.flood.contributions?.[1].label, 'District susceptibility');

const poorAir = calculateRiskFromInputs({ ...base, aqi: 175 });
assert.equal(poorAir.assessments.aqi.level, 'High');
assert.match(poorAir.assessments.aqi.limitation, /not CPCB/i);

for (const assessment of Object.values(poorAir.assessments)) {
  assert.ok(assessment.gaugeValue >= 0 && assessment.gaugeValue <= 100);
}
assert.equal(JSON.stringify(base), baseBeforeCalculation, 'risk calculation must not mutate its inputs');

console.log('Risk engine tests passed (7 scenarios + gauge, contribution and purity assertions).');
