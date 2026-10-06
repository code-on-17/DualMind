import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Zap, ShieldCheck, Swords, Settings, Cpu } from 'lucide-react';
import { useDualMind } from '../context/DualMindContext.tsx';

export const Navbar: React.FC = () => {
  const { neuralSync, tokenSaver, activePreset } = useDualMind();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#262A35] bg-[#181A20]/95 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-15 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link to="/" className="group flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#232731] border border-[#2E3340] text-blue-400 transition-colors group-hover:border-blue-500/50">
            <Cpu className="h-4.5 w-4.5 text-blue-400" />
          </div>

          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-white group-hover:text-blue-100 transition-colors">
              Dual<span className="text-blue-400">Mind</span>
            </span>
            <span className="text-[10px] text-slate-400">
              Where AIs Challenge Each Other
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-1.5">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isActive
                  ? 'text-blue-300 bg-blue-500/15 border border-blue-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#232731]'
              }`
            }
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>FactForge</span>
          </NavLink>

          <NavLink
            to="/idea-clash"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isActive
                  ? 'text-blue-300 bg-blue-500/15 border border-blue-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#232731]'
              }`
            }
          >
            <Swords className="h-3.5 w-3.5" />
            <span>Idea Clash</span>
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isActive
                  ? 'text-blue-300 bg-blue-500/15 border border-blue-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#232731]'
              }`
            }
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
          </NavLink>
        </nav>

        {/* Global Active State Indicators */}
        <div className="hidden lg:flex items-center gap-3 text-xs text-slate-400 border-l border-[#262A35] pl-4">
          <span className="flex items-center gap-1.5 text-slate-300 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
            {activePreset.name}
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          {tokenSaver && (
            <>
              <span className="flex items-center gap-1 text-blue-400 font-medium">
                <Zap className="h-3 w-3" />
                Saver On
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
            </>
          )}
          <span className="text-slate-400">
            Sync: <span className={neuralSync !== 'off' ? 'text-blue-400 capitalize font-medium' : 'text-slate-500'}>{neuralSync}</span>
          </span>
        </div>
      </div>
    </header>
  );
};
