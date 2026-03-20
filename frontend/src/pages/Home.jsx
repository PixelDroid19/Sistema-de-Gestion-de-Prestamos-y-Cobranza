import React, { useState, useEffect } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { ShieldCheck, TrendingUp, PiggyBank, Smartphone, CheckCircle2, Users, Award, Star, Apple, Play, MapPin } from 'lucide-react';
import Register from './Register';
import { handleApiError } from '../lib/api/errors';
import { useLoginMutation } from '../hooks/useAuth';

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,700&display=swap');
  
  * {
    box-sizing: border-box;
    font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  }
  
  body {
    margin: 0;
    padding: 0;
    background-color: #fafbfc;
    color: #1a1a2e;
    overflow-x: hidden;
  }

  .nav-btn {
    transition: all 0.2s ease;
  }
  .nav-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
  }

  .hero-store-btn {
    transition: all 0.2s ease;
  }
  .hero-store-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(0,0,0,0.1);
  }

  .feature-card {
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }
  .feature-card:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow: 0 20px 40px rgba(0,0,0,0.08);
  }

  .vertical-card {
    transition: all 0.4s ease;
  }
  .vertical-card:hover {
    transform: translateY(-5px);
  }

  @media (max-width: 1024px) {
    .hero-container {
      flex-direction: column !important;
      text-align: center;
      padding-top: 4rem !important;
    }
    .hero-content {
      align-items: center !important;
      max-width: 100% !important;
    }
    .hero-image {
      margin-top: 3rem;
    }
    .split-section {
      flex-direction: column !important;
      text-align: center;
    }
    .split-content {
      align-items: center !important;
    }
  }

  @media (max-width: 768px) {
    .nav-links {
      display: none !important;
    }
    .features-grid {
      grid-template-columns: 1fr !important;
    }
    .vertical-cards-grid {
      grid-template-columns: 1fr !important;
      height: auto !important;
    }
    .stats-row {
      flex-direction: column !important;
      gap: 2rem !important;
    }
    .footer-grid {
      grid-template-columns: 1fr !important;
      gap: 3rem !important;
      text-align: center;
    }
    .footer-grid > div:last-child {
      justify-content: center !important;
    }
  }

  /* Phone Mockup System */
  .phone-mockup {
    position: relative;
    z-index: 1;
    width: 280px;
    height: 560px;
    flex-shrink: 0;
    background: #0f172a;
    border-radius: 40px;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3), inset 0 0 0 1px #334155;
    padding: 8px;
    overflow: hidden;
  }
  
  @media (max-width: 768px) {
    .phone-mockup {
       transform-origin: top center;
       transform: scale(0.9);
    }
    .hero-image .phone-mockup {
       transform: rotate(5deg) scale(0.9);
    }
  }

  .phone-mockup.footer-phone {
    height: 380px;
    border-bottom-left-radius: 0; 
    border-bottom-right-radius: 0;
    padding-bottom: 0px;
    transform: translateY(2rem);
  }
  @media (max-width: 768px) {
    .phone-mockup.footer-phone {
       transform: translateY(2rem) scale(0.9);
    }
  }

  .phone-notch {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    width: 90px;
    height: 24px;
    background: #0f172a;
    border-bottom-left-radius: 16px;
    border-bottom-right-radius: 16px;
    z-index: 10;
  }
  .phone-screen {
    width: 100%;
    height: 100%;
    background: #F8FAFC;
    border-radius: 32px;
    padding: 2.8rem 1rem 1rem 1rem;
    overflow: hidden;
    position: relative;
  }
  .phone-screen.footer-screen {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
  
  /* Shared Mockup UI Elements */
  .mock-header {
    height: 24px;
    background: #E2E8F0;
    border-radius: 12px;
    margin-bottom: 1.5rem;
    width: 40%;
  }
  .mock-hero {
    height: 90px;
    background: #4F46E5;
    border-radius: 16px;
    margin-bottom: 1rem;
    position: relative;
    overflow: hidden;
  }
  .mock-hero::after {
    content: '';
    position: absolute;
    top: -20px;
    right: -20px;
    width: 80px;
    height: 80px;
    background: rgba(255,255,255,0.1);
    border-radius: 50%;
  }
  .mock-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    background: #fff;
    padding: 0.75rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  }
  .mock-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .mock-line-1 {
    height: 6px;
    width: 70%;
    background: #CBD5E1;
    border-radius: 3px;
    margin-bottom: 6px;
  }
  .mock-line-2 {
    height: 6px;
    width: 40%;
    background: #E2E8F0;
    border-radius: 3px;
  }
