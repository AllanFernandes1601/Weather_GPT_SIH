export type NavTab = 'home' | 'forecast' | 'alerts' | 'weather-map' | 'safety';

export type IncidentType =
  | 'flood'
  | 'cyclone'
  | 'drought'
  | 'heavy_rain'
  | 'heatwave'
  | 'lightning'
  | 'landslide'
  | 'crop_loss'
  | 'house_damage'
  | 'livelihood_loss'
  | 'business_damage'
  | 'other';

export type ImpactType =
  | 'crop_damage'
  | 'agricultural_land_damage'
  | 'house_damage'
  | 'property_damage'
  | 'livestock_loss'
  | 'livelihood_loss'
  | 'employment_loss'
  | 'fishing_equipment_damage'
  | 'business_damage'
  | 'family_death'
  | 'injury'
  | 'displacement';

export type OccupationType =
  | 'farmer'
  | 'tenant_farmer'
  | 'sharecropper'
  | 'fisher'
  | 'business_owner'
  | 'worker'
  | 'self_employed'
  | 'employed'
  | 'unemployed'
  | 'student'
  | 'retired'
  | 'other'
  | 'unknown';

export type FarmerStatus = 'farmer' | 'tenant_farmer' | 'sharecropper' | 'not_farmer' | 'unknown';
export type CropInsuranceStatus = 'insured' | 'not_insured' | 'unknown';
export type CropNotifiedStatus = 'notified' | 'not_notified' | 'unknown';
export type FisherStatus = 'fisher' | 'fisheries_worker' | 'not_fisher' | 'unknown';
export type HouseDamageLevel = 'none' | 'partial' | 'severe' | 'destroyed' | 'unknown';
export type ResidenceType = 'urban' | 'rural' | 'unknown';
export type HousingSituation = 'owns_pucca_home' | 'kutcha_home' | 'houseless' | 'unknown';
export type AgeBand = '18_40' | '41_59' | '60_plus' | 'unknown';
export type UnorganisedWorkerStatus = 'yes' | 'no' | 'unknown';
export type MonthlyIncomeBand = 'below_15000' | '15000_25000' | 'above_25000' | 'unknown';
export type YesNoUnknown = 'yes' | 'no' | 'unknown';

export interface AssistanceUserProfile {
  incidentType?: IncidentType | IncidentType[];
  incidentDescription?: string;
  impactTypes?: ImpactType[];
  state?: string;
  district?: string;
  occupation?: OccupationType;
  farmerStatus?: FarmerStatus;
  cropInsuranceStatus?: CropInsuranceStatus;
  cropNotifiedStatus?: CropNotifiedStatus;
  agriculturalLandAffected?: boolean;
  housingDamage?: boolean;
  livelihoodLoss?: boolean;
  businessDamage?: boolean;
  annualHouseholdIncome?: number;
  notifiedAreaStatus?: 'notified' | 'not_notified' | 'unknown';
  coveredPerilStatus?: 'covered' | 'not_covered' | 'unknown';
  displacedFromHome?: boolean | 'unknown';
  houseDamageLevel?: HouseDamageLevel;
  essentialHouseholdLoss?: boolean | 'unknown';
  disasterRelatedInjury?: boolean | 'unknown';
  dailyWageWorker?: boolean | 'unknown';
  selfEmployed?: boolean | 'unknown';
  fisherStatus?: FisherStatus;
  residenceType?: ResidenceType;
  housingSituation?: HousingSituation;
  hospitalizationRequired?: boolean | 'unknown';
  familyMemberDeath?: boolean | 'unknown';
  ageBand?: AgeBand;
  unorganisedWorker?: UnorganisedWorkerStatus;
  monthlyIncomeBand?: MonthlyIncomeBand;
  mainIncomeSourceAffected?: YesNoUnknown;
}

export type AssistanceProfileField = keyof AssistanceUserProfile;

