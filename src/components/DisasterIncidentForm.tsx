import React, { FormEvent, useMemo, useState } from 'react';
import { AssistanceUserProfile, ImpactType, IncidentType } from '../types';
import { normalizeIncident } from '../utils/disasterAssistanceEligibility';

interface IncidentOption {
  id: string;
  label: string;
  icon: string;
  incidentTypes: IncidentType[];
  impactTypes: ImpactType[];
}

export interface DisasterIncidentFormProps {
  onSubmit: (profile: AssistanceUserProfile) => void;
  initialProfile?: AssistanceUserProfile;
}

const INCIDENT_OPTIONS: readonly IncidentOption[] = [
  { id: 'flood', label: 'Flood', icon: 'flood', incidentTypes: ['flood'], impactTypes: [] },
  { id: 'cyclone', label: 'Cyclone', icon: 'cyclone', incidentTypes: ['cyclone'], impactTypes: [] },
  { id: 'drought', label: 'Drought', icon: 'water_drop', incidentTypes: ['drought'], impactTypes: [] },
  { id: 'heavy-rain', label: 'Heavy Rain', icon: 'rainy', incidentTypes: ['heavy_rain'], impactTypes: [] },
  { id: 'heatwave', label: 'Heatwave', icon: 'sunny', incidentTypes: ['heatwave'], impactTypes: [] },
  { id: 'lightning', label: 'Lightning', icon: 'bolt', incidentTypes: ['lightning'], impactTypes: [] },
  { id: 'landslide', label: 'Landslide', icon: 'landslide', incidentTypes: ['landslide'], impactTypes: [] },
  { id: 'crop-damage', label: 'Crop Damage', icon: 'agriculture', incidentTypes: ['crop_loss'], impactTypes: ['crop_damage'] },
  { id: 'home-damage', label: 'Home Damage', icon: 'home', incidentTypes: ['house_damage'], impactTypes: ['house_damage'] },
  { id: 'livelihood-loss', label: 'Livelihood Loss', icon: 'work_off', incidentTypes: ['livelihood_loss'], impactTypes: ['livelihood_loss'] },
  { id: 'business-damage', label: 'Business Damage', icon: 'storefront', incidentTypes: ['business_damage'], impactTypes: ['business_damage'] },
  { id: 'other', label: 'Other', icon: 'more_horiz', incidentTypes: ['other'], impactTypes: [] }
];

const TEXT_IMPACT_MATCHERS: readonly { keywords: readonly string[]; impacts: ImpactType[] }[] = [
  { keywords: ['crop', 'crops', 'rice', 'wheat', 'harvest'], impacts: ['crop_damage'] },
  { keywords: ['farm', 'farmland', 'field', 'fields'], impacts: ['agricultural_land_damage'] },
  { keywords: ['house', 'home'], impacts: ['house_damage'] },
  { keywords: ['property', 'belongings', 'household items'], impacts: ['property_damage'] },
  { keywords: ['displaced', 'evacuated', 'left home'], impacts: ['displacement'] },
  { keywords: ['injury', 'injured', 'hurt'], impacts: ['injury'] },
  { keywords: ['livestock', 'cattle', 'animals'], impacts: ['livestock_loss'] },
  { keywords: ['fishery', 'fisheries', 'fishing equipment', 'boat', 'nets'], impacts: ['fishing_equipment_damage'] },
  { keywords: ['business', 'shop', 'store'], impacts: ['business_damage'] },
  { keywords: ['job', 'work', 'livelihood', 'income'], impacts: ['livelihood_loss', 'employment_loss'] }
];

function uniqueValues<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalizeDescription(description: string): {
  incidents: IncidentType[];
  impacts: ImpactType[];
} {
  const normalized = description.toLowerCase().trim();
  const incidents = normalizeIncident(normalized);
  const additionalIncidents: IncidentType[] = /rainfall|downpour/.test(normalized)
    ? ['heavy_rain']
    : [];
  const impacts = TEXT_IMPACT_MATCHERS
    .filter(({ keywords }) => keywords.some(keyword => normalized.includes(keyword)))
    .flatMap(({ impacts: matchedImpacts }) => matchedImpacts);

  return {
    incidents: uniqueValues([...incidents, ...additionalIncidents]),
    impacts: uniqueValues(impacts)
  };
}

