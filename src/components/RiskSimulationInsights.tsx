import { RiskAssessmentSet, RiskKind, RiskLevel } from '../utils/riskEngine';

interface RiskSimulationInsightsProps {
  baseline: RiskAssessmentSet;
  simulation: RiskAssessmentSet;
}

const order: RiskKind[] = ['rain', 'heat', 'wind', 'flood', 'aqi'];
const labels: Record<RiskKind, string> = { rain: 'Rain', heat: 'Heat', wind: 'Wind', flood: 'Flood', aqi: 'AQI' };
const icons: Record<RiskKind, string> = { rain: 'rainy', heat: 'device_thermostat', wind: 'air', flood: 'flood', aqi: 'airwave' };
const levelRank: Record<RiskLevel, number> = { Unavailable: -1, Low: 0, Moderate: 1, High: 2, Severe: 3 };
const levelColor: Record<RiskLevel, string> = {
  Low: '#10B981', Moderate: '#F59E0B', High: '#F97316', Severe: '#DC2626', Unavailable: '#94A3B8'
};

function polygonPoints(values: number[]) {
  const cx = 150;
  const cy = 135;
  const radius = 104;
  return values.map((value, index) => {
    const angle = -Math.PI / 2 + index * ((Math.PI * 2) / values.length);
    const scaled = radius * Math.max(0, Math.min(100, value)) / 100;
    return `${cx + Math.cos(angle) * scaled},${cy + Math.sin(angle) * scaled}`;
  }).join(' ');
}

function axisPoint(index: number, radius: number) {
  const angle = -Math.PI / 2 + index * ((Math.PI * 2) / order.length);
  return { x: 150 + Math.cos(angle) * radius, y: 135 + Math.sin(angle) * radius };
}

export function RiskSimulationInsights({ baseline, simulation }: RiskSimulationInsightsProps) {
  const baselineValues = order.map(kind => baseline.assessments[kind].gaugeValue);
  const simulatedValues = order.map(kind => simulation.assessments[kind].gaugeValue);
  const changed = order.map(kind => {
    const before = baseline.assessments[kind];
    const after = simulation.assessments[kind];
    return { kind, before, after, delta: after.gaugeValue - before.gaugeValue };
  });
  const escalated = changed.filter(item => levelRank[item.after.level] > levelRank[item.before.level]);
  const largest = changed.reduce((biggest, item) => Math.abs(item.delta) > Math.abs(biggest.delta) ? item : biggest);

  return (
    <section className="space-y-5 rounded-3xl border border-[#E5DCCF]/80 bg-[#FFFDF9] p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B45309]">Scenario impact analysis</p>
          <h3 className="mt-1 text-[22px] font-bold text-[#1C1814]">Live baseline vs simulated conditions</h3>
          <p className="mt-1 text-[12px] text-[#6E645A]">The same risk engine calculates both shapes—only the inputs change.</p>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-semibold text-[#6E645A]"><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-slate-400" />Live baseline</span><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-orange-500" />Simulation</span></div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className="rounded-3xl border border-[#E5DCCF]/70 bg-[#F8F4EE] p-4">
          <svg viewBox="0 0 300 285" className="mx-auto w-full max-w-[330px]" role="img" aria-label="Radar comparison of live and simulated risk scores">
            {[25, 50, 75, 100].map(ring => <polygon key={ring} points={order.map((_, index) => { const point = axisPoint(index, 104 * ring / 100); return `${point.x},${point.y}`; }).join(' ')} fill="none" stroke="#CFC3B3" strokeOpacity="0.65" strokeWidth="1" />)}
            {order.map((kind, index) => { const end = axisPoint(index, 104); const label = axisPoint(index, 126); return <g key={kind}><line x1="150" y1="135" x2={end.x} y2={end.y} stroke="#CFC3B3" strokeOpacity="0.6" /><text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="700" fill="currentColor" className="text-[#6E645A]">{labels[kind]}</text></g>; })}
            <polygon points={polygonPoints(baselineValues)} fill="#64748B" fillOpacity="0.13" stroke="#64748B" strokeWidth="3" strokeDasharray="6 5" />
            <polygon points={polygonPoints(simulatedValues)} fill="#F97316" fillOpacity="0.2" stroke="#EA580C" strokeWidth="4" />
            {simulatedValues.map((value, index) => { const point = axisPoint(index, 104 * value / 100); return <circle key={order[index]} cx={point.x} cy={point.y} r="5" fill="#FFFDF9" stroke="#EA580C" strokeWidth="3" />; })}
          </svg>
          <p className="text-center text-[10px] italic text-[#8E7965]">Radial distance represents categorical gauge position, not probability.</p>
        </div>

        <div className="space-y-3">
          {changed.map(({ kind, before, after, delta }) => (
            <article key={kind} className="rounded-2xl border border-[#E5DCCF]/70 bg-[#FFFDF9] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2"><span className="material-symbols-outlined text-[20px] text-[#B45309]">{icons[kind]}</span><strong className="text-[12px] text-[#1C1814]">{labels[kind]}</strong></div>
                <div className="flex items-center gap-2 text-[10px] font-bold"><span style={{ color: levelColor[before.level] }}>{before.level}</span><span className="material-symbols-outlined text-[15px] text-[#8E7965]">arrow_forward</span><span style={{ color: levelColor[after.level] }}>{after.level}</span><span className={`rounded-full px-2 py-0.5 ${delta > 1 ? 'bg-red-50 text-red-800' : delta < -1 ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-700'}`}>{delta > 0 ? '+' : ''}{Math.round(delta)}</span></div>
              </div>
              <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-[#E8DEC8]"><div className="absolute inset-y-0 left-0 rounded-full bg-slate-400/70 transition-all duration-500" style={{ width: `${Math.max(0, before.gaugeValue)}%` }} /><div className="absolute inset-y-0 left-0 rounded-full bg-orange-500 transition-all duration-500" style={{ width: `${Math.max(0, after.gaugeValue)}%`, opacity: 0.78 }} /></div>
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard icon="trending_up" label="Largest change" value={`${labels[largest.kind]} ${largest.delta >= 0 ? '+' : ''}${Math.round(largest.delta)}`} detail={`${largest.before.level} to ${largest.after.level}`} />
        <SummaryCard icon="notifications_active" label="Escalated signals" value={`${escalated.length} of 5`} detail={escalated.length ? escalated.map(item => labels[item.kind]).join(', ') : 'No risk band increased'} />
        <SummaryCard icon="priority_high" label="Highest simulated" value={`${simulation.highestAvailableRisk.level} ${simulation.highestAvailableRisk.title}`} detail={simulation.highestAvailableRisk.displayValue} />
      </div>
    </section>
  );
}

function SummaryCard({ icon, label, value, detail }: { icon: string; label: string; value: string; detail: string }) {
  return <article className="rounded-2xl border border-[#E5DCCF]/70 bg-[#F8F4EE] p-4"><span className="material-symbols-outlined text-[22px] text-[#B45309]">{icon}</span><p className="mt-2 text-[9px] font-bold uppercase tracking-[0.13em] text-[#8E7965]">{label}</p><p className="mt-1 text-[16px] font-black text-[#1C1814]">{value}</p><p className="mt-1 truncate text-[10px] text-[#6E645A]" title={detail}>{detail}</p></article>;
}
