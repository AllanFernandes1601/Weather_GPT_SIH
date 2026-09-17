import React from 'react';
import { RiskGauge } from './RiskGauge';
import { RiskAssessment } from '../utils/riskEngine';

interface RiskCardProps {
  assessment: RiskAssessment;
  gaugeValue?: number;
  floodContributions?: {
    rainfallLoad: number;
    districtSusceptibility: number;
  };
  isLive: boolean;
  isHighest: boolean;
  pulseToken?: number;
}

const levelStyles: Record<RiskAssessment['level'], string> = {
  Low: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  Moderate: 'bg-amber-50 text-amber-950 border-amber-200',
  High: 'bg-orange-50 text-orange-950 border-orange-200',
  Severe: 'bg-red-50 text-red-950 border-red-200',
  Unavailable: 'bg-stone-100 text-stone-700 border-stone-200'
};

export const RiskCard: React.FC<RiskCardProps> = ({
  assessment,
  gaugeValue,
  floodContributions,
  isLive,
  isHighest,
  pulseToken
}) => {
  const updated = new Date(assessment.updatedAt);
  const updatedLabel = Number.isNaN(updated.getTime())
    ? assessment.updatedAt
    : updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const shownGaugeValue = gaugeValue ?? assessment.gaugeValue;
  const contributions = assessment.kind === 'flood' && floodContributions
    ? [
        { label: 'Rainfall load', value: floodContributions.rainfallLoad, displayValue: assessment.contributions?.[0]?.displayValue ?? '' },
        { label: 'District susceptibility', value: floodContributions.districtSusceptibility, displayValue: assessment.contributions?.[1]?.displayValue ?? '' }
      ]
    : assessment.contributions;

  return (
    <article
      data-risk-kind={assessment.kind}
      className={`risk-card relative rounded-3xl bg-[#FFFDF9] border border-[#E5DCCF]/80 shadow-sm p-5 flex flex-col ${isLive && isHighest ? 'risk-card-live-highest' : ''}`}
    >
      {pulseToken !== undefined && (
        <span key={pulseToken} className="risk-connection-pulse" aria-hidden="true" />
      )}

      <header className="flex items-start justify-between gap-3">
        <div>
          <span className={`inline-flex px-2.5 py-1 rounded-md border text-[10px] uppercase tracking-[0.12em] font-bold ${levelStyles[assessment.level]}`}>
            {assessment.level} risk
          </span>
          <h4 className="text-[17px] font-bold text-[#1C1814] mt-2">{assessment.title}</h4>
        </div>
        <span className="material-symbols-outlined text-[25px] text-[#B45309]" aria-hidden="true">
          {assessment.icon}
        </span>
      </header>

      <div className="mt-2">
        <RiskGauge
          value={shownGaugeValue}
          displayValue={assessment.displayValue}
          title={assessment.title}
          level={assessment.level}
          isLive={isLive}
          isHighlighted={isHighest}
        />
        {assessment.estimateNote && (
          <p className="risk-card-estimate text-[10px] italic text-[#7C6F63] text-center mt-1">
            {assessment.estimateNote}
          </p>
        )}
      </div>

      {contributions && (
        <div className="risk-card-contributions mt-4 space-y-3 rounded-xl bg-[#F7F1E8] p-3" aria-label="Flood risk contribution breakdown">
          {contributions.map(contribution => (
            <div key={contribution.label}>
              <div className="flex justify-between gap-2 text-[10px] font-semibold text-[#5F554B]">
                <span>{contribution.label}</span>
                <span>{contribution.displayValue}</span>
              </div>
              <div className="h-2 mt-1.5 rounded-full bg-[#E2D8CB] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-orange-600 risk-contribution-fill"
                  style={{ width: `${Math.min(100, Math.max(0, contribution.value))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="risk-card-reason text-[12px] leading-relaxed text-[#4F463E] mt-4 flex-1">{assessment.reason}</p>

      <div className="risk-card-action mt-4 rounded-xl bg-[#F7F1E8] p-3">
        <p className="text-[9px] uppercase font-bold tracking-wider text-[#8E7965]">Recommended action</p>
        <p className="text-[11px] text-[#1C1814] font-medium leading-relaxed mt-1">{assessment.precautions[0]}</p>
      </div>

      <footer className="mt-4 pt-3 border-t border-[#E5DCCF]">
        <p className="text-[10px] text-[#6E645A] leading-relaxed">Source: {assessment.source}</p>
        <div className="flex items-end justify-between gap-3 mt-2">
          <p className="text-[9px] text-[#8E7965] leading-relaxed max-w-[75%]">{assessment.limitation}</p>
          <time className="text-[9px] font-semibold text-[#6E645A] whitespace-nowrap">Updated {updatedLabel}</time>
        </div>
      </footer>
    </article>
  );
};