export const DisasterIncidentForm: React.FC<DisasterIncidentFormProps> = ({
  onSubmit,
  initialProfile
}) => {
  const [description, setDescription] = useState(initialProfile?.incidentDescription || '');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const textClassification = useMemo(() => normalizeDescription(description), [description]);
  const selectedOptionData = INCIDENT_OPTIONS.filter(option => selectedOptions.includes(option.id));
  const recognizedIncidentCount = textClassification.incidents.filter(incident => incident !== 'other').length;
  const hasIncidentSelection = selectedOptions.length > 0 || recognizedIncidentCount > 0 || description.trim().length > 0;

  const toggleOption = (option: IncidentOption) => {
    setSelectedOptions(current => current.includes(option.id)
      ? current.filter(id => id !== option.id)
      : [...current, option.id]);
    setHasSubmitted(false);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedIncidents = selectedOptionData.flatMap(option => option.incidentTypes);
    const selectedImpacts = selectedOptionData.flatMap(option => option.impactTypes);
    const incidents = uniqueValues([
      ...selectedIncidents,
      ...textClassification.incidents
    ]);

    onSubmit({
      ...initialProfile,
      incidentType: incidents.length ? incidents : ['other'],
      impactTypes: uniqueValues([...selectedImpacts, ...textClassification.impacts]),
      incidentDescription: description.trim() || undefined
    });
    setHasSubmitted(true);
  };

  return (
    <section
      id="disaster-incident-form"
      className="relative overflow-hidden rounded-3xl border-2 border-[#B45309]/25 bg-gradient-to-br from-[#FFFDF9] via-[#FCF9F3] to-[#F7EFE1] p-5 shadow-[0_8px_40px_rgba(46,40,35,0.07)] sm:p-8"
    >
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl" />
      <div className="relative">
        <div className="mb-6 flex items-start gap-3 border-b border-[#E5DCCF]/70 pb-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-[#B45309] text-white shadow-md shadow-amber-500/20">
            <span className="material-symbols-outlined text-[25px]">emergency_home</span>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#B45309]">Assistance Finder</p>
            <h2 className="mt-1 text-[24px] font-bold leading-tight tracking-tight text-[#1C1814] sm:text-[28px]">
              Tell us what happened
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[#6E645A] sm:text-[14px]">
              Choose everything that applies, or describe the incident in your own words.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-7">
          <fieldset>
            <legend className="mb-3 text-[13px] font-bold uppercase tracking-wider text-[#6E645A]">
              What happened?
            </legend>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {INCIDENT_OPTIONS.map(option => {
                const isSelected = selectedOptions.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleOption(option)}
                    className={`flex min-h-[72px] items-center gap-2 rounded-2xl border px-3 py-3 text-left transition-all active:scale-[0.98] ${
                      isSelected
                        ? 'border-[#B45309] bg-amber-100 text-[#7C2D12] shadow-sm ring-2 ring-[#B45309]/15'
                        : 'border-[#E5DCCF] bg-white/75 text-[#6E645A] hover:border-[#D97706] hover:bg-amber-50/70 hover:text-[#1C1814]'
                    }`}
                  >
                    <span className="material-symbols-outlined shrink-0 text-[21px]">{option.icon}</span>
                    <span className="text-[12px] font-semibold leading-tight sm:text-[13px]">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="incident-description" className="mb-3 block text-[13px] font-bold uppercase tracking-wider text-[#6E645A]">
              Tell us what happened
            </label>
            <textarea
              id="incident-description"
              value={description}
              onChange={event => {
                setDescription(event.target.value);
                setHasSubmitted(false);
              }}
              rows={4}
              placeholder="Heavy rain flooded my farm and damaged my rice crop."
              className="w-full resize-y rounded-2xl border-2 border-[#E5DCCF] bg-white px-4 py-3 text-[14px] leading-relaxed text-[#1C1814] shadow-sm outline-none transition focus:border-[#B45309] focus:ring-4 focus:ring-[#B45309]/15 placeholder:text-[#6E645A]/55"
            />
            <p className="mt-2 text-[11px] leading-relaxed text-[#8E9197]">
              We will identify only the incident and impact types described. Eligibility details are asked separately.
            </p>
          </div>

          {textClassification.incidents.length > 0 && description.trim() && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-[12px] text-[#7C2D12]">
              <span className="font-bold">Recognized:</span>{' '}
              {[...textClassification.incidents, ...textClassification.impacts].join(', ').replaceAll('_', ' ')}
            </div>
          )}

          {!hasIncidentSelection && hasSubmitted && (
            <p role="alert" className="text-[12px] font-semibold text-[#C2410C]">
              Choose an incident or describe what happened before continuing.
            </p>
          )}

          <div className="flex flex-col items-stretch justify-between gap-3 border-t border-[#E5DCCF]/70 pt-5 sm:flex-row sm:items-center">
            <p className="text-[11px] text-[#8E9197]">Your description stays in this form and is not saved.</p>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D97706] px-5 py-3 text-[13px] font-bold text-white shadow-md shadow-amber-600/20 transition hover:bg-[#B45309] active:scale-[0.98]"
            >
              Continue to eligibility questions
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>

          {hasSubmitted && hasIncidentSelection && (
            <p role="status" className="text-[12px] font-semibold text-emerald-700">
              Incident details prepared for the next step.
            </p>
          )}
        </form>
      </div>
    </section>
  );
};
