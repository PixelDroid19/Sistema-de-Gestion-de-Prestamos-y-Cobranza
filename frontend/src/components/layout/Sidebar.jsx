import React from 'react';
import { LayoutDashboard, Briefcase, CreditCard, Users, PieChart } from "lucide-react";
import { useSessionStore } from '../../store/sessionStore';
import { useUiStore } from '../../store/uiStore';

const Sidebar = () => {
  const user = useSessionStore((state) => state.user);
  const logout = useSessionStore((state) => state.logout);
  const currentView = useUiStore((state) => state.currentView);
  const setCurrentView = useUiStore((state) => state.setCurrentView);

  const handleLogout = () => {
    logout();
  };

  const getMenuItems = () => {
    if (!user) return [];
    
    if (user.role === "socio") {
      return [
        { id: "Dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "Loans", label: "Loans", icon: Briefcase },
        { id: "Reports", label: "Partner Portal", icon: PieChart },
      ];
    }

    const items = [
      { id: "Dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "Loans", label: "Loans", icon: Briefcase },
      { id: "Payments", label: "Payments", icon: CreditCard },
    ];
    
    if (user.role === "admin") {
      items.push({ id: "Agents", label: "Agents", icon: Users });
      items.push({ id: "Reports", label: "Reports", icon: PieChart });
    }

    return items;
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div style={{color: '#EAB308', display: 'flex'}}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="m9 11 3 3L22 4"></path></svg>
        </div>
      </div>
      <nav className="sidebar-nav">
        <ul>
          {getMenuItems().map(item => {
            const Icon = item.icon;
            return (
              <li 
                key={item.id} 
                className={currentView === item.id ? "active" : ""}
                onClick={() => setCurrentView(item.id)}
                title={item.label}
              >
                <Icon size={22} strokeWidth={2.5} />
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div style={{marginTop: "auto", marginBottom: "1rem"}}>
         <button onClick={handleLogout} style={{width: '48px', height: '48px', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '14px', transition: 'all 0.2s', cursor: 'pointer', border: 'none', background: 'transparent'}} title="Logout" onMouseOver={(e)=>e.currentTarget.style.color='#fff'} onMouseOut={(e)=>e.currentTarget.style.color='rgba(255,255,255,0.6)'}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
         </button>
      </div>
    </aside>
  );
};

export default Sidebar;
