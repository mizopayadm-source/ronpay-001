import React from 'react';
import { 
  Home, 
  Users, 
  QrCode, 
  FileText, 
  User
} from 'lucide-react';
import { ScreenId } from '../types';

interface BottomNavProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  onOpenMemberRoll: (tab?: 'quick_entry' | 'register_member' | 'members_list' | 'print_reports') => void;
  onOpenProfile: () => void;
  isProfileOpen?: boolean;
  isKumtluangManagerOpen?: boolean;
  isDesktopView?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentScreen,
  onNavigate,
  onOpenMemberRoll,
  onOpenProfile,
  isProfileOpen = false,
  isKumtluangManagerOpen = false,
  isDesktopView = false,
}) => {
  const isHomeActive = currentScreen === 'home' && !isProfileOpen && !isKumtluangManagerOpen;
  const isRollActive = isKumtluangManagerOpen;
  const isStudioActive = (currentScreen === 'create_qr' || currentScreen === 'creator_reg') && !isProfileOpen && !isKumtluangManagerOpen;
  const isReportActive = currentScreen === 'reports' && !isProfileOpen && !isKumtluangManagerOpen;
  const isProfileActive = isProfileOpen;

  return (
    <nav 
      id="bottom-navigation-bar"
      aria-label="Bottom Navigation"
      className={`sticky bottom-0 left-0 right-0 z-40 w-full bg-white/90 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-2px_10px_rgba(0,0,0,0.03)] select-none shrink-0 ${
        isDesktopView ? 'max-w-md mx-auto rounded-t-2xl shadow-lg border-x' : ''
      }`}
    >
      <div className="w-full flex items-center justify-around h-14 px-2">
        {/* 1. Home */}
        <button
          id="nav-home-btn"
          type="button"
          onClick={() => onNavigate('home')}
          className="flex-1 flex flex-col items-center justify-center py-1 transition-all cursor-pointer focus:outline-none group rounded-lg hover:bg-slate-100/50"
        >
          <Home 
            className={`w-[20px] h-[20px] transition-colors ${
              isHomeActive 
                ? 'text-[#4338ca] stroke-[2.2]' 
                : 'text-slate-400 group-hover:text-slate-600 stroke-[1.6]'
            }`} 
          />
          <span 
            className={`text-[11px] mt-1 tracking-tight leading-none ${
              isHomeActive 
                ? 'font-bold text-[#4338ca]' 
                : 'font-normal text-slate-400 group-hover:text-slate-600'
            }`}
          >
            Home
          </span>
        </button>

        {/* 2. Roll */}
        <button
          id="nav-roll-btn"
          type="button"
          onClick={() => onOpenMemberRoll('members_list')}
          className="flex-1 flex flex-col items-center justify-center py-1 transition-all cursor-pointer focus:outline-none relative group rounded-lg hover:bg-slate-100/50"
        >
          <div className="relative inline-flex items-center justify-center">
            <Users 
              className={`w-[20px] h-[20px] transition-colors ${
                isRollActive 
                  ? 'text-[#2563eb] stroke-[2.2]' 
                  : 'text-slate-400 group-hover:text-slate-600 stroke-[1.6]'
              }`} 
            />
            <span className="absolute -top-0.5 -right-1 w-2 h-2 bg-[#2563eb] rounded-full ring-2 ring-white" />
          </div>
          <span 
            className={`text-[11px] mt-1 tracking-tight leading-none ${
              isRollActive 
                ? 'font-bold text-[#2563eb]' 
                : 'font-normal text-slate-400 group-hover:text-slate-600'
            }`}
          >
            Roll
          </span>
        </button>

        {/* 3. Studio */}
        <button
          id="nav-studio-btn"
          type="button"
          onClick={() => onNavigate('create_qr')}
          className="flex-1 flex flex-col items-center justify-center py-1 transition-all cursor-pointer focus:outline-none group rounded-lg hover:bg-slate-100/50"
        >
          <QrCode 
            className={`w-[20px] h-[20px] transition-colors ${
              isStudioActive 
                ? 'text-[#4338ca] stroke-[2.2]' 
                : 'text-slate-400 group-hover:text-slate-600 stroke-[1.6]'
            }`} 
          />
          <span 
            className={`text-[11px] mt-1 tracking-tight leading-none ${
              isStudioActive 
                ? 'font-bold text-[#4338ca]' 
                : 'font-normal text-slate-400 group-hover:text-slate-600'
            }`}
          >
            Studio
          </span>
        </button>

        {/* 4. Reports */}
        <button
          id="nav-report-btn"
          type="button"
          onClick={() => onNavigate('reports')}
          className="flex-1 flex flex-col items-center justify-center py-1 transition-all cursor-pointer focus:outline-none group rounded-lg hover:bg-slate-100/50"
        >
          <FileText 
            className={`w-[20px] h-[20px] transition-colors ${
              isReportActive 
                ? 'text-[#4338ca] stroke-[2.2]' 
                : 'text-slate-400 group-hover:text-slate-600 stroke-[1.6]'
            }`} 
          />
          <span 
            className={`text-[11px] mt-1 tracking-tight leading-none ${
              isReportActive 
                ? 'font-bold text-[#4338ca]' 
                : 'font-normal text-slate-400 group-hover:text-slate-600'
            }`}
          >
            Reports
          </span>
        </button>

        {/* 5. Profile */}
        <button
          id="nav-profile-btn"
          type="button"
          onClick={onOpenProfile}
          className="flex-1 flex flex-col items-center justify-center py-1 transition-all cursor-pointer focus:outline-none group rounded-lg hover:bg-slate-100/50"
        >
          <User 
            className={`w-[20px] h-[20px] transition-colors ${
              isProfileActive 
                ? 'text-[#4338ca] stroke-[2.2]' 
                : 'text-slate-400 group-hover:text-slate-600 stroke-[1.6]'
            }`} 
          />
          <span 
            className={`text-[11px] mt-1 tracking-tight leading-none ${
              isProfileActive 
                ? 'font-bold text-[#4338ca]' 
                : 'font-normal text-slate-400 group-hover:text-slate-600'
            }`}
          >
            Profile
          </span>
        </button>
      </div>
    </nav>
  );
};
