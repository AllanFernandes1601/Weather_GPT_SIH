import React, { useMemo, useState } from 'react';
import { AssistanceUserProfile, EligibilityResult, EligibilityStatus, GovernmentAssistanceScheme } from '../types';
import { DISASTER_ASSISTANCE_SCHEMES } from '../data/disasterAssistanceSchemes';
import { evaluateAllSchemes } from '../utils/disasterAssistanceEligibility';
import { AssistanceSchemeCard } from './AssistanceSchemeCard';

interface AssistanceResultsProps {
  profile: AssistanceUserProfile;
  schemes?: readonly GovernmentAssistanceScheme[];
  onBack?: () => void;
}

const VISIBLE_STATUSES: readonly EligibilityStatus[] = [
  'ELIGIBLE',
  'POSSIBLY_ELIGIBLE',
  'INSUFFICIENT_INFORMATION'
];

const GROUP_DETAILS: Record<Exclude<EligibilityStatus, 'NOT_ELIGIBLE'>, { title: string; description: string; icon: string }> = {
  ELIGIBLE: {
    title: 'Appears eligible',
    description: 'These schemes match all currently evaluated rules based on the information provided.',
    icon: 'check_circle'
  },
  POSSIBLY_ELIGIBLE: {
    title: 'May be eligible',
    description: 'These schemes match some rules, but more information is needed for a complete assessment.',
    icon: 'pending'
  },
  INSUFFICIENT_INFORMATION: {
    title: 'More information required',
    description: 'These schemes may be relevant, but the available profile does not confirm enough rules yet.',
    icon: 'help'
  }
};

const DISCLAIMER = 'WeatherGPT provides an initial eligibility assessment based on the information you entered and the scheme rules stored in this application. Final eligibility, claim acceptance, and benefits are determined by the responsible government authority.';

