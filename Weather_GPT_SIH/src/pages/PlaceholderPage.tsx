import React from 'react';
import { NavTab, LocationData } from '../types';
import { ACTIVE_ALERT } from '../data/mockWeatherData';

interface PlaceholderPageProps {
  tab: NavTab;
  onBackToHome: () => void;
  location: LocationData;
  onOpenAlertModal: () => void;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  tab,
  onBackToHome,
  location,
  onOpenAlertModal
}) => {
  const getTabDetails = () => {
    switch (tab) {
      case 'forecast':
        return {
          title: 'Extended Forecast Intelligence',
          subtitle: `7-day and 14-day synoptic projections for ${location.name} (${location.state})`,
          icon: 'calendar_month',
          tag: 'Synoptic Models',
          content: (
            <div className="space-y-6">
              <div className="p-6 rounded-3xl bg-white border border-[#E5DCCF]/70 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-[16px] text-[#1C1814]">
                    7-Day Precipitation &amp; Temperature Trajectory
                  </h4>
                  <span className="text-[11px] font-semibold text-[#B45309] bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    Probabilistic Projection
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  {[
                    { day: 'Today', temp: '31° / 21°', cond: 'Partly Cloudy', rain: '70%', icon: 'thunderstorm' },
                    { day: 'Tue', temp: '29° / 20°', cond: 'Scattered Rain', rain: '65%', icon: 'rainy' },
                    { day: 'Wed', temp: '30° / 21°', cond: 'Light Showers', rain: '40%', icon: 'weather_mix' },
                    { day: 'Thu', temp: '32° / 22°', cond: 'Partly Cloudy', rain: '20%', icon: 'partly_cloudy_day' },
                    { day: 'Fri', temp: '31° / 21°', cond: 'Overcast', rain: '30%', icon: 'cloud' },
                    { day: 'Sat', temp: '28° / 20°', cond: 'Heavy Rain', rain: '80%', icon: 'rainy_heavy' },
                    { day: 'Sun', temp: '29° / 21°', cond: 'Showers', rain: '50%', icon: 'rainy' },
                  ].map((d, i) => (
                    <div key={i} className="p-3.5 rounded-2xl bg-[#F5F0E8] border border-[#E5DCCF]/60 text-center flex flex-col items-center justify-between space-y-2">
                      <span className="text-[12px] font-bold text-[#1C1814]">{d.day}</span>
                      <span className="material-symbols-outlined text-[28px] text-amber-500">{d.icon}</span>
                      <span className="text-[13px] font-semibold text-[#1C1814]">{d.temp}</span>
                      <span className="text-[11px] font-bold text-[#B45309]">{d.rain} rain</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-[#FFFDF9] border border-[#E5DCCF]/60 text-[13px] text-[#6E645A] flex items-center justify-between">
                <span>Weather data source will be connected in future iterations.</span>
                <span className="font-semibold text-[#B45309]">Demo Forecast View</span>
              </div>
            </div>
          )
        };
      case 'alerts':
        return {
          title: 'Active Severe Weather & Flood Alerts',
          subtitle: `District and state disaster management bulletins for ${location.state}`,
          icon: 'warning',
          tag: 'Civil Protection',
          content: (
            <div className="space-y-6">
              <div className="p-6 rounded-3xl bg-white border border-[#E5DCCF]/70 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#EA580C] text-[22px]">warning</span>
                    <h4 className="font-bold text-[16px] text-[#1C1814]">
                      {ACTIVE_ALERT.title}
                    </h4>
                  </div>
                  <span className="text-[11px] font-bold text-[#EA580C] bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200">
                    Active Advisory
                  </span>
                </div>
                <p className="text-[14px] text-[#6E645A]">
                  {ACTIVE_ALERT.description}
                </p>
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/70">
                  <h5 className="text-[12px] uppercase font-bold text-[#B45309] tracking-wider mb-2">
                    Critical Commute Corridors
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ACTIVE_ALERT.affectedCorridors.map((c, i) => (
                      <div key={i} className="text-[13px] font-medium text-[#1C1814] flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#EA580C]" />
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenAlertModal}
                  className="px-5 py-2.5 rounded-full bg-[#D97706] hover:bg-[#B45309] text-white font-semibold text-[13px] transition-colors"
                >
                  View Route Precautions &amp; Evacuation Guidelines
                </button>
              </div>
            </div>
          )
        };
      case 'weather-map':
        return {
          title: 'Interactive Precipitation & Synoptic Weather Map',
          subtitle: 'Synoptic grid reflectivity, cloud albedo, and wind streamlines',
          icon: 'map',
          tag: 'Spatial Telemetry',
          content: (
            <div className="space-y-6">
              <div className="relative rounded-3xl overflow-hidden border border-[#E5DCCF] shadow-sm bg-[#131315] aspect-[16/9] max-h-[440px] flex items-center justify-center text-center p-6">
                {/* Simulated Radar Canvas Graphic */}
                <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#3B82F6_1px,transparent_1px)] [background-size:24px_24px]" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-72 h-72 rounded-full border border-emerald-500/30 animate-ping opacity-25" style={{ animationDuration: '4s' }} />
                  <div className="w-96 h-96 rounded-full border border-blue-500/20" />
                  <div className="w-48 h-48 rounded-full border border-amber-500/30" />
                </div>
                <div className="relative z-10 max-w-md space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 shadow-lg">
                    <span className="material-symbols-outlined text-[32px]">satellite_alt</span>
                  </div>
                  <h4 className="text-[20px] font-bold text-white">
                    Indian Regional Synoptic Grid Projection
                  </h4>
                  <p className="text-[13px] text-gray-300">
                    Station coverage for {location.name} (12.97° N, 77.59° E). Map engine integration prepared for Leaflet / Google Maps Platform layers.
                  </p>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-[12px] border border-white/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Demo Radar Sweep: Active</span>
                  </div>
                </div>
              </div>
            </div>
          )
        };
      case 'safety':
        return {
          title: 'Disaster Management & Civil Safety Hub',
          subtitle: 'Emergency mitigation checklists, district helpline directories, and flood evasion protocols',
          icon: 'health_and_safety',
          tag: 'Civil Defense',
          content: (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-3xl bg-white border border-[#E5DCCF]/70 shadow-sm space-y-2">
                  <span className="material-symbols-outlined text-[#EA580C] text-[24px]">phone_in_talk</span>
                  <h5 className="font-bold text-[15px] text-[#1C1814]">Disaster Helplines</h5>
                  <p className="text-[12px] text-[#6E645A]">State Disaster Response: 1070</p>
                  <p className="text-[12px] text-[#6E645A]">National Emergency Number: 112</p>
                  <p className="text-[12px] text-[#6E645A]">Local Municipal Control: 1533</p>
                </div>
                <div className="p-5 rounded-3xl bg-white border border-[#E5DCCF]/70 shadow-sm space-y-2">
                  <span className="material-symbols-outlined text-blue-600 text-[24px]">water</span>
                  <h5 className="font-bold text-[15px] text-[#1C1814]">Urban Flood Evasion</h5>
                  <p className="text-[12px] text-[#6E645A]">Never drive or walk through moving water.</p>
                  <p className="text-[12px] text-[#6E645A]">6 inches of moving water can knock you down.</p>
                  <p className="text-[12px] text-[#6E645A]">Elevate home electronics in low-lying corridors.</p>
                </div>
                <div className="p-5 rounded-3xl bg-white border border-[#E5DCCF]/70 shadow-sm space-y-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[24px]">medical_services</span>
                  <h5 className="font-bold text-[15px] text-[#1C1814]">Emergency Kit Checklist</h5>
                  <p className="text-[12px] text-[#6E645A]">Waterproof flashlight &amp; extra batteries.</p>
                  <p className="text-[12px] text-[#6E645A]">3-day drinking water ration (3L/person/day).</p>
                  <p className="text-[12px] text-[#6E645A]">Personal prescription medicines &amp; first aid kit.</p>
                </div>
              </div>
            </div>
          )
        };
      default:
        return {
          title: 'WeatherGPT View',
          subtitle: 'Specialized meteorological intelligence module',
          icon: 'cloud',
          tag: 'Overview',
          content: null
        };
    }
  };

  const details = getTabDetails();

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#FFFDF9] via-[#FAF6EE] to-[#F5ECE0] border border-[#E5DCCF]/70 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#D97706] text-white flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-[28px]">{details.icon}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[22px] sm:text-[26px] font-bold text-[#1C1814]">{details.title}</h2>
              <span className="text-[11px] font-bold uppercase text-[#B45309] bg-amber-100 px-2.5 py-0.5 rounded-full">
                {details.tag}
              </span>
            </div>
            <p className="text-[13px] sm:text-[14px] text-[#6E645A] mt-0.5">{details.subtitle}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBackToHome}
          className="self-start sm:self-auto px-5 py-2.5 rounded-full bg-white hover:bg-[#F5F0E8] text-[#1C1814] border border-[#E5DCCF] font-semibold text-[13px] shadow-sm transition-all flex items-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back to Live Home</span>
        </button>
      </div>

      {/* Main Tab Content */}
      {details.content}
    </div>
  );
};
