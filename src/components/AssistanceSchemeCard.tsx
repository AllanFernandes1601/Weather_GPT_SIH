import React from 'react';
import { EligibilityResult, GovernmentAssistanceScheme } from '../types';

interface AssistanceSchemeCardProps {
  scheme: GovernmentAssistanceScheme;
  result: EligibilityResult;
}

const STATUS_LABELS: Record<EligibilityResult['status'], string> = {
  ELIGIBLE: 'Appears eligible based on the information provided',
  POSSIBLY_ELIGIBLE: 'May be eligible',
  INSUFFICIENT_INFORMATION: 'More information required',
  NOT_ELIGIBLE: 'Does not currently match the listed eligibility rules'
};

const STATUS_STYLES: Record<EligibilityResult['status'], string> = {
  ELIGIBLE: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  POSSIBLY_ELIGIBLE: 'border-amber-200 bg-amber-50 text-amber-900',
  INSUFFICIENT_INFORMATION: 'border-blue-200 bg-blue-50 text-blue-800',
  NOT_ELIGIBLE: 'border-[#E5DCCF] bg-[#F5F0E8] text-[#6E645A]'
};

function formatScope(scope: GovernmentAssistanceScheme['scope']): string {
  return `${scope.charAt(0).toUpperCase()}${scope.slice(1)} scheme`;
}

function formatAssistanceType(type: GovernmentAssistanceScheme['assistanceType']): string {
  if (type === 'disaster_relief') return 'Disaster Relief';
  if (type === 'insurance') return 'Crop Insurance';
  if (type === 'welfare') return 'Welfare / Support';
  return 'Government Scheme';
}

function formatProgramType(scheme: GovernmentAssistanceScheme): string {
  if (scheme.shortName === 'PMSBY') return 'Government Accident Insurance';
  if (scheme.shortName === 'PMJJBY') return 'Government Life Insurance';
  if (scheme.shortName === 'RWBCIS') return 'Weather-based Crop Insurance';
  return formatAssistanceType(scheme.assistanceType);
}

function statusLabel(scheme: GovernmentAssistanceScheme, status: EligibilityResult['status']): string {
  if (scheme.assistanceType === 'disaster_relief' && status !== 'NOT_ELIGIBLE') {
    return 'Relief may be available through your State/District administration';
  }
  if (scheme.actionType === 'official_information' && status !== 'NOT_ELIGIBLE') {
    return 'Check official assistance options';
  }
  return STATUS_LABELS[status];
}

function actionLabel(scheme: GovernmentAssistanceScheme): string {
  if (scheme.actionType === 'contact_authority') return 'View official authority information';
  if (scheme.actionType === 'official_information') {
    return scheme.id === 'myscheme-discovery'
      ? 'Find More Schemes on myScheme'
      : 'View Official Assistance Information';
  }
  if (scheme.actionType === 'check_eligibility') return 'Check Eligibility on Official Website';
  return 'View / Apply on Official Website';
}

export const AssistanceSchemeCard: React.FC<AssistanceSchemeCardProps> = ({ scheme, result }) => (
  <article className="rounded-3xl border border-[#E5DCCF] bg-white p-5 shadow-sm sm:p-6">
    <div className="border-b border-[#E5DCCF]/70 pb-5">
      <h3 className="text-[24px] font-bold leading-tight tracking-tight text-[#1C1814] sm:text-[28px]">
        {scheme.name}{scheme.shortName ? ` (${scheme.shortName})` : ''}
      </h3>
      <p className="mt-2 text-[12px] font-bold uppercase tracking-wider text-[#6E645A]">
        {formatProgramType(scheme)}
      </p>
      <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold leading-snug ${STATUS_STYLES[result.status]}`}>
          <span className="material-symbols-outlined text-[16px]">
            {result.status === 'ELIGIBLE' ? 'check_circle' : result.status === 'NOT_ELIGIBLE' ? 'cancel' : 'info'}
          </span>
          {statusLabel(scheme, result.status)}
        </span>
        <p className="text-[12px] font-semibold text-[#6E645A]">{scheme.authority}</p>
      </div>
    </div>

    <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#8E9197]">About this assistance</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#6E645A]">{scheme.description}</p>
          <p className="mt-2 text-[12px] font-semibold text-[#6E645A]">Scope: {formatScope(scheme.scope)}</p>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#8E9197]">Why it matched</p>
          {result.matchedReasons.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {result.matchedReasons.map(reason => (
                <li key={reason} className="flex gap-2 text-[13px] leading-relaxed text-[#1C1814]">
                  <span className="material-symbols-outlined mt-0.5 text-[16px] text-emerald-600">check</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-[13px] text-[#6E645A]">The incident details were not enough to confirm a matching rule.</p>
          )}
        </div>

        {result.missingInformation.length > 0 && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800">Information still required</p>
            <ul className="mt-2 space-y-1.5">
              {result.missingInformation.map(item => (
                <li key={item} className="flex gap-2 text-[12px] leading-relaxed text-blue-900">
                  <span className="material-symbols-outlined mt-0.5 text-[15px]">help</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.officialConfirmation.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-900">Needs official confirmation</p>
            <ul className="mt-2 space-y-1.5">
              {result.officialConfirmation.map(item => (
                <li key={item} className="flex gap-2 text-[12px] leading-relaxed text-amber-950">
                  <span className="material-symbols-outlined mt-0.5 text-[15px]">verified_user</span>
                  <span>{item.replace('Needs official confirmation: ', '')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.failedReasons.length > 0 && (
          <div className="rounded-2xl border border-[#E5DCCF] bg-[#F5F0E8] p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6E645A]">Rule mismatch</p>
            <ul className="mt-2 space-y-1.5">
              {result.failedReasons.map(reason => (
                <li key={reason} className="text-[12px] leading-relaxed text-[#6E645A]">{reason}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-5 rounded-2xl border border-[#E5DCCF]/80 bg-[#FFFDF9] p-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#8E9197]">Benefits listed by the source</p>
          {scheme.benefits.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {scheme.benefits.map(benefit => (
                <li key={benefit} className="flex gap-2 text-[12px] leading-relaxed text-[#1C1814]">
                  <span className="material-symbols-outlined mt-0.5 text-[16px] text-[#B45309]">verified</span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-1.5 text-[12px] text-[#6E645A]">No benefits are listed in the stored scheme record.</p>}
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#8E9197]">Required documents</p>
          {scheme.requiredDocuments.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {scheme.requiredDocuments.map(document => (
                <li key={document} className="text-[12px] leading-relaxed text-[#6E645A]">{document}</li>
              ))}
            </ul>
          ) : <p className="mt-1.5 text-[12px] text-[#6E645A]">No document list is available in the stored scheme record.</p>}
        </div>

        <div className="border-t border-[#E5DCCF]/70 pt-4">
          <a
            href={scheme.applicationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D97706] px-4 py-3 text-center text-[12px] font-bold text-white shadow-md shadow-amber-600/20 transition hover:bg-[#B45309]"
          >
            {actionLabel(scheme)}
            <span className="material-symbols-outlined text-[17px]">open_in_new</span>
          </a>
          <a
            href={scheme.officialSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#B45309] hover:underline"
          >
            Official source: {scheme.sourceLabel}
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
          <p className="mt-2 text-[11px] text-[#8E9197]">Last verified: {scheme.lastVerified}</p>
        </div>
      </div>
    </div>
  </article>
);
