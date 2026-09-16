import React from 'react';
import { EXPLORE_SECTIONS } from '../data/mockWeatherData';
import { ExploreCard } from './ExploreCard';
import { NavTab } from '../types';

interface ExploreSectionProps {
  onNavigate: (route: NavTab) => void;
}

export const ExploreSection: React.FC<ExploreSectionProps> = ({ onNavigate }) => {
  return (
    <section id="explore-specialized-weather-section" className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[20px] sm:text-[22px] font-bold text-[#1C1814]">
            Specialized Weather &amp; Disaster Intelligence
          </h3>
          <p className="text-[13px] text-[#6E645A]">
            Dedicated synoptic tools for disaster resilience and commute forecasting
          </p>
        </div>
        <span className="hidden sm:inline-block text-[11px] uppercase font-bold text-[#B45309] bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
          SIH Prototype Architecture
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {EXPLORE_SECTIONS.map((item) => (
          <ExploreCard
            key={item.id}
            id={item.id}
            title={item.title}
            description={item.description}
            icon={item.icon}
            badge={item.badge}
            badgeColor={item.badgeColor}
            accentColor={item.accentColor}
            route={item.route}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  );
};
