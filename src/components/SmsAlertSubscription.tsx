import React, { useState } from 'react';
import { LocationData } from '../types';
import { createSmsSubscription, PublicSmsSubscription } from '../services/smsService';

interface SmsAlertSubscriptionProps {
  activeLocation: LocationData;
  onOpenLocationModal?: () => void;
}

interface AlertCategoryOption {
  id: string;
  label: string;
  icon: string;
  description: string;
}

const ALERT_CATEGORIES: AlertCategoryOption[] = [
  { id: 'heavy_rain', label: 'Heavy Rain', icon: 'rainy', description: 'Intense downpours (>35mm/h) & extreme rain' },
  { id: 'flood', label: 'Flood Risk', icon: 'flood', description: 'Urban waterlogging & rising river stages' },
  { id: 'thunderstorm', label: 'Thunderstorm', icon: 'thunderstorm', description: 'Severe convective storms & lightning' },
  { id: 'strong_wind', label: 'Strong Wind', icon: 'air', description: 'Damaging gusts (>60km/h) & gales' },
  { id: 'extreme_heat', label: 'Extreme Heat', icon: 'sunny', description: 'Dangerous heatwave conditions (>40°C)' },
  { id: 'extreme_cold', label: 'Extreme Cold', icon: 'ac_unit', description: 'Severe cold-wave & freezing drops' },
  { id: 'air_quality', label: 'Air Quality', icon: 'airwave', description: 'Hazardous / severe particulate spikes' }
];

const LANGUAGE_OPTIONS: { code: 'en' | 'hi' | 'kn'; label: string; nativeName: string }[] = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'hi', label: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'kn', label: 'Kannada', nativeName: 'ಕನ್ನಡ' }
];

