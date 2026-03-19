
import { useEffect, useState } from "react";
import "./App.css"; 
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Loans from "./pages/Loans";
import Payments from "./pages/Payments";
import AgentsPage from "./pages/AgentsPage";
import Reports from "./pages/Reports";
import sessionManager from "./utils/sessionManager";
import { Search, Bell, ChevronDown, CheckCircle, Moon, Sun } from "lucide-react";

function App() {
  const [user, setUser] = useState(() => {
    if (sessionManager.isSessionValid()) {
      const session = sessionManager.getSession();
      return session.userData;
    }
    return null;
  });

  const [currentView, setCurrentView] = useState("Dashboard");
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      alert("Your session has expired due to inactivity. Please log in again.");
    };

    window.addEventListener("sessionExpired", handleSessionExpired);

    const sessionCheckInterval = setInterval(() => {
      if (user && !sessionManager.isSessionValid()) {
        setUser(null);
        alert("Your session has expired. Please log in again.");
      }
    }, 60000);

    return () => {
      window.removeEventListener("sessionExpired", handleSessionExpired);
      clearInterval(sessionCheckInterval);
    };
  }, [user]);

  // Apply theme to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [isDarkMode]);

  const handleLogin = (userData, token) => {
    setUser(userData);
    sessionManager.initSession(token, userData);
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setCurrentView("Dashboard");
  };

  const handleLogout = () => {
    setUser(null);
    sessionManager.clearSession();
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  if (!user) {
    return <Home onLogin={handleLogin} />;
  }

  // Define menu based on user role
  const getMenuItems = () => {
    const items = [
      { id: "Dashboard", label: "Dashboard" },
      { id: "Loans", label: "Loans" },
      { id: "Payments", label: "Payments" },
    ];
    
    if (user.role === "admin") {
      items.push({ id: "Agents", label: "Agents" });
      items.push({ id: "Reports", label: "Reports" });
    }
    
    return items;
  };

  const renderView = () => {
    switch (currentView) {
      case "Dashboard": return <Dashboard user={user} />;
      case "Loans": return <Loans user={user} />;
      case "Payments": return <Payments user={user} />;
      case "Agents": return <AgentsPage user={user} />;
      case "Reports": return <Reports user={user} />;
      default: return <Dashboard user={user} />;
    }
  };

  return (
    <div className="layout-container">
      <aside className="sidebar">
        <div className="sidebar-brand">LendFlow</div>
        <nav className="sidebar-nav">
          <p className="nav-title">Main Menu</p>
          <ul>
            {getMenuItems().map(item => (
              <li 
                key={item.id} 
                className={currentView === item.id ? "active" : ""}
                onClick={() => setCurrentView(item.id)}
              >
                {item.label}
              </li>
            ))}
          </ul>
        </nav>
        
        {/* Customizable theme controls */}
        <div className="sidebar-footer" style={{marginTop: "auto", borderTop: "1px solid var(--border-color)", paddingTop: "1rem"}}>
           <p className="nav-title">Theme System</p>
           <button onClick={toggleTheme} className="theme-toggle-btn flex items-center gap-2" style={{color: "var(--text-secondary)", fontSize: "0.9rem", padding: "0.5rem 0"}}>
              {isDarkMode ? <Sun size={16}/> : <Moon size={16} />}
              {isDarkMode ? "Light Mode" : "Dark Mode"}
           </button>
           <div className="theme-colors flex gap-2 mt-2">
             <div onClick={()=>document.documentElement.style.setProperty("--accent-color", "#3b3f5c")} style={{width: 20, height: 20, borderRadius: "50%", background: "#3b3f5c", cursor: "pointer"}} title="Classic"></div>
             <div onClick={()=>document.documentElement.style.setProperty("--accent-color", "#0066cc")} style={{width: 20, height: 20, borderRadius: "50%", background: "#0066cc", cursor: "pointer"}} title="Blue"></div>
             <div onClick={()=>document.documentElement.style.setProperty("--accent-color", "#16a34a")} style={{width: 20, height: 20, borderRadius: "50%", background: "#16a34a", cursor: "pointer"}} title="Green"></div>
           </div>
        </div>

      </aside>

      <div className="main-wrapper">
        <header className="top-header">
          <div className="search-bar">
            <input type="text" placeholder="Search information" />
            <button className="search-btn">
              <Search size={16} />
            </button>
          </div>
          <div className="header-actions">
            <button className="icon-btn" title="System secured" style={{cursor: "default"}}>
              <CheckCircle size={18} color="#34c38f" />
            </button>
            <div className="user-profile" onClick={handleLogout} title="Click to logout">
              <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user.name}`} alt="Avatar" />
              <div className="user-info">
                <span className="user-name">{user.name}</span>
                <span className="user-role" style={{textTransform: "capitalize"}}>{user.role}</span>
              </div>
              <ChevronDown size={16} />
            </div>
          </div>
        </header>
        <main className="content-area">
          {renderView()}
        </main>
      </div>
    </div>
  );
}

export default App;

