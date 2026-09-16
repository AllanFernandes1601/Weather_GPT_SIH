import React, { useEffect, useState } from 'react';
import { AssistanceUserProfile } from '../types';
import { getCandidateSchemes, getRequiredQuestions } from '../utils/disasterAssistanceEligibility';

interface AssistanceQuestionsProps {
  profile: AssistanceUserProfile;
  onChange: (profile: AssistanceUserProfile) => void;
  onContinue: () => void;
  onBack?: () => void;
}

type QuestionField =
  | 'state'
  | 'occupation'
  | 'farmerStatus'
  | 'cropInsuranceStatus'
  | 'cropNotifiedStatus'
  | 'notifiedAreaStatus'
  | 'coveredPerilStatus'
  | 'houseDamageLevel'
  | 'displacedFromHome'
  | 'essentialHouseholdLoss'
  | 'disasterRelatedInjury'
  | 'livelihoodLoss'
  | 'businessDamage'
  | 'dailyWageWorker'
  | 'fisherStatus'
  | 'agriculturalLandAffected'
  | 'residenceType'
  | 'housingSituation'
  | 'hospitalizationRequired'
  | 'familyMemberDeath'
  | 'ageBand'
  | 'unorganisedWorker'
  | 'monthlyIncomeBand'
  | 'mainIncomeSourceAffected';

type QuestionOption = {
  label: string;
  value: string | boolean | undefined;
};

interface AssistanceQuestionDefinition {
  field: QuestionField;
  engineLabel: string;
  question: string;
  supportingText: string;
  inputType: 'text' | 'choice';
  options?: readonly QuestionOption[];
  placeholder?: string;
}