export const AssistanceResults: React.FC<AssistanceResultsProps> = ({
  profile,
  schemes = DISASTER_ASSISTANCE_SCHEMES,
  onBack
}) => {
  const [showIneligible, setShowIneligible] = useState(false);
  const results = useMemo(() => evaluateAllSchemes(profile, schemes), [profile, schemes]);
  const schemeById = useMemo(
    () => new Map(schemes.map(scheme => [scheme.id, scheme])),
    [schemes]
  );
  const groupedResults = VISIBLE_STATUSES.map(status => ({
    status,
    items: results.filter(result => result.status === status && schemeById.get(result.schemeId)?.resultCategory !== 'additional')
  })).filter(group => group.items.length > 0);
  const additionalGroupedResults = VISIBLE_STATUSES.map(status => ({
    status,
    items: results.filter(result => result.status === status && schemeById.get(result.schemeId)?.resultCategory === 'additional')
  })).filter(group => group.items.length > 0);
  const ineligibleResults = results.filter(result => result.status === 'NOT_ELIGIBLE');
  const hasProfileInput = Object.keys(profile).length > 0;
  const hasCandidateResults = results.length > 0;
  const hasVisibleResults = groupedResults.length > 0 || additionalGroupedResults.length > 0;

  const renderGroups = (groups: typeof groupedResults) => groups.map(group => {
    const details = GROUP_DETAILS[group.status];
    return (
      <section key={group.status} aria-labelledby={`assistance-group-${group.status}`}>
        <div className="mb-3 flex items-start gap-2">
          <span className="material-symbols-outlined mt-0.5 text-[21px] text-[#B45309]">{details.icon}</span>
          <div>
            <h3 id={`assistance-group-${group.status}`} className="text-[17px] font-bold text-[#1C1814]">{details.title}</h3>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[#6E645A]">{details.description}</p>
          </div>
        </div>
        <div className="space-y-4">
          {group.items.map(result => {
            const scheme = schemeById.get(result.schemeId);
            return scheme ? <AssistanceSchemeCard key={result.schemeId} scheme={scheme} result={result} /> : null;
          })}
        </div>
      </section>
    );
  });

  return (
    <section
      id="assistance-results"
      className="relative overflow-hidden rounded-3xl border-2 border-[#B45309]/25 bg-gradient-to-br from-[#FFFDF9] via-[#FCF9F3] to-[#F7EFE1] p-5 shadow-[0_8px_40px_rgba(46,40,35,0.07)] sm:p-8"
    >
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl" />
      <div className="relative">
        <div className="mb-6 flex flex-col gap-4 border-b border-[#E5DCCF]/70 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-[#B45309] text-white shadow-md shadow-amber-500/20">
              <span className="material-symbols-outlined text-[25px]">account_balance</span>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#B45309]">Assistance Finder</p>
              <h2 className="mt-1 text-[24px] font-bold leading-tight tracking-tight text-[#1C1814] sm:text-[28px]">Assistance results</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-[#6E645A] sm:text-[14px]">Government schemes, disaster-relief pathways, and official information options related to the incident.</p>
            </div>
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center justify-center gap-2 self-start rounded-2xl border border-[#E5DCCF] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#6E645A] transition hover:bg-[#F5F0E8] hover:text-[#1C1814]"
            >
              <span className="material-symbols-outlined text-[17px]">arrow_back</span>
              Review answers
            </button>
          )}
        </div>

        <div className="mb-7 rounded-2xl border border-blue-200 bg-blue-50/75 p-4 text-[12px] leading-relaxed text-blue-950">
          <div className="flex gap-2">
            <span className="material-symbols-outlined mt-0.5 text-[18px] text-blue-700">info</span>
            <p>{DISCLAIMER}</p>
          </div>
        </div>

        {!hasProfileInput ? (
          <div className="rounded-2xl border border-[#E5DCCF] bg-white/75 p-5 text-[13px] leading-relaxed text-[#6E645A]">
            Start by describing what happened so WeatherGPT can identify relevant assistance programs.
          </div>
        ) : !hasCandidateResults ? (
          <div className="rounded-2xl border border-[#E5DCCF] bg-white/75 p-5 text-[13px] leading-relaxed text-[#6E645A]">
            No stored government assistance scheme currently matches this incident profile.
          </div>
        ) : !hasVisibleResults ? (
          <div className="rounded-2xl border border-[#E5DCCF] bg-white/75 p-5 text-[13px] leading-relaxed text-[#6E645A]">
            The relevant stored schemes do not currently match the listed eligibility rules.
          </div>
        ) : (
          <div className="space-y-8">
            {groupedResults.length > 0 && (
              <section className="space-y-5" aria-labelledby="primary-assistance-results">
                <div>
                  <h3 id="primary-assistance-results" className="text-[18px] font-bold text-[#1C1814]">Most relevant to what happened</h3>
                  <p className="mt-1 text-[12px] text-[#6E645A]">Direct insurance, named programs, and impact-specific disaster relief.</p>
                </div>
                {renderGroups(groupedResults)}
              </section>
            )}
            {additionalGroupedResults.length > 0 && (
              <section className="space-y-5 border-t border-[#E5DCCF]/70 pt-6" aria-labelledby="additional-assistance-results">
                <div>
                  <h3 id="additional-assistance-results" className="text-[18px] font-bold text-[#1C1814]">Additional government support you may want to check</h3>
                  <p className="mt-1 text-[12px] text-[#6E645A]">These programs are not disaster compensation, but may be relevant after the incident.</p>
                </div>
                {renderGroups(additionalGroupedResults)}
              </section>
            )}
          </div>
        )}

        {ineligibleResults.length > 0 && (
          <div className="mt-7 border-t border-[#E5DCCF]/70 pt-5">
            <button
              type="button"
              onClick={() => setShowIneligible(current => !current)}
              className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#6E645A] hover:text-[#1C1814]"
            >
              <span className="material-symbols-outlined text-[17px]">{showIneligible ? 'expand_less' : 'expand_more'}</span>
              {showIneligible ? 'Hide ineligible schemes' : 'Show ineligible schemes'}
            </button>
            {showIneligible && (
              <div className="mt-4 space-y-4">
                {ineligibleResults.map(result => {
                  const scheme = schemeById.get(result.schemeId);
                  return scheme ? <AssistanceSchemeCard key={result.schemeId} scheme={scheme} result={result} /> : null;
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