export const SmsAlertSubscription: React.FC<SmsAlertSubscriptionProps> = ({
  activeLocation,
  onOpenLocationModal
}) => {
  const [phoneLocalDigits, setPhoneLocalDigits] = useState('');
  const [selectedAlertTypes, setSelectedAlertTypes] = useState<string[]>([
    'heavy_rain',
    'flood',
    'thunderstorm',
    'strong_wind'
  ]);
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'hi' | 'kn'>('en');
  const [hasConsented, setHasConsented] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [subscribedRecord, setSubscribedRecord] = useState<PublicSmsSubscription | null>(null);

  // Toggle alert category selection
  const handleToggleCategory = (catId: string) => {
    setSelectedAlertTypes((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  // Validate E.164 phone format (+[country code][number], 7 to 15 digits total)
  const isValidE164 = (phone: string): boolean => {
    return /^\+[1-9]\d{6,14}$/.test(phone.trim());
  };

  const getLocalPhoneDigits = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    return digits.startsWith('91') && digits.length > 10 ? digits.slice(2, 12) : digits.slice(0, 10);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setApiError(null);

    // 1. Phone number validation
    const phoneNumber = `+91${phoneLocalDigits}`;
    if (phoneLocalDigits.length !== 10) {
      setValidationError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!isValidE164(phoneNumber)) {
      setValidationError(
        'Please enter a valid mobile number in international E.164 format (e.g. +919876543210).'
      );
      return;
    }

    // 2. Alert category validation
    if (selectedAlertTypes.length === 0) {
      setValidationError('Please select at least one alert category to receive.');
      return;
    }

    // 3. Location validation
    const lat = activeLocation.latitude ?? 12.9716;
    const lon = activeLocation.longitude ?? 77.5946;

    // 4. Consent validation
    if (!hasConsented) {
      setValidationError('You must agree to receive weather alerts to subscribe.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await createSmsSubscription({
        phoneNumber,
        location: {
          name: activeLocation.name || 'Bengaluru',
          state: activeLocation.state,
          latitude: lat,
          longitude: lon,
          radiusKm: 25
        },
        alertTypes: selectedAlertTypes,
        minSeverity: 'high',
        preferredLanguage
      });

      setPhoneLocalDigits('');
      setSubscribedRecord(response.subscription);
    } catch (err: any) {
      setApiError(err?.message || 'Failed to register SMS subscription. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSubscribedRecord(null);
    setValidationError(null);
    setApiError(null);
    setPhoneLocalDigits('');
    setHasConsented(false);
  };

  return (
    <section
      id="sms-weather-alert-section"
      className="rounded-3xl bg-[#FFFDF9] p-6 sm:p-8 shadow-sm border border-[#E5DCCF]/80 relative overflow-hidden transition-all duration-300 hover:shadow-md"
    >
      {/* Decorative top accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-[#EA580C] to-amber-600" />

      {/* SUCCESS STATE */}
      {subscribedRecord ? (
        <div id="sms-subscription-success" className="space-y-6 py-2">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[28px]">check_circle</span>
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-[20px] font-bold text-[#1C1814]">SMS alerts enabled</h3>
              <p className="text-[14px] text-[#6E645A]">
                You are subscribed for high-priority weather alerts in{' '}
                <strong className="text-[#1C1814] font-semibold">
                  {subscribedRecord.location.name || activeLocation.name}
                </strong>
                .
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F5F0E8] border border-[#E5DCCF]/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#B45309] text-[20px]">smartphone</span>
              <span className="text-[13px] text-[#6E645A]">
                Phone: <strong className="font-mono text-[14px] text-[#1C1814]">{subscribedRecord.phoneMasked}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#B45309] bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-200">
                Min Severity: {subscribedRecord.minSeverity.toUpperCase()}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E645A] bg-[#E8DEC8] px-2.5 py-0.5 rounded-full">
                Lang: {subscribedRecord.preferredLanguage.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Verification Notice */}
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-3">
            <span className="material-symbols-outlined text-[#B45309] text-[22px] shrink-0 mt-0.5">
              info
            </span>
            <div className="text-[13px] text-[#7C2D12] leading-relaxed">
              <p className="font-semibold text-[13px]">Subscription saved.</p>
              <p className="mt-0.5">
                Phone verification will be required before live automatic SMS alerts are activated.
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-start">
            <button
              id="subscribe-another-btn"
              type="button"
              onClick={handleReset}
              className="px-5 py-2.5 rounded-full bg-[#F5F0E8] hover:bg-[#E8DEC8] text-[#1C1814] border border-[#E5DCCF] text-[13px] font-semibold transition-all flex items-center gap-2 shadow-sm cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Subscribe another number</span>
            </button>
          </div>
        </div>
      ) : (
        /* SUBSCRIPTION FORM */
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E5DCCF]/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-[#B45309] text-white flex items-center justify-center shadow-md shadow-amber-500/15">
                <span className="material-symbols-outlined text-[22px]">sms</span>
              </div>
              <div>
                <h3 className="text-[18px] sm:text-[20px] font-bold text-[#1C1814] leading-snug">
                  SMS Weather Alerts
                </h3>
                <p className="text-[13px] text-[#6E645A]">
                  Receive emergency warnings directly on your phone — no internet or app required.
                </p>
              </div>
            </div>

            {/* Location Pill */}
            <div className="flex items-center gap-2 self-start sm:self-center">
              <div className="px-3.5 py-1.5 rounded-full bg-[#F5F0E8] border border-[#E5DCCF] flex items-center gap-2 text-[12px] text-[#1C1814]">
                <span className="material-symbols-outlined text-[16px] text-[#B45309]">location_on</span>
                <span className="font-semibold">{activeLocation.name}</span>
                {activeLocation.latitude !== undefined && activeLocation.longitude !== undefined && (
                  <span className="text-[11px] text-[#6E645A] font-mono">
                    ({activeLocation.latitude.toFixed(2)}°, {activeLocation.longitude.toFixed(2)}°)
                  </span>
                )}
              </div>
              {onOpenLocationModal && (
                <button
                  type="button"
                  onClick={onOpenLocationModal}
                  className="text-[12px] font-semibold text-[#B45309] hover:underline px-1 py-0.5"
                >
                  Change
                </button>
              )}
            </div>
          </div>

          {/* Validation or API Error Banner */}
          {(validationError || apiError) && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-[13px] text-red-700 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
              <span className="flex-1">{validationError || apiError}</span>
            </div>
          )}

          {/* Inputs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Mobile Number Field */}
            <div className="space-y-1.5">
              <label htmlFor="sms-phone-input" className="block text-[13px] font-bold text-[#1C1814]">
                Mobile number <span className="text-[#EA580C]">*</span>
              </label>
              <div className="relative flex items-center rounded-2xl bg-white border border-[#E5DCCF] focus-within:ring-2 focus-within:ring-amber-500/30 focus-within:border-amber-500 transition-all shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#6E645A] select-none">
                  <span className="material-symbols-outlined text-[18px]">phone</span>
                </div>
                <span className="pl-10 pr-2.5 text-[14px] text-[#1C1814] font-mono select-none" aria-hidden="true">
                  +91
                </span>
                <span className="mx-1 text-[11px] text-[#C7BBAA] select-none" aria-hidden="true">•</span>
                <input
                  id="sms-phone-input"
                  type="tel"
                  inputMode="numeric"
                  value={phoneLocalDigits}
                  onChange={(e) => {
                    setPhoneLocalDigits(getLocalPhoneDigits(e.target.value));
                    if (validationError) setValidationError(null);
                  }}
                  className="min-w-0 flex-1 cursor-text caret-auto pr-4 py-2.5 bg-transparent text-[14px] text-[#1C1814] placeholder-[#8E9197] font-mono focus:outline-none"
                  autoComplete="tel"
                />
              </div>
              <p className="text-[11px] text-[#6E645A]">
                Enter the 10-digit number after <span className="font-mono text-[#1C1814]">+91</span> (e.g. <span className="font-mono text-[#1C1814]">+91 9876543210</span>).
              </p>
            </div>

            {/* Preferred Language Field */}
            <div className="space-y-1.5">
              <label htmlFor="sms-lang-select" className="block text-[13px] font-bold text-[#1C1814]">
                Preferred language
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6E645A]">
                  <span className="material-symbols-outlined text-[18px]">translate</span>
                </div>
                <select
                  id="sms-lang-select"
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value as 'en' | 'hi' | 'kn')}
                  className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-white border border-[#E5DCCF] text-[14px] text-[#1C1814] appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all shadow-sm cursor-pointer"
                >
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label} ({lang.nativeName})
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#6E645A]">
                  <span className="material-symbols-outlined text-[18px]">expand_more</span>
                </div>
              </div>
              <p className="text-[11px] text-[#6E645A]">
                Emergency warnings will be composed in your selected language.
              </p>
            </div>
          </div>

          {/* Alert Categories Selection */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-[13px] font-bold text-[#1C1814]">
                Alert categories <span className="text-[#EA580C]">*</span>
              </label>
              <span className="text-[11px] text-[#6E645A]">
                {selectedAlertTypes.length} selected (at least 1 required)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {ALERT_CATEGORIES.map((cat) => {
                const isSelected = selectedAlertTypes.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleToggleCategory(cat.id)}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 cursor-pointer select-none ${
                      isSelected
                        ? 'bg-amber-50/70 border-amber-300 text-[#1C1814] shadow-sm'
                        : 'bg-white border-[#E5DCCF]/70 text-[#6E645A] hover:bg-[#F5F0E8]/60 hover:border-[#E5DCCF]'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[20px] shrink-0 mt-0.5 ${
                        isSelected ? 'text-[#B45309]' : 'text-[#8E9197]'
                      }`}
                    >
                      {cat.icon}
                    </span>
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-[13px] font-bold truncate ${isSelected ? 'text-[#1C1814]' : 'text-[#6E645A]'}`}>
                          {cat.label}
                        </span>
                        <span
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'bg-[#B45309] border-[#B45309] text-white' : 'border-[#E5DCCF] bg-white'
                          }`}
                        >
                          {isSelected && <span className="material-symbols-outlined text-[11px]">check</span>}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6E645A] line-clamp-2 leading-tight">
                        {cat.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Consent Checkbox */}
          <div className="pt-2 border-t border-[#E5DCCF]/50">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                id="sms-consent-checkbox"
                type="checkbox"
                checked={hasConsented}
                onChange={(e) => {
                  setHasConsented(e.target.checked);
                  if (validationError) setValidationError(null);
                }}
                className="mt-1 w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <span className="text-[13px] text-[#1C1814] leading-relaxed">
                I agree to receive important WeatherGPT weather alerts by SMS at this number.
              </span>
            </label>
          </div>

          {/* Actions & Privacy Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <p className="text-[12px] text-[#8E9197] text-center sm:text-left flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-[#8E9197]">lock</span>
              <span>Your number is used only for weather-alert delivery and is not shown publicly.</span>
            </p>

            <button
              id="submit-sms-subscription-btn"
              type="submit"
              disabled={isLoading || !hasConsented || selectedAlertTypes.length === 0}
              className={`w-full sm:w-auto px-6 py-3 rounded-full text-[14px] font-bold text-white transition-all duration-200 flex items-center justify-center gap-2 shadow-sm ${
                isLoading || !hasConsented || selectedAlertTypes.length === 0
                  ? 'bg-gray-300 cursor-not-allowed opacity-75'
                  : 'bg-gradient-to-r from-amber-500 to-[#B45309] hover:from-amber-600 hover:to-[#92400E] active:scale-95 shadow-amber-500/20 cursor-pointer'
              }`}
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">notifications_active</span>
                  <span>Subscribe to SMS Alerts</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </section>
  );
};