const QUESTION_DEFINITIONS: readonly AssistanceQuestionDefinition[] = [
  {
    field: 'ageBand',
    engineLabel: 'age band',
    question: 'Which age group are you in?',
    supportingText: 'Choose a broad age group only.',
    inputType: 'choice',
    options: [
      { label: '18–40', value: '18_40' },
      { label: '41–59', value: '41_59' },
      { label: '60 or older', value: '60_plus' },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'residenceType',
    engineLabel: 'residence type',
    question: 'Do you live in an urban or rural area?',
    supportingText: 'Choose the broad area type only. Do not enter an address.',
    inputType: 'choice',
    options: [
      { label: 'Urban', value: 'urban' },
      { label: 'Rural', value: 'rural' },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'state',
    engineLabel: 'state',
    question: 'Which state or Union Territory did the incident occur in?',
    supportingText: 'This helps identify the responsible local authority or relevant government programs.',
    inputType: 'text',
    placeholder: 'For example, Karnataka'
  },
  {
    field: 'occupation',
    engineLabel: 'occupation',
    question: 'What best describes your work?',
    supportingText: 'Choose the closest description for the work affected by the disaster.',
    inputType: 'choice',
    options: [
      { label: 'Daily-wage worker', value: 'worker' },
      { label: 'Self-employed', value: 'self_employed' },
      { label: 'Small business owner', value: 'business_owner' },
      { label: 'Salaried worker', value: 'employed' },
      { label: 'Farmer', value: 'farmer' },
      { label: 'Fisher', value: 'fisher' },
      { label: 'Unemployed', value: 'unemployed' },
      { label: 'Other', value: 'other' },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'farmerStatus',
    engineLabel: 'farmer status',
    question: 'Are you a farmer or cultivator of the affected crop?',
    supportingText: 'This includes tenant farmers and sharecroppers where applicable.',
    inputType: 'choice',
    options: [
      { label: 'Yes', value: 'farmer' },
      { label: 'No', value: 'not_farmer' },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'cropInsuranceStatus',
    engineLabel: 'crop insurance status',
    question: 'Was the affected crop insured under PMFBY?',
    supportingText: 'Choose Not sure if you do not know whether a policy was active.',
    inputType: 'choice',
    options: [
      { label: 'Yes', value: 'insured' },
      { label: 'No', value: 'not_insured' },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'cropNotifiedStatus',
    engineLabel: 'whether the crop is notified',
    question: 'Was the crop notified for the relevant area and season?',
    supportingText: 'Notification depends on the applicable state, area, crop, and season.',
    inputType: 'choice',
    options: [
      { label: 'Yes', value: 'notified' },
      { label: 'No', value: 'not_notified' },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'notifiedAreaStatus',
    engineLabel: 'whether the land is in a notified area or insurance unit',
    question: 'Was the affected land in a notified area or insurance unit?',
    supportingText: 'Use Not sure if you cannot confirm the notified unit for the incident.',
    inputType: 'choice',
    options: [
      { label: 'Yes', value: 'notified' },
      { label: 'No', value: 'not_notified' },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'coveredPerilStatus',
    engineLabel: 'whether the reported peril is covered',
    question: 'Do you know whether this loss is covered under the applicable PMFBY terms?',
    supportingText: 'Coverage depends on the notified risk and the applicable scheme terms.',
    inputType: 'choice',
    options: [
      { label: 'Yes', value: 'covered' },
      { label: 'No', value: 'not_covered' },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'houseDamageLevel',
    engineLabel: 'house damage level',
    question: 'How badly was the home damaged?',
    supportingText: 'Choose the closest description without sharing an exact address.',
    inputType: 'choice',
    options: [
      { label: 'None', value: 'none' },
      { label: 'Partial', value: 'partial' },
      { label: 'Severe', value: 'severe' },
      { label: 'Destroyed', value: 'destroyed' },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'displacedFromHome',
    engineLabel: 'displacement status',
    question: 'Were you displaced from your home?',
    supportingText: 'Do not enter an address; this is only about whether you had to leave home.',
    inputType: 'choice',
    options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'essentialHouseholdLoss',
    engineLabel: 'essential household loss',
    question: 'Were essential household items lost or damaged?',
    supportingText: 'Answer only about essential household loss caused by this disaster.',
    inputType: 'choice',
    options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'disasterRelatedInjury',
    engineLabel: 'disaster-related injury',
    question: 'Did anyone experience an injury related to this disaster?',
    supportingText: 'No medical or graphic details are needed here.',
    inputType: 'choice',
    options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'livelihoodLoss',
    engineLabel: 'livelihood loss',
    question: 'Was your livelihood interrupted by the disaster?',
    supportingText: 'This includes lost work, daily-wage disruption, or self-employment disruption.',
    inputType: 'choice',
    options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'businessDamage',
    engineLabel: 'business damage',
    question: 'Was your business or shop damaged by the disaster?',
    supportingText: 'No business registration or financial account details are needed.',
    inputType: 'choice',
    options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'dailyWageWorker',
    engineLabel: 'daily-wage work status',
    question: 'Are you a daily-wage worker?',
    supportingText: 'This helps describe the type of livelihood disruption.',
    inputType: 'choice',
    options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'fisherStatus',
    engineLabel: 'fisher status',
    question: 'Are you a fisher or fisheries worker?',
    supportingText: 'This is used only to route fisheries-related disaster information.',
    inputType: 'choice',
    options: [
      { label: 'Yes', value: 'fisher' },
      { label: 'Yes, fisheries worker', value: 'fisheries_worker' },
      { label: 'No', value: 'not_fisher' },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'agriculturalLandAffected',
    engineLabel: 'agricultural land affected',
    question: 'Was agricultural land or production affected?',
    supportingText: 'This helps separate agriculture relief from household or property relief.',
    inputType: 'choice',
    options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'housingSituation',
    engineLabel: 'housing situation',
    question: 'Which best describes your housing situation?',
    supportingText: 'No ownership documents or address are needed here.',
    inputType: 'choice',
    options: [
      { label: 'Own a pucca home', value: 'owns_pucca_home' },
      { label: 'Kutcha home', value: 'kutcha_home' },
      { label: 'Houseless', value: 'houseless' },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'hospitalizationRequired',
    engineLabel: 'whether hospitalization was required',
    question: 'Did the injury require hospitalization?',
    supportingText: 'No medical or graphic details are needed.',
    inputType: 'choice',
    options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'familyMemberDeath',
    engineLabel: 'affected family context',
    question: 'Are you checking support as a family member or nominee after a disaster-related death?',
    supportingText: 'Answer only Yes, No, or Not sure. No personal or medical details are needed.',
    inputType: 'choice',
    options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'unorganisedWorker',
    engineLabel: 'whether you do unorganised work',
    question: 'Do you work outside a formal employer or organised workplace?',
    supportingText: 'Daily-wage, casual, and many self-employed jobs may fit this description.',
    inputType: 'choice',
    options: [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'monthlyIncomeBand',
    engineLabel: 'monthly income band',
    question: 'What is your approximate monthly income band?',
    supportingText: 'Choose a broad range; do not enter exact income or financial-account details.',
    inputType: 'choice',
    options: [
      { label: 'Below Rs. 15,000', value: 'below_15000' },
      { label: 'Rs. 15,000–25,000', value: '15000_25000' },
      { label: 'Above Rs. 25,000', value: 'above_25000' },
      { label: 'Not sure', value: 'unknown' }
    ]
  },
  {
    field: 'mainIncomeSourceAffected',
    engineLabel: 'whether your main income source was affected',
    question: 'Was your main source of income affected by the disaster?',
    supportingText: 'Answer about the main work or business affected by this incident.',
    inputType: 'choice',
    options: [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
      { label: 'Not sure', value: 'unknown' }
    ]
  }
];

export const AssistanceQuestions: React.FC<AssistanceQuestionsProps> = ({
  profile,
  onChange,
  onContinue,
  onBack
}) => {
  const [renderedQuestionLabels, setRenderedQuestionLabels] = useState<readonly string[]>(() => {
    const candidateSchemes = getCandidateSchemes(profile);
    return getRequiredQuestions(candidateSchemes);
  });

  useEffect(() => {
    const candidateSchemes = getCandidateSchemes(profile);
    const newlyRequiredLabels = getRequiredQuestions(candidateSchemes);
    setRenderedQuestionLabels(previousLabels => {
      const labels = new Set(previousLabels);
      newlyRequiredLabels.forEach(label => labels.add(label));
      return QUESTION_DEFINITIONS
        .filter(question => labels.has(question.engineLabel))
        .map(question => question.engineLabel);
    });
  }, [profile]);

  const requiredQuestionLabels = new Set(renderedQuestionLabels);
  const questions = QUESTION_DEFINITIONS.filter(question =>
    requiredQuestionLabels.has(question.engineLabel)
  );

  const handleAnswer = (field: QuestionField, value: string | boolean | undefined) => {
    switch (field) {
      case 'state':
        if (typeof value === 'string') onChange({ ...profile, state: value });
        break;
      case 'occupation':
        if (value === 'worker' || value === 'self_employed' || value === 'business_owner' || value === 'employed' || value === 'farmer' || value === 'fisher' || value === 'unemployed' || value === 'other' || value === 'unknown') {
          onChange({ ...profile, occupation: value });
        }
        break;
      case 'farmerStatus':
        if (value === undefined || value === 'farmer' || value === 'not_farmer' || value === 'unknown') {
          onChange({ ...profile, farmerStatus: value });
        }
        break;
      case 'cropInsuranceStatus':
        if (value === undefined || value === 'insured' || value === 'not_insured' || value === 'unknown') {
          onChange({ ...profile, cropInsuranceStatus: value });
        }
        break;
      case 'cropNotifiedStatus':
        if (value === undefined || value === 'notified' || value === 'not_notified' || value === 'unknown') {
          onChange({ ...profile, cropNotifiedStatus: value });
        }
        break;
      case 'notifiedAreaStatus':
        if (value === undefined || value === 'notified' || value === 'not_notified' || value === 'unknown') {
          onChange({ ...profile, notifiedAreaStatus: value });
        }
        break;
      case 'coveredPerilStatus':
        if (value === undefined || value === 'covered' || value === 'not_covered' || value === 'unknown') {
          onChange({ ...profile, coveredPerilStatus: value });
        }
        break;
      case 'houseDamageLevel':
        if (value === 'none' || value === 'partial' || value === 'severe' || value === 'destroyed' || value === 'unknown') {
          onChange({ ...profile, houseDamageLevel: value });
        }
        break;
      case 'displacedFromHome':
        if (typeof value === 'boolean' || value === 'unknown') onChange({ ...profile, displacedFromHome: value });
        break;
      case 'essentialHouseholdLoss':
        if (typeof value === 'boolean' || value === 'unknown') onChange({ ...profile, essentialHouseholdLoss: value });
        break;
      case 'disasterRelatedInjury':
        if (typeof value === 'boolean' || value === 'unknown') onChange({ ...profile, disasterRelatedInjury: value });
        break;
      case 'livelihoodLoss':
        if (typeof value === 'boolean' || value === 'unknown') onChange({ ...profile, livelihoodLoss: value });
        break;
      case 'businessDamage':
        if (typeof value === 'boolean' || value === 'unknown') onChange({ ...profile, businessDamage: value });
        break;
      case 'dailyWageWorker':
        if (typeof value === 'boolean' || value === 'unknown') onChange({ ...profile, dailyWageWorker: value });
        break;
      case 'fisherStatus':
        if (value === 'fisher' || value === 'fisheries_worker' || value === 'not_fisher' || value === 'unknown') {
          onChange({ ...profile, fisherStatus: value });
        }
        break;
      case 'agriculturalLandAffected':
        if (typeof value === 'boolean' || value === 'unknown') onChange({ ...profile, agriculturalLandAffected: value });
        break;
      case 'residenceType':
        if (value === 'urban' || value === 'rural' || value === 'unknown') onChange({ ...profile, residenceType: value });
        break;
      case 'housingSituation':
        if (value === 'owns_pucca_home' || value === 'kutcha_home' || value === 'houseless' || value === 'unknown') onChange({ ...profile, housingSituation: value });
        break;
      case 'hospitalizationRequired':
        if (typeof value === 'boolean' || value === 'unknown') onChange({ ...profile, hospitalizationRequired: value });
        break;
      case 'familyMemberDeath':
        if (typeof value === 'boolean' || value === 'unknown') onChange({ ...profile, familyMemberDeath: value });
        break;
      case 'ageBand':
        if (value === '18_40' || value === '41_59' || value === '60_plus' || value === 'unknown') onChange({ ...profile, ageBand: value });
        break;
      case 'unorganisedWorker':
        if (value === 'yes' || value === 'no' || value === 'unknown') onChange({ ...profile, unorganisedWorker: value });
        break;
      case 'monthlyIncomeBand':
        if (value === 'below_15000' || value === '15000_25000' || value === 'above_25000' || value === 'unknown') onChange({ ...profile, monthlyIncomeBand: value });
        break;
      case 'mainIncomeSourceAffected':
        if (value === 'yes' || value === 'no' || value === 'unknown') onChange({ ...profile, mainIncomeSourceAffected: value });
        break;
    }
  };

  return (
    <section
      id="assistance-questions"
      className="relative overflow-hidden rounded-3xl border-2 border-[#B45309]/25 bg-gradient-to-br from-[#FFFDF9] via-[#FCF9F3] to-[#F7EFE1] p-5 shadow-[0_8px_40px_rgba(46,40,35,0.07)] sm:p-8"
    >
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl" />
      <div className="relative">
        <div className="mb-6 flex items-start gap-3 border-b border-[#E5DCCF]/70 pb-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-[#B45309] text-white shadow-md shadow-amber-500/20">
            <span className="material-symbols-outlined text-[25px]">fact_check</span>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#B45309]">Assistance Finder</p>
            <h2 className="mt-1 text-[24px] font-bold leading-tight tracking-tight text-[#1C1814] sm:text-[28px]">
              Tell us a little more
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[#6E645A] sm:text-[14px]">
              We only ask questions needed to check relevant assistance programs.
            </p>
          </div>
        </div>

        {questions.length > 0 ? (
          <div className="space-y-5">
            {questions.map(question => (
              <fieldset key={question.field} className="rounded-2xl border border-[#E5DCCF] bg-white/75 p-4 sm:p-5">
                <legend className="max-w-full px-1 text-[15px] font-bold leading-snug text-[#1C1814] sm:text-[16px]">
                  {question.question}
                </legend>
                <p className="mt-1 text-[12px] leading-relaxed text-[#6E645A]">{question.supportingText}</p>
                {question.inputType === 'text' ? (
                  <input
                    type="text"
                    value={typeof profile[question.field] === 'string' ? profile[question.field] as string : ''}
                    onChange={event => handleAnswer(question.field, event.target.value)}
                    placeholder={question.placeholder}
                    className="mt-4 w-full rounded-2xl border-2 border-[#E5DCCF] bg-[#FFFDF9] px-4 py-3 text-[13px] text-[#1C1814] outline-none transition focus:border-[#B45309] focus:ring-4 focus:ring-[#B45309]/15"
                  />
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {question.options?.map(option => {
                      const isSelected = profile[question.field] === option.value;
                      return (
                        <button
                          key={option.label}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => handleAnswer(question.field, option.value)}
                          className={`rounded-2xl border px-2 py-3 text-[12px] font-semibold transition active:scale-[0.98] sm:px-4 sm:text-[13px] ${
                            isSelected
                              ? 'border-[#B45309] bg-amber-100 text-[#7C2D12] shadow-sm ring-2 ring-[#B45309]/15'
                              : 'border-[#E5DCCF] bg-[#FFFDF9] text-[#6E645A] hover:border-[#D97706] hover:bg-amber-50 hover:text-[#1C1814]'
                          }`}
                        >
                          <span className="inline-flex items-center justify-center gap-1.5">
                            {isSelected && <span className="material-symbols-outlined text-[16px]">check</span>}
                            {option.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </fieldset>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-4 text-[13px] leading-relaxed text-emerald-800">
            We have enough information to move to the initial assessment.
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[#E5DCCF]/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#E5DCCF] bg-white px-5 py-3 text-[13px] font-semibold text-[#6E645A] transition hover:bg-[#F5F0E8] hover:text-[#1C1814]"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back
            </button>
          ) : <span />}
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D97706] px-5 py-3 text-[13px] font-bold text-white shadow-md shadow-amber-600/20 transition hover:bg-[#B45309] active:scale-[0.98]"
          >
            Continue to assessment
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </section>
  );
};
