import { HourlyForecast } from '../components/HourlyForecast';
import { ForecastAnalytics } from '../components/ForecastAnalytics';
import { HourlyForecastItem, LocationData } from '../types';

interface ForecastPageProps {
  location: LocationData;
  hourlyForecast: HourlyForecastItem[];
  onBackToHome: () => void;
}

export function ForecastPage({ location, hourlyForecast, onBackToHome }: ForecastPageProps) {
  return (
    <div className="space-y-7 pb-8">
      <header className="rounded-3xl border border-[#E5DCCF]/70 bg-gradient-to-br from-[#FFFDF9] to-[#F7F1E8] p-6 sm:p-8">
        <button type="button" onClick={onBackToHome} className="mb-5 inline-flex items-center gap-1 text-[12px] font-bold text-[#B45309] hover:underline">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span> Home
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B45309]">Forecast intelligence</p>
            <h1 className="mt-2 text-[30px] font-bold tracking-tight text-[#1C1814] sm:text-[38px]">{location.name} forecast</h1>
            <p className="mt-2 text-[14px] text-[#6E645A]">Live hourly weather from Open-Meteo. Experimental ML probabilities are hidden until they are calibrated and validated.</p>
          </div>
          <span className="w-fit rounded-full border border-[#E5DCCF] bg-[#FFFDF9] px-3 py-1.5 text-[11px] font-semibold text-[#6E645A]">
            {location.isLive ? 'Live Open-Meteo inputs' : 'Offline fallback inputs'}
          </span>
        </div>
      </header>

      <HourlyForecast forecastItems={hourlyForecast} isLive={location.isLive} />
      <ForecastAnalytics location={location} forecast={hourlyForecast} />

      <section className="rounded-2xl border border-[#E5DCCF]/70 bg-[#FFFDF9] px-5 py-4 text-[11px] leading-5 text-[#6E645A]">
        <strong className="text-[#1C1814]">Prediction quality gate:</strong> experimental ML probabilities remain hidden until calibrated. The information above comes directly from the live forecast API; a future flood prediction will require a separately validated flood-outcome model.
      </section>
    </div>
  );
}