export type EligibilityRule =
  | {
      id: string;
      field: AssistanceProfileField;
      kind: 'required';
      description: string;
      userFacing?: boolean;
      confirmationLabel?: string;
    }
  | {
      id: string;
      field: AssistanceProfileField;
      kind: 'allowed_values';
      values: readonly string[];
      description: string;
      userFacing?: boolean;
      confirmationLabel?: string;
    }
  | {
      id: string;
      field: AssistanceProfileField;
      kind: 'equals';
      value: string | boolean;
      description: string;
      userFacing?: boolean;
      confirmationLabel?: string;
    };

export type EligibilityStatus =
  | 'ELIGIBLE'
  | 'POSSIBLY_ELIGIBLE'
  | 'NOT_ELIGIBLE'
  | 'INSUFFICIENT_INFORMATION';

export interface EligibilityResult {
  schemeId: string;
  status: EligibilityStatus;
  matchedReasons: string[];
  failedReasons: string[];
  missingInformation: string[];
  officialConfirmation: string[];
}

export interface GovernmentAssistanceScheme {
  id: string;
  name: string;
  shortName: string;
  description: string;
  authority: string;
  scope: 'national' | 'state' | 'district';
  assistanceType: 'scheme' | 'disaster_relief' | 'insurance' | 'welfare';
  actionType: 'apply' | 'check_eligibility' | 'official_information' | 'contact_authority';
  resultCategory?: 'direct' | 'additional';
  candidateRequiresUserFacingMatch?: boolean;
  applicableStates: readonly string[];
  applicableIncidents: readonly IncidentType[];
  applicableImpacts: readonly ImpactType[];
  applicableOccupations: readonly OccupationType[];
  eligibilityRules: readonly EligibilityRule[];
  benefits: readonly string[];
  requiredDocuments: readonly string[];
  officialSourceUrl: string;
  applicationUrl: string;
  sourceLabel: string;
  lastVerified: string;
}

export interface RainPrediction {
  probability: number;
  willRain: boolean;
  threshold: number;
  observedAt: string;
  modelScope: 'Bengaluru';
}

export interface LocationData {
  id: string;
  name: string;
  state: string;
  coordinates: string;
  latitude?: number;
  longitude?: number;
  isLive?: boolean;
  dataSource?: string;
  rainPrediction?: RainPrediction | null;
  isDay?: boolean;
  weatherIcon?: string;
  temperature: number;
  condition: string;
  feelsLike: number;
  high: number;
  low: number;
  greeting: string;
  humidity: number;
  humidityDesc: string;
  windSpeed: number;
  windDirection: string;
  windGusts: number;
  uvIndex: number;
  uvCategory: string;
  visibility: number;
  pressure: number;
  pressureTendency: string;
  radarStation: string;
  convectiveCell: string;
  airQuality: {
    aqi: number;
    status: string;
    pm25: number;
    pm10: number;
    description: string;
  };
  solarCycle: {
    daylightDuration: string;
    sunrise: string;
    sunset: string;
    progressPercentage: number;
  };
  precipitation: {
    dailyTotalMm: number;
    dewPoint: number;
    moistureFlux?: number;
    description: string;
  };
}

export interface HourlyForecastItem {
  time: string;
  forecastTime?: string;
  temperature: number;
  condition: string;
  rainProbability: number;
  icon: string;
  isNow?: boolean;
  isWarning?: boolean;
  isPeakStorm?: boolean;
}

export interface WeatherAlert {
  id: string;
  severity: 'moderate' | 'high' | 'severe';
  badgeText: string;
  bulletinRef: string;
  stage: string;
  title: string;
  timeWindow: string;
  description: string;
  affectedCorridors: string[];
  routePrecautions: string[];
  safetyChecklist: string[];
}

export interface SuggestedQuestion {
  id: string;
  text: string;
  subtitle: string;
  icon: string;
  bgClass: string;
  borderClass: string;
  colSpan?: string;
  mockAnswer: {
    summary: string;
    riskLevel: 'Low' | 'Moderate' | 'High';
    timing: string;
    actionItems: string[];
  };
}

export interface RemoteLocationResult {
  name: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  displayName: string;
}
