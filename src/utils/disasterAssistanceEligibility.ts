import {
  AssistanceProfileField,
  AssistanceUserProfile,
  EligibilityResult,
  EligibilityRule,
  GovernmentAssistanceScheme,
  IncidentType
} from '../types';
import { DISASTER_ASSISTANCE_SCHEMES } from '../data/disasterAssistanceSchemes';

const INCIDENT_KEYWORDS: Readonly<Record<IncidentType, readonly string[]>> = {
  flood: ['flood', 'flooding', 'inundation', 'waterlogging'],
  cyclone: ['cyclone', 'hurricane', 'typhoon'],
  drought: ['drought', 'dry spell', 'no rainfall'],
  heavy_rain: ['heavy rain', 'extreme rainfall', 'cloudburst', 'downpour'],
  heatwave: ['heatwave', 'heat wave', 'extreme heat'],
  lightning: ['lightning', 'thunderbolt'],
  landslide: ['landslide', 'mudslide'],
  crop_loss: ['crop loss', 'crop damage', 'lost crops', 'crop failure'],
  house_damage: ['house damage', 'home damage'],
  livelihood_loss: ['livelihood loss', 'lost livelihood', 'income loss'],
  business_damage: ['business damage', 'shop damage', 'business loss'],
  other: []
};

const PROFILE_LABELS: Readonly<Partial<Record<AssistanceProfileField, string>>> = {
  state: 'state',
  occupation: 'occupation',
  farmerStatus: 'farmer status',
  cropInsuranceStatus: 'crop insurance status',
  cropNotifiedStatus: 'whether the crop is notified',
  notifiedAreaStatus: 'whether the land is in a notified area or insurance unit',
  coveredPerilStatus: 'whether the reported peril is covered',
  houseDamageLevel: 'house damage level',
  displacedFromHome: 'displacement status',
  essentialHouseholdLoss: 'essential household loss',
  disasterRelatedInjury: 'disaster-related injury',
  livelihoodLoss: 'livelihood loss',
  businessDamage: 'business damage',
  dailyWageWorker: 'daily-wage work status',
  fisherStatus: 'fisher status',
  agriculturalLandAffected: 'agricultural land affected'
};

export function normalizeIncident(input: string | IncidentType | null | undefined): IncidentType[] {
  if (!input) return [];
  if (input in INCIDENT_KEYWORDS) return [input as IncidentType];

  const normalized = input.toLowerCase().trim();
  const matches = (Object.entries(INCIDENT_KEYWORDS) as [IncidentType, readonly string[]][])
    .filter(([, keywords]) => keywords.some(keyword => normalized.includes(keyword)))
    .map(([incident]) => incident);

  return matches.length ? matches : ['other'];
}

function profileIncidents(profile: AssistanceUserProfile): IncidentType[] {
  if (Array.isArray(profile.incidentType)) return profile.incidentType;
  return normalizeIncident(profile.incidentType || profile.incidentDescription);
}

export function getCandidateSchemes(
  profile: AssistanceUserProfile,
  schemes: readonly GovernmentAssistanceScheme[] = DISASTER_ASSISTANCE_SCHEMES
): GovernmentAssistanceScheme[] {
  const incidents = profileIncidents(profile);
  const impacts = profile.impactTypes || [];
  const occupation = profile.occupation;

  return schemes.filter(scheme => {
    const incidentMatch = incidents.some(incident => scheme.applicableIncidents.includes(incident));
    const impactMatch = impacts.some(impact => scheme.applicableImpacts.includes(impact));
    const occupationMatch = occupation ? scheme.applicableOccupations.includes(occupation) : false;
    if (!incidentMatch) return false;
    if (scheme.applicableImpacts.length === 0) return true;
    return impactMatch && (scheme.applicableOccupations.length === 0 || occupationMatch || !occupation);
  });
}

export function getRequiredQuestions(
  schemes: readonly GovernmentAssistanceScheme[]
): string[] {
  const questions = new Set<string>();
  schemes.forEach(scheme => {
    scheme.eligibilityRules.forEach(rule => {
      if (rule.kind === 'required' || rule.kind === 'allowed_values' || rule.kind === 'equals') {
        questions.add(PROFILE_LABELS[rule.field] || rule.field);
      }
    });
  });
  return [...questions];
}

function readField(profile: AssistanceUserProfile, field: AssistanceProfileField): unknown {
  return profile[field];
}

function evaluateRule(
  rule: EligibilityRule,
  profile: AssistanceUserProfile
): { matched?: string; failed?: string; missing?: string } {
  const value = readField(profile, rule.field);
  const label = PROFILE_LABELS[rule.field] || rule.field;

  if (value === undefined || value === null || value === '' || value === 'unknown') {
    return { missing: `Provide ${label}.` };
  }

  if (rule.kind === 'required') return { matched: rule.description };

  if (rule.kind === 'allowed_values') {
    if (typeof value === 'string' && rule.values.includes(value)) return { matched: rule.description };
    return { failed: rule.description };
  }

  if (value === rule.value) return { matched: rule.description };
  return { failed: rule.description };
}

export function evaluateSchemeEligibility(
  profile: AssistanceUserProfile,
  scheme: GovernmentAssistanceScheme
): EligibilityResult {
  const matchedReasons: string[] = [];
  const failedReasons: string[] = [];
  const missingInformation: string[] = [];

  scheme.eligibilityRules.forEach(rule => {
    const result = evaluateRule(rule, profile);
    if (result.matched) matchedReasons.push(result.matched);
    if (result.failed) failedReasons.push(result.failed);
    if (result.missing) missingInformation.push(result.missing);
  });

  const status = failedReasons.length
    ? 'NOT_ELIGIBLE'
    : missingInformation.length
      ? (matchedReasons.length ? 'POSSIBLY_ELIGIBLE' : 'INSUFFICIENT_INFORMATION')
      : 'ELIGIBLE';

  return { schemeId: scheme.id, status, matchedReasons, failedReasons, missingInformation };
}

export function evaluateAllSchemes(
  profile: AssistanceUserProfile,
  schemes: readonly GovernmentAssistanceScheme[] = DISASTER_ASSISTANCE_SCHEMES
): EligibilityResult[] {
  return getCandidateSchemes(profile, schemes).map(scheme => evaluateSchemeEligibility(profile, scheme));
}