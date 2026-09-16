import React, { useState } from 'react';
import { AssistanceUserProfile } from '../types';
import { DisasterIncidentForm } from './DisasterIncidentForm';
import { AssistanceQuestions } from './AssistanceQuestions';
import { AssistanceResults } from './AssistanceResults';

type AssistanceStep = 1 | 2 | 3;

const STEPS: readonly { id: AssistanceStep; label: string }[] = [
  { id: 1, label: 'Incident' },
  { id: 2, label: 'Details' },
  { id: 3, label: 'Assistance' }
];

export const SafetyHub: React.FC = () => {
  const [profile, setProfile] = useState<AssistanceUserProfile>({});
  const [currentStep, setCurrentStep] = useState<AssistanceStep>(1);
  const [hasSubmittedIncident, setHasSubmittedIncident] = useState(false);

  const startOver = () => {
    setProfile({});
    setCurrentStep(1);
    setHasSubmittedIncident(false);
  };

  const changeIncident = () => {
    setProfile({});
    setCurrentStep(1);
    setHasSubmittedIncident(false);
  };

  const handleIncidentSubmit = (nextProfile: AssistanceUserProfile) => {
    setProfile(nextProfile);
    setHasSubmittedIncident(true);
    setCurrentStep(2);
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#B45309]">Emergency Help</p>
          <h3 className="mt-1 text-[19px] font-bold text-[#1C1814]">Get help during an emergency</h3>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2 rounded-3xl border border-[#E5DCCF]/70 bg-white p-5 shadow-sm">
            <span className="material-symbols-outlined text-[24px] text-[#EA580C]">phone_in_talk</span>
            <h4 className="font-bold text-[15px] text-[#1C1814]">Disaster Helplines</h4>
            <p className="text-[12px] text-[#6E645A]">State Disaster Response: 1070</p>
            <p className="text-[12px] text-[#6E645A]">National Emergency Number: 112</p>
            <p className="text-[12px] text-[#6E645A]">Local Municipal Control: 1533</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#B45309]">Safety Guidance</p>
          <h3 className="mt-1 text-[19px] font-bold text-[#1C1814]">Prepare for common emergencies</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-3xl border border-[#E5DCCF]/70 bg-white p-5 shadow-sm">
            <span className="material-symbols-outlined text-[24px] text-blue-600">water</span>
            <h4 className="font-bold text-[15px] text-[#1C1814]">Urban Flood Evasion</h4>
            <p className="text-[12px] text-[#6E645A]">Never drive or walk through moving water.</p>
            <p className="text-[12px] text-[#6E645A]">6 inches of moving water can knock you down.</p>
            <p className="text-[12px] text-[#6E645A]">Elevate home electronics in low-lying corridors.</p>
          </div>
          <div className="space-y-2 rounded-3xl border border-[#E5DCCF]/70 bg-white p-5 shadow-sm">
            <span className="material-symbols-outlined text-[24px] text-emerald-600">medical_services</span>
            <h4 className="font-bold text-[15px] text-[#1C1814]">Emergency Kit Checklist</h4>
            <p className="text-[12px] text-[#6E645A]">Waterproof flashlight &amp; extra batteries.</p>
            <p className="text-[12px] text-[#6E645A]">3-day drinking water ration (3L/person/day).</p>
            <p className="text-[12px] text-[#6E645A]">Personal prescription medicines &amp; first aid kit.</p>
          </div>
        </div>
      </section>

      <section className="space-y-5 rounded-3xl border border-[#E5DCCF]/70 bg-[#FFFDF9] p-5 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 border-b border-[#E5DCCF]/70 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#B45309]">Government Assistance</p>
            <h3 className="mt-1 text-[22px] font-bold tracking-tight text-[#1C1814]">Find relevant assistance programs</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-[#6E645A]">Describe the incident first. We will ask only the follow-up questions needed by the stored scheme rules.</p>
          </div>
          {(hasSubmittedIncident || currentStep > 1) && (
            <button
              type="button"
              onClick={startOver}
              className="inline-flex items-center justify-center gap-2 self-start rounded-2xl border border-[#E5DCCF] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#6E645A] transition hover:bg-[#F5F0E8] hover:text-[#1C1814]"
            >
              <span className="material-symbols-outlined text-[17px]">restart_alt</span>
              Start over
            </button>
          )}
        </div>

        <nav aria-label="Assistance finder progress" className="grid grid-cols-3 gap-2">
          {STEPS.map(step => {
            const isCurrent = currentStep === step.id;
            const isComplete = currentStep > step.id;
            return (
              <div
                key={step.id}
                className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-[12px] font-bold transition sm:px-4 ${
                  isCurrent
                    ? 'border-[#B45309] bg-amber-100 text-[#7C2D12] ring-2 ring-[#B45309]/15'
                    : isComplete
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-[#E5DCCF] bg-[#F5F0E8] text-[#8E9197]'
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-[11px]">{isComplete ? '✓' : step.id}</span>
                <span>{step.label}</span>
                {isCurrent && <span className="hidden font-normal sm:inline">Current step</span>}
              </div>
            );
          })}
        </nav>

        {currentStep === 1 && (
          <DisasterIncidentForm onSubmit={handleIncidentSubmit} initialProfile={profile} />
        )}

        {currentStep === 2 && (
          <AssistanceQuestions
            profile={profile}
            onChange={setProfile}
            onBack={() => setCurrentStep(1)}
            onContinue={() => setCurrentStep(3)}
          />
        )}

        {currentStep === 3 && (
          <AssistanceResults
            profile={profile}
            onBack={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 1 && hasSubmittedIncident && (
          <button
            type="button"
            onClick={changeIncident}
            className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#6E645A] hover:text-[#1C1814]"
          >
            <span className="material-symbols-outlined text-[17px]">edit</span>
            Change incident
          </button>
        )}
      </section>
    </div>
  );
};