`;

function Home({ onLogin }) {
  const [showForm, setShowForm] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMutation = useLoginMutation();
  const loading = loginMutation.isPending;

  useEffect(() => {
    // Inject global styles
    const styleSheet = document.createElement("style");
    styleSheet.innerText = globalStyles;
    document.head.appendChild(styleSheet);
    return () => styleSheet.remove();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await loginMutation.mutateAsync({ email, password });
      setError('');
      onLogin();
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  const formatErrorMessage = (errorMessage) => {
    if (errorMessage.includes('\n')) {
      return errorMessage.split('\n').map((line, index) => (
        <div key={index} style={{ marginBottom: '0.4rem' }}>{line}</div>
      ));
    }
    return errorMessage;
  };

  const handleLoginClick = () => {
    setShowForm(true);
    setShowRegister(false);
    setError('');
    setEmail('');
    setPassword('');
  };

  const handleSignUpClick = () => {
    setShowForm(true);
    setShowRegister(true);
    setError('');
    setEmail('');
    setPassword('');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc' }}>

      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1.25rem 4rem', background: '#ffffff',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => setShowForm(false)}>
          <div style={{ width: '32px', height: '32px', background: '#4F46E5', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={18} color="white" />
          </div>
          <h2 style={{ fontWeight: 800, color: '#4F46E5', margin: 0, fontSize: '1.4rem', letterSpacing: '-0.5px' }}>
            LendFlow
          </h2>
        </div>

        <div className="nav-links" style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
          <a href="#" style={{ textDecoration: 'none', color: '#64748b', fontWeight: 600, fontSize: '0.95rem' }}>Inicio</a>
          <a href="#" style={{ textDecoration: 'none', color: '#64748b', fontWeight: 600, fontSize: '0.95rem' }}>Plataforma</a>
          <a href="#" style={{ textDecoration: 'none', color: '#64748b', fontWeight: 600, fontSize: '0.95rem' }}>Socios</a>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            className="nav-btn"
            style={{
              background: 'transparent', color: '#4F46E5', border: 'none',
              fontWeight: 700, padding: '0.75rem 1.5rem', borderRadius: '100px',
              cursor: 'pointer', fontSize: '0.95rem'
            }}
            onClick={handleLoginClick}
          >
            Ingresar
          </button>
          <button
            className="nav-btn"
            style={{
              background: '#4F46E5', color: '#ffffff', border: 'none',
              fontWeight: 700, padding: '0.75rem 1.8rem', borderRadius: '100px',
              cursor: 'pointer', fontSize: '0.95rem'
            }}
            onClick={handleSignUpClick}
          >
            Registro
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {showForm ? (
        // FORM VIEW (Replacing Hero gracefully)
        <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{
            width: '100%', maxWidth: '440px', background: '#fff',
            padding: '3rem 2.5rem', borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.02)',
            position: 'relative'
          }}>
            {showRegister ? (
              <Register onCancel={() => setShowForm(false)} />
            ) : (
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ width: '48px', height: '48px', background: '#EEF2FF', borderRadius: '14px', margin: '0 auto 1.5rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldCheck size={24} color="#4F46E5" />
                  </div>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem', letterSpacing: '-0.5px' }}>Bienvenido de nuevo</h2>
                  <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Ingresa a tu cuenta para gestionar créditos</p>
                </div>

                {error && (
                  <div style={{ padding: '1rem', background: '#FEF2F2', color: '#DC2626', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 500 }}>
                    {formatErrorMessage(error)}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#334155', fontWeight: 600, fontSize: '0.9rem' }}>
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%', padding: '0.875rem 1rem', borderRadius: '12px',
                      border: '1px solid #E2E8F0', outline: 'none', fontSize: '1rem',
                      background: '#F8FAFC', transition: 'all 0.2s'
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#334155', fontWeight: 600, fontSize: '0.9rem' }}>
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%', padding: '0.875rem 1rem', borderRadius: '12px',
                      border: '1px solid #E2E8F0', outline: 'none', fontSize: '1rem',
                      background: '#F8FAFC', transition: 'all 0.2s'
                    }}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: '#4F46E5', color: '#fff', padding: '1rem', borderRadius: '12px', fontWeight: 700,
                    border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '1rem',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                    marginTop: '0.5rem', transition: 'all 0.2s',
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{
                    background: 'transparent', color: '#64748b', padding: '0.5rem', border: 'none',
                    cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600
                  }}
                >
                  Volver al inicio
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        // LANDING PAGE VIEW
        <>
          {/* Hero Section */}
          <section style={{ padding: '4rem 4rem 8rem 4rem', overflow: 'hidden', background: '#fff' }}>
            <div className="hero-container" style={{
              maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              {/* Left Content */}
              <div className="hero-content" style={{ flex: 1, maxWidth: '550px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <h1 style={{
                  fontSize: '4.5rem', fontWeight: 800, color: '#1A1A2E',
                  lineHeight: 1.1, letterSpacing: '-2px', margin: 0
                }}>
                  Gestión de <br />préstamos, <br /><span style={{ color: '#4F46E5' }}>reimaginada</span>
                </h1>

                <p style={{ fontSize: '1.15rem', color: '#64748b', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                  La plataforma integral para administrar originaciones, cobranzas y seguimiento de clientes con máxima precisión.
                </p>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button className="hero-store-btn" style={{
                    background: '#000', color: '#fff', padding: '0.75rem 1.5rem',
                    borderRadius: '12px', border: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer'
                  }}>
                    <Apple size={24} />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>Descárgalo en la</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 600, letterSpacing: '-0.3px', marginTop: '-2px' }}>App Store</div>
                    </div>
                  </button>
                  <button className="hero-store-btn" style={{
                    background: '#000', color: '#fff', padding: '0.75rem 1.5rem',
                    borderRadius: '12px', border: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer'
                  }}>
                    <Play size={20} fill="white" />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>DISPONIBLE EN</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 600, letterSpacing: '-0.3px', marginTop: '-2px' }}>Google Play</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Right Content - Phone Mockup */}
              <div className="hero-image" style={{ flex: 1, display: 'flex', justifyContent: 'center', position: 'relative', width: '100%' }}>
                <div style={{
                  position: 'absolute', width: '90%', maxWidth: '450px', aspectRatio: '1',
                  background: '#E2F2EE', borderRadius: '50%', zIndex: 0, right: '-5%', top: '5%'
                }}></div>
                
                <div className="phone-mockup" style={{ transform: 'rotate(5deg)' }}>
                  <div className="phone-notch"></div>
                  <div className="phone-screen">
                    <div className="mock-header"></div>
                    <div className="mock-hero" style={{ marginBottom: '1.5rem' }}></div>
                    
                    {/* Simulated List Items */}
                    <div className="mock-row">
                      <div className="mock-avatar" style={{ background: '#FECDD3' }}></div>
                      <div style={{ flex: 1 }}>
                        <div className="mock-line-1"></div>
                        <div className="mock-line-2"></div>
                      </div>
                    </div>
                    <div className="mock-row">
                      <div className="mock-avatar" style={{ background: '#BAE6FD' }}></div>
                      <div style={{ flex: 1 }}>
                        <div className="mock-line-1" style={{ width: '80%' }}></div>
                        <div className="mock-line-2" style={{ width: '50%' }}></div>
                      </div>
                    </div>
                    <div className="mock-row">
                      <div className="mock-avatar" style={{ background: '#BBF7D0' }}></div>
                      <div style={{ flex: 1 }}>
                        <div className="mock-line-1" style={{ width: '60%' }}></div>
                        <div className="mock-line-2" style={{ width: '30%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 1: Features Grid */}
          <section style={{ padding: '6rem 4rem', background: '#fafbfc' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#4F46E5', marginBottom: '0.5rem', letterSpacing: '-1px' }}>
                Elige mejor <br /> <span style={{ color: '#1A1A2E' }}>con LendFlow</span>
              </h2>

              <div className="features-grid" style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', marginTop: '4rem'
              }}>
                {/* Card 1 */}
                <div className="feature-card" style={{
                  background: '#E0F2FE', padding: '3rem 2rem', borderRadius: '24px',
                  display: 'flex', flexDirection: 'column', height: '100%'
                }}>
                  <div style={{ background: '#fff', width: '60px', height: '60px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                    <ShieldCheck size={30} color="#0284C7" />
                  </div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '2.5rem', color: '#0369A1' }}>Protege tu cartera</h3>
                </div>

                {/* Card 2 */}
                <div className="feature-card" style={{
                  background: '#FEF3C7', padding: '3rem 2rem', borderRadius: '24px',
                  display: 'flex', flexDirection: 'column', height: '100%'
                }}>
                  <div style={{ background: '#fff', width: '60px', height: '60px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                    <PiggyBank size={30} color="#D97706" />
                  </div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '2.5rem', color: '#B45309' }}>Mejora tu cobranza</h3>
                </div>

                {/* Card 3 */}
                <div className="feature-card" style={{
                  background: '#FFEDD5', padding: '3rem 2rem', borderRadius: '24px',
                  display: 'flex', flexDirection: 'column', height: '100%'
                }}>
                  <div style={{ background: '#fff', width: '60px', height: '60px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                    <TrendingUp size={30} color="#EA580C" />
                  </div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '2.5rem', color: '#C2410C' }}>Múltiples metas a la vez</h3>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Split Content */}
          <section style={{ padding: '6rem 4rem', background: '#fff' }}>
            <div className="split-section" style={{
              maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4rem'
            }}>
              <div className="split-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <h2 style={{ fontSize: '3rem', fontWeight: 800, color: '#4F46E5', lineHeight: 1.1, letterSpacing: '-1px', margin: 0 }}>
                  Toma control <br /> <span style={{ color: '#1A1A2E' }}>de tus finanzas</span>
                </h2>

                <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '1rem 0 0 0' }}>Gestión al alcance de tus dedos</h3>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '1.1rem', color: '#475569', fontWeight: 500 }}>
                    <CheckCircle2 size={24} color="#10B981" /> Monitoreo fácil con vista única
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '1.1rem', color: '#475569', fontWeight: 500 }}>
                    <CheckCircle2 size={24} color="#10B981" /> Asignación de agentes en 1 clic
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '1.1rem', color: '#475569', fontWeight: 500 }}>
                    <CheckCircle2 size={24} color="#10B981" /> Recordatorios de cobro premium
                  </li>
                </ul>
              </div>

              <div style={{ flex: 1, display: 'flex', justifyContent: 'center', position: 'relative', width: '100%' }}>
                <div style={{
                  position: 'absolute', width: '90%', maxWidth: '400px', aspectRatio: '1',
                  background: '#D1FAE5', borderRadius: '50%', zIndex: 0
                }}></div>
                
                <div className="phone-mockup">
                  <div className="phone-notch"></div>
                  <div className="phone-screen">
                    <div style={{ height: '60px', background: '#10B981', borderRadius: '16px', marginBottom: '1rem' }}></div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                      <div style={{ flex: 1, height: '80px', background: '#D1FAE5', borderRadius: '16px' }}></div>
                      <div style={{ flex: 1, height: '80px', background: '#E0E7FF', borderRadius: '16px' }}></div>
                    </div>
                    
                    <div className="mock-row">
                      <div className="mock-avatar" style={{ background: '#f1f5f9', borderRadius: '8px' }}></div>
                      <div style={{ flex: 1 }}>
                        <div className="mock-line-1" style={{ background: '#94a3b8' }}></div>
                        <div className="mock-line-2"></div>
                      </div>
                    </div>
                    <div className="mock-row">
                      <div className="mock-avatar" style={{ background: '#f1f5f9', borderRadius: '8px' }}></div>
                      <div style={{ flex: 1 }}>
                        <div className="mock-line-1" style={{ background: '#94a3b8' }}></div>
                        <div className="mock-line-2"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Vertical Cards */}
          <section style={{ padding: '6rem 4rem', background: '#fafbfc' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#4F46E5', marginBottom: '4rem', letterSpacing: '-1px' }}>
                Construyendo <br /> <span style={{ color: '#1A1A2E' }}>experiencia para ti</span>
              </h2>

              <div className="vertical-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', height: '450px' }}>
                {/* Panel 1 */}
                <div className="vertical-card" style={{ background: '#CCFBF1', borderRadius: '24px', padding: '2.5rem', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '1.25rem', color: '#0F766E', lineHeight: 1.6, fontWeight: 700, margin: 0 }}>
                    Nuestra probada experiencia en servicios financieros y tecnología significa que tu cartera está manejada con software de primer nivel.
                  </h3>
                </div>

                {/* Panel 2 */}
                <div className="vertical-card" style={{ background: '#4F46E5', borderRadius: '24px', padding: '2.5rem', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '1.25rem', color: '#fff', lineHeight: 1.6, fontWeight: 700, margin: 0 }}>
                    Las mentes más brillantes realizan la investigación difícil, para que puedas tomar decisiones prudentes sobre tu dinero.
                  </h3>
                </div>

                {/* Panel 3 */}
                <div className="vertical-card" style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', justifyContent: 'center' }}>
                  <div>
                    <div style={{ fontSize: '4rem', fontWeight: 800, color: '#4F46E5', lineHeight: 1 }}>150+</div>
                    <div style={{ color: '#64748b', fontWeight: 600, fontSize: '0.9rem', marginTop: '0.5rem' }}>Préstamos Gestionados</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '4rem', fontWeight: 800, color: '#4F46E5', lineHeight: 1 }}>60+</div>
                    <div style={{ color: '#64748b', fontWeight: 600, fontSize: '0.9rem', marginTop: '0.5rem' }}>Agentes en campo</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Map/Stats */}
          <section style={{ padding: '8rem 4rem', background: '#fff', textAlign: 'center' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1A1A2E', marginBottom: '1rem', letterSpacing: '-1px' }}>
              El mundo de <span style={{ color: '#4F46E5' }}>LendFlow</span>
            </h2>
            <p style={{ color: '#64748b', maxWidth: '600px', margin: '0 auto 4rem auto', fontSize: '1.1rem', lineHeight: 1.6 }}>
              Más de 1000 usuarios confían en nuestra plataforma para mantener su cartera sana y libre de estrés.
            </p>

            {/* Fake Map Illustration via icons */}
            <div style={{ maxWidth: '800px', margin: '0 auto', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ width: '400px', height: '400px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '10%', left: '20%', background: '#4F46E5', padding: '1rem', borderRadius: '50%', color: '#fff', boxShadow: '0 10px 20px rgba(79, 70, 229, 0.3)' }}><Users size={24} /></div>
                <div style={{ position: 'absolute', top: '40%', left: '80%', background: '#10B981', padding: '0.8rem', borderRadius: '50%', color: '#fff', boxShadow: '0 10px 20px rgba(16, 185, 129, 0.3)' }}><Users size={20} /></div>
                <div style={{ position: 'absolute', top: '70%', left: '30%', background: '#F59E0B', padding: '1.2rem', borderRadius: '50%', color: '#fff', boxShadow: '0 10px 20px rgba(245, 158, 11, 0.3)' }}><Users size={28} /></div>
                <div style={{ position: 'absolute', top: '50%', left: '50%', background: '#0EA5E9', padding: '1.5rem', borderRadius: '50%', color: '#fff', boxShadow: '0 10px 20px rgba(14, 165, 233, 0.3)', transform: 'translate(-50%, -50%)' }}><MapPin size={32} /></div>
              </div>
            </div>

            <div className="stats-row" style={{ display: 'flex', justifyContent: 'center', gap: '5rem', marginTop: '4rem' }}>
              <div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1A1A2E' }}>60+</div>
                <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Ubicaciones</div>
              </div>
              <div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1A1A2E' }}>20L+</div>
                <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Operaciones</div>
              </div>
              <div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1A1A2E' }}>$900k</div>
                <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Cartera Administrada</div>
              </div>
            </div>
          </section>

          {/* Footer Area */}
          <footer style={{ background: '#4F46E5', padding: '6rem 4rem 4rem 4rem', color: '#fff' }}>
            <div className="footer-grid" style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(300px, 400px) 1fr', gap: '4rem', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-1px', margin: '0 0 2rem 0' }}>
                  Gestionar tus finanzas con nosotros <br /> es a un clic.
                </h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button style={{
                    background: '#000', color: '#fff', padding: '0.6rem 1.25rem',
                    borderRadius: '10px', border: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer'
                  }}>
                    <Apple size={20} />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '0.55rem', opacity: 0.8 }}>Descárgalo en la</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, letterSpacing: '-0.3px', marginTop: '-2px' }}>App Store</div>
                    </div>
                  </button>
                  <button style={{
                    background: '#000', color: '#fff', padding: '0.6rem 1.25rem',
                    borderRadius: '10px', border: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer'
                  }}>
                    <Play size={16} fill="white" />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '0.55rem', opacity: 0.8 }}>DISPONIBLE EN</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, letterSpacing: '-0.3px', marginTop: '-2px' }}>Google Play</div>
                    </div>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', position: 'relative', width: '100%', overflow: 'hidden' }}>
                {/* Phone half-hidden at bottom */}
                <div className="phone-mockup footer-phone" style={{ marginRight: '2rem' }}>
                  <div className="phone-notch"></div>
                  <div className="phone-screen footer-screen">
                    <div className="mock-hero" style={{ height: '140px' }}></div>
                    
                    <div className="mock-row" style={{ marginTop: '1.5rem' }}>
                      <div className="mock-avatar" style={{ background: '#E0E7FF' }}></div>
                      <div style={{ flex: 1 }}>
                        <div className="mock-line-1" style={{ width: '90%' }}></div>
                        <div className="mock-line-2" style={{ width: '60%' }}></div>
                      </div>
                    </div>
                    <div className="mock-row">
                      <div className="mock-avatar" style={{ background: '#E0E7FF' }}></div>
                      <div style={{ flex: 1 }}>
                        <div className="mock-line-1" style={{ width: '75%' }}></div>
                        <div className="mock-line-2" style={{ width: '40%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ maxWidth: '1200px', margin: '4rem auto 0 auto', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem', display: 'flex', justifyContent: 'space-between', opacity: 0.7, fontSize: '0.9rem' }}>
              <div>© 2026 LendFlow Inc. Todos los derechos reservados.</div>
              <div style={{ display: 'flex', gap: '2rem' }}>
                <a href="#" style={{ color: '#fff', textDecoration: 'none' }}>Términos</a>
                <a href="#" style={{ color: '#fff', textDecoration: 'none' }}>Privacidad</a>
              </div>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

export default Home;

