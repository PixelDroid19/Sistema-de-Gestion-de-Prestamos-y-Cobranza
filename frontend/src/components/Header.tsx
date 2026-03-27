import React, { useState, useEffect } from 'react';
import { Search, Bell, ChevronDown, ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react';

export default function Header({ setCurrentView }: { setCurrentView: (v: string) => void }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Check initial theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    } else if (savedTheme === 'dark' || document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  return (
    <header className="h-20 flex items-center justify-between px-6 border-b border-border-subtle shrink-0 bg-bg-surface">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('dashboard')}>
        <span className="font-semibold text-lg">Sistema de Préstamos</span>
        <ChevronDown size={16} className="text-text-secondary" />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input 
            type="text" 
            placeholder="Buscar..." 
            className="bg-bg-surface text-sm text-text-primary rounded-full pl-10 pr-10 py-2 w-64 focus:outline-none focus:ring-1 focus:ring-border-strong border border-border-subtle"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-hover-bg rounded flex items-center justify-center">
            <span className="text-[10px] text-text-secondary">↑</span>
          </div>
        </div>

        <button 
          onClick={toggleTheme}
          className="flex items-center justify-center w-10 h-10 bg-bg-surface rounded-full text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors border border-border-subtle"
          title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button 
          onClick={() => setCurrentView('notifications')}
          className="flex items-center gap-2 bg-bg-surface px-4 py-2 rounded-full text-sm hover:bg-hover-bg transition-colors border border-border-subtle"
        >
          <Bell size={16} className="text-text-secondary" />
          <span>3 nuevos</span>
        </button>

        <div className="flex items-center gap-3 bg-bg-surface px-4 py-2 rounded-full text-sm">
          <button className="text-text-secondary hover:text-text-primary"><ChevronLeft size={16} /></button>
          <span>Hoy, 8 Abr</span>
          <button className="text-text-secondary hover:text-text-primary"><ChevronRight size={16} /></button>
        </div>

        <div className="flex items-center gap-3 ml-4 cursor-pointer hover:bg-hover-bg p-2 rounded-xl transition-colors" onClick={() => setCurrentView('profile')}>
          <img src="https://i.pravatar.cc/150?u=admin" alt="User" className="w-10 h-10 rounded-full" />
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">Administrador</span>
              <ChevronDown size={14} className="text-text-secondary" />
            </div>
            <span className="text-xs text-text-secondary">@admin</span>
          </div>
        </div>
      </div>
    </header>
  );
}
