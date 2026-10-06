/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DualMindProvider } from './context/DualMindContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { FactForgePage } from './pages/FactForgePage.tsx';
import { IdeaClashPage } from './pages/IdeaClashPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';

export default function App() {
  return (
    <DualMindProvider>
      <BrowserRouter>
        <div className="flex min-h-screen flex-col bg-[#14161B] text-slate-200 font-sans selection:bg-blue-600/25 selection:text-blue-100">
          <Navbar />

          <main className="flex-1 pb-16">
            <Routes>
              <Route path="/" element={<FactForgePage />} />
              <Route path="/idea-clash" element={<IdeaClashPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <footer className="border-t border-[#222631] bg-[#101217] py-6 text-center text-xs text-slate-500">
            <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-400">
                  Dual<span className="text-blue-400">Mind</span>
                </span>
                <span aria-hidden="true">·</span>
                <span>Where AIs Challenge Each Other</span>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-slate-500">
                <span>Multi-Model Cross-Examination</span>
                <span aria-hidden="true">·</span>
                <span>Session Architecture</span>
              </div>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </DualMindProvider>
  );
}
