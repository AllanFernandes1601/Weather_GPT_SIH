import React from 'react';
import { NavTab } from '../types';

interface ExploreCardProps {
  id: string;
  title: string;
  description: string;
  icon: string;
  badge: string;
  badgeColor: string;
  accentColor: string;
  route: NavTab;
  onNavigate: (route: NavTab) => void;
}

export const ExploreCard: React.FC<ExploreCardProps> = ({
  title,
  description,
  icon,
  badge,
  badgeColor,
  accentColor,
  route,
  onNavigate
}) => {
  return (
    <div
      onClick={() => onNavigate(route)}
      className="interactive-card group p-5 sm:p-6 rounded-3xl bg-[#FFFDF9] border border-[#E5DCCF]/70 shadow-sm flex flex-col justify-between space-y-4 cursor-pointer hover:border-[#B45309] transition-all"
    >
      <div className="flex items-center justify-between">
        <div className={`w-12 h-12 rounded-2xl bg-[#F5F0E8] group-hover:bg-amber-100 flex items-center justify-center transition-colors ${accentColor}`}>
          <span className="material-symbols-outlined text-[26px]">
            {icon}
          </span>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeColor}`}>
          {badge}
        </span>
      </div>

      <div>
        <h4 className="text-[17px] sm:text-[18px] font-bold text-[#1C1814] group-hover:text-[#B45309] transition-colors leading-snug">
          {title}
        </h4>
        <p className="text-[13px] text-[#6E645A] mt-1 leading-relaxed">
          {description}
        </p>
      </div>

      <div className="pt-2 border-t border-[#E5DCCF]/50 flex items-center justify-between">
        <span className="text-[12px] font-bold text-[#B45309]">
          Explore Module
        </span>
        <span className="material-symbols-outlined text-[#B45309] text-[18px] group-hover:translate-x-1 transition-transform">
          arrow_forward
        </span>
      </div>
    </div>
  );
};
