import React from 'react';
import { AssistanceUserProfile } from '../types';
import { getCandidateSchemes, getRequiredQuestions } from '../utils/disasterAssistanceEligibility';

interface AssistanceQuestionsProps {
  profile: AssistanceUserProfile;
  onChange: (profile: AssistanceUserProfile) => void;
  onContinue: () => void;
  onBack?: () => void;
}

type QuestionField =
  | 'farmerStatus'
  | 'cropInsuranceStatus'
  | 'cropNotifiedStatus'
  | 'notifiedAreaStatus'
  | 'coveredPerilStatus';

type QuestionOption = {
  label: string;
  value: string | boolean | undefined;
};

interface AssistanceQuestionDefinition {
  field: QuestionField;
  engineLabel: string;
  question: string;
  supportingText: string;
  options: readonly QuestionOption[];
}

const QUESTION_DEFINITIONS: readonly AssistanceQuestionDefinition[] = [
  {
    field: 'farmerStatus',
    engineLabel: 'farmer status',
    question: 'Are you a farmer or cultivator of the affected crop?',
    supportingText: 'This includes tenant farmers and sharecroppers where applicable.',
    options: [
      { label: 'Yes', value: 'farmer' },
      { label: 'No', value: 'not_farmer' },
      { label: 'Not sure', value: undefined }
    ]
  },
  {
    field: 'cropInsuranceStatus',
    engineLabel: 'crop insurance status',
    question: 'Was the affected crop insured under PMFBY?',
    supportingText: 'Choose Not sure if you do not know whether a policy was active.',
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
    options: [
      { label: 'Yes', value: 'covered' },
      { label: 'No', value: 'not_covered' },
      { label: 'Not sure', value: 'unknown' }
    ]
  }
];

function hasAnswer(profile: AssistanceUserProfile, field: QuestionField): boolean {
  return profile[field] !== undefined;
}

export const AssistanceQuestions: React.FC<AssistanceQuestionsProps> = ({
  profile,
  onChange,
  onContinue,
  onBack
}) => {
  const candidateSchemes = getCandidateSchemes(profile);
  const requiredLabels = new Set(getRequiredQuestions(candidateSchemes));
  const questions = QUESTION_DEFINITIONS.filter(question =>
    requiredLabels.has(question.engineLabel) && !hasAnswer(profile, question.field)
  );

  const handleAnswer = (field: QuestionField, value: string | boolean | undefined) => {
    switch (field) {
      case 'farmerStatus':
        if (value === undefined || value === 'farmer' || value === 'not_farmer') {
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
                <div className="mt-4 grid grid-cols-3 gap-2.5">
                  {question.options.map(option => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => handleAnswer(question.field, option.value)}
                      className="rounded-2xl border border-[#E5DCCF] bg-[#FFFDF9] px-2 py-3 text-[12px] font-semibold text-[#6E645A] transition hover:border-[#D97706] hover:bg-amber-50 hover:text-[#1C1814] active:scale-[0.98] sm:px-4 sm:text-[13px]"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
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
