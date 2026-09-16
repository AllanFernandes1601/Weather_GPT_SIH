import { GovernmentAssistanceScheme } from '../types';

// Reverify scheme rules against the official portal and operational guidelines periodically.
export const DISASTER_ASSISTANCE_SCHEMES: readonly GovernmentAssistanceScheme[] = [
  {
    id: 'pmfby',
    name: 'Pradhan Mantri Fasal Bima Yojana',
    shortName: 'PMFBY',
    description: 'Government-supported crop insurance for admissible crop losses under notified scheme terms.',
    authority: 'Ministry of Agriculture and Farmers Welfare, Government of India',
    scope: 'national',
    applicableStates: [],
    applicableIncidents: ['flood', 'cyclone', 'drought', 'heavy_rain', 'lightning', 'landslide', 'crop_loss'],
    applicableImpacts: ['crop_damage', 'agricultural_land_damage'],
    applicableOccupations: ['farmer', 'tenant_farmer', 'sharecropper'],
    eligibilityRules: [
      {
        id: 'pmfby-farmer-status',
        field: 'farmerStatus',
        kind: 'allowed_values',
        values: ['farmer', 'tenant_farmer', 'sharecropper'],
        description: 'Applicant has a farmer, tenant farmer, or sharecropper status supported by the scheme terms.'
      },
      {
        id: 'pmfby-insurance-status',
        field: 'cropInsuranceStatus',
        kind: 'equals',
        value: 'insured',
        description: 'The affected crop is insured under PMFBY where insurance is required for the claim.'
      },
      {
        id: 'pmfby-notified-crop',
        field: 'cropNotifiedStatus',
        kind: 'equals',
        value: 'notified',
        description: 'The affected crop is notified for the relevant season and area.'
      },
      {
        id: 'pmfby-notified-area',
        field: 'notifiedAreaStatus',
        kind: 'equals',
        value: 'notified',
        description: 'The affected land is within the applicable notified area or insurance unit.'
      },
      {
        id: 'pmfby-covered-peril',
        field: 'coveredPerilStatus',
        kind: 'equals',
        value: 'covered',
        description: 'The reported peril or loss is covered under the applicable notified scheme terms.'
      }
    ],
    benefits: ['Claim assessment and indemnity for admissible crop loss under applicable PMFBY terms.'],
    requiredDocuments: [],
    officialSourceUrl: 'https://pmfby.gov.in/',
    applicationUrl: 'https://pmfby.gov.in/',
    sourceLabel: 'Official PMFBY portal and PMFBY operational guidelines',
    lastVerified: '2026-09-16'
  }
];