import React, { useState, useEffect } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { ShieldCheck, TrendingUp, PiggyBank, Smartphone, CheckCircle2, Users, Award, Star, Apple, Play, MapPin, MousePointerClick } from 'lucide-react';
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

  /* Core Animations */
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-15px); }
  }
  @keyframes float-delay {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(15px); }
  }
  @keyframes slideUpFade {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .nav-btn, .hero-store-btn { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
  .nav-btn:hover, .hero-store-btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
  }

  /* Phone Mockup System (Realistic Design) */
  .phone-mockup {
    position: relative;
    z-index: 10;
    width: 320px;
    height: 640px;
    background: #0F172A;
    border-radius: 54px;
    box-shadow: 
      0 0 0 10px #1E293B,
      0 0 0 12px #334155,
      0 40px 80px -20px rgba(0,0,0,0.5);
    padding: 14px;
    overflow: hidden;
    transition: transform 0.5s ease;
  }
  
  .phone-mockup:hover {
    transform: rotate(2deg) scale(1.02) !important;
  }
  
  .phone-notch {
    position: absolute;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    width: 120px;
    height: 35px;
    background: #000;
    border-radius: 20px;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 12px;
  }
  .phone-notch::before { /* camera lens */
    content: '';
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #111;
    border: 1px solid #222;
  }

  .phone-screen {
    width: 100%;
    height: 100%;
    background: #F8FAFC;
    border-radius: 40px;
    padding: 4.5rem 1.25rem 1rem 1.25rem;
    overflow: hidden;
    position: relative;
    box-shadow: inset 0 0 15px rgba(0,0,0,0.05);
  }
  
  /* Shared Mockup UI Elements inside Phone */
  .mock-header {
    height: 28px;
    background: #E2E8F0;
    border-radius: 14px;
    margin-bottom: 1.5rem;
    width: 45%;
    animation: slideUpFade 0.6s ease-out forwards;
  }
  .mock-hero {
    height: 120px;
    background: linear-gradient(135deg, #4F46E5, #3730A3);
    border-radius: 24px;
    margin-bottom: 1rem;
    position: relative;
    overflow: hidden;
    animation: slideUpFade 0.8s ease-out forwards;
    box-shadow: 0 15px 30px rgba(79, 70, 229, 0.25);
  }
  .mock-hero::after {
    content: '';
    position: absolute; top: -30px; right: -30px;
    width: 120px; height: 120px;
    background: rgba(255,255,255,0.1);
    border-radius: 50%;
    filter: blur(10px);
  }
  .mock-row {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    margin-bottom: 1rem;
    background: #fff;
    padding: 1rem;
    border-radius: 16px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.04);
    animation: slideUpFade 1s ease-out forwards;
    opacity: 0;
  }
  .mock-row:nth-child(3) { animation-delay: 0.2s; }
  .mock-row:nth-child(4) { animation-delay: 0.4s; }
  .mock-row:nth-child(5) { animation-delay: 0.6s; }
  
  .mock-avatar { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; }
  .mock-line-1 { height: 8px; width: 70%; background: #CBD5E1; border-radius: 4px; margin-bottom: 8px; }
  .mock-line-2 { height: 8px; width: 40%; background: #E2E8F0; border-radius: 4px; }

  /* Floating Badges */
  .floating-badge {
    position: absolute;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.6);
    padding: 1rem 1.5rem;
    border-radius: 24px;
    display: flex;
    align-items: center;
    gap: 1rem;
    box-shadow: 0 20px 40px rgba(0,0,0,0.12);
    z-index: 20;
    font-weight: 700;
    color: #1A1A2E;
  }
  
  @media (max-width: 1024px) {
    .floating-badge { display: none; }
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

  /* Feature Cards */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2rem;
    margin-top: 4rem;
  }
  .feature-card {
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.5);
  }
  .feature-card::before {
    content: '';
    position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
    background: linear-gradient(to right, transparent, rgba(255,255,255,0.5), transparent);
    transform: skewX(-25deg);
    transition: all 0.7s ease;
    opacity: 0.5;
  }
  .feature-card:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow: 0 30px 60px -15px rgba(0,0,0,0.15);
  }
  .feature-card:hover::before {
    left: 200%;
  }

  /* Bento Grid for "Experiencia" */
  .bento-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-auto-rows: 240px;
    gap: 1.5rem;
  }
  .bento-item {
    background: #fff;
    border-radius: 36px;
    padding: 3rem;
    position: relative;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    border: 1px solid rgba(0,0,0,0.03);
    box-shadow: inset 0 2px 0 rgba(255,255,255,0.5), 0 10px 30px rgba(0,0,0,0.03);
  }
  .bento-item:hover {
    transform: translateY(-6px);
    box-shadow: inset 0 2px 0 rgba(255,255,255,0.5), 0 30px 60px -10px rgba(0,0,0,0.1);
  }
  .bento-large { grid-column: span 2; grid-row: span 2; }
  .bento-tall { grid-column: span 1; grid-row: span 2; }
  .bento-wide { grid-column: span 2; grid-row: span 1; }
  
  @media (max-width: 1024px) {
    .bento-grid { grid-template-columns: 1fr; grid-auto-rows: auto; }
    .bento-large, .bento-tall, .bento-wide { grid-column: span 1; grid-row: auto; }
  }

  @media (max-width: 768px) {
    .nav-links { display: none !important; }
    .features-grid { grid-template-columns: 1fr !important; }
    .stats-row { flex-direction: column !important; gap: 2rem !important; }
    .footer-grid { grid-template-columns: 1fr !important; gap: 3rem !important; text-align: center; }
    .phone-mockup { transform: scale(0.85); margin: 0 auto; transform-origin: top center; }
    .phone-mockup:hover { transform: rotate(0) scale(0.85) !important; }
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
        padding: '1.25rem 4rem', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)',
        position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(0,0,0,0.05)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => setShowForm(false)}>
          <div style={{ width: '38px', height: '38px', background: 'linear-gradient(135deg, #4F46E5, #3730A3)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(79,70,229,0.2)' }}>
            <TrendingUp size={20} color="white" />
          </div>
          <h2 style={{ fontWeight: 800, color: '#1A1A2E', margin: 0, fontSize: '1.5rem', letterSpacing: '-0.5px' }}>
            LendFlow
          </h2>
        </div>

        <div className="nav-links" style={{ display: 'flex', gap: '3rem', alignItems: 'center' }}>
          <a href="#" style={{ textDecoration: 'none', color: '#1A1A2E', fontWeight: 600, fontSize: '0.95rem', transition: 'color 0.2s' }}>Inicio</a>
          <a href="#" style={{ textDecoration: 'none', color: '#64748b', fontWeight: 600, fontSize: '0.95rem', transition: 'color 0.2s' }}>Plataforma</a>
          <a href="#" style={{ textDecoration: 'none', color: '#64748b', fontWeight: 600, fontSize: '0.95rem', transition: 'color 0.2s' }}>Socios</a>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            className="nav-btn"
            style={{
              background: 'transparent', color: '#1A1A2E', border: 'none',
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
              fontWeight: 700, padding: '0.85rem 2rem', borderRadius: '100px',
              cursor: 'pointer', fontSize: '0.95rem', boxShadow: '0 10px 20px rgba(79,70,229,0.2)'
            }}
            onClick={handleSignUpClick}
          >
            Registro
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {showForm ? (
        // FORM VIEW 
        <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{
            width: '100%', maxWidth: '440px', background: '#fff',
            padding: '3rem 2.5rem', borderRadius: '32px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.02)',
            position: 'relative'
          }}>
            {showRegister ? (
              <Register onCancel={() => setShowForm(false)} />
            ) : (
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ width: '56px', height: '56px', background: '#EEF2FF', borderRadius: '16px', margin: '0 auto 1.5rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldCheck size={28} color="#4F46E5" />
                  </div>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1A1A2E', marginBottom: '0.5rem', letterSpacing: '-0.5px' }}>Bienvenido de nuevo</h2>
                  <p style={{ color: '#64748b', fontSize: '1rem' }}>Ingresa a tu cuenta para gestionar créditos</p>
                </div>

                {error && (
                  <div style={{ padding: '1rem', background: '#FEF2F2', color: '#DC2626', borderRadius: '14px', fontSize: '0.9rem', fontWeight: 500 }}>
                    {formatErrorMessage(error)}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#334155', fontWeight: 700, fontSize: '0.95rem' }}>
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%', padding: '1rem 1.25rem', borderRadius: '14px',
                      border: '2px solid transparent', outline: 'none', fontSize: '1rem',
                      background: '#F1F5F9', transition: 'all 0.2s', color: '#1A1A2E', fontWeight: 500
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#334155', fontWeight: 700, fontSize: '0.95rem' }}>
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%', padding: '1rem 1.25rem', borderRadius: '14px',
                      border: '2px solid transparent', outline: 'none', fontSize: '1rem',
                      background: '#F1F5F9', transition: 'all 0.2s', color: '#1A1A2E', fontWeight: 500
                    }}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: '#4F46E5', color: '#fff', padding: '1.15rem', borderRadius: '14px', fontWeight: 800,
                    border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '1.05rem',
                    boxShadow: '0 10px 20px rgba(79, 70, 229, 0.3)',
                    marginTop: '1rem', transition: 'all 0.2s',
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
                    cursor: 'pointer', fontSize: '0.95rem', fontWeight: 700, marginTop: '0.5rem'
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
          <section style={{ padding: '4rem 4rem 10rem 4rem', overflow: 'hidden', background: 'radial-gradient(circle at 50% -20%, #E0E7FF 0%, #fafbfc 50%)' }}>
            <div className="hero-container" style={{
              maxWidth: '1250px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4rem'
            }}>
              {/* Left Content */}
              <div className="hero-content" style={{ flex: 1, maxWidth: '580px', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                <h1 style={{
                  fontSize: '5rem', fontWeight: 800, color: '#1A1A2E',
                  lineHeight: 1.05, letterSpacing: '-2.5px', margin: 0
                }}>
                  Gestión de <br />préstamos, <br /><span style={{ background: 'linear-gradient(to right, #4F46E5, #0EA5E9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>reimaginada.</span>
                </h1>

                <p style={{ fontSize: '1.25rem', color: '#475569', lineHeight: 1.6, margin: 0, fontWeight: 500, maxWidth: '90%' }}>
                  La plataforma integral premium para administrar originaciones, cobranzas y seguimiento de clientes con máxima precisión y elegancia.
                </p>

                <div style={{ display: 'flex', gap: '1.25rem', marginTop: '1rem' }}>
                  <button className="hero-store-btn" style={{
                    background: '#1A1A2E', color: '#fff', padding: '0.85rem 1.75rem',
                    borderRadius: '16px', border: 'none', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer'
                  }}>
                    <Apple size={28} />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 600 }}>Descárgalo en la</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.3px', marginTop: '-2px' }}>App Store</div>
                    </div>
                  </button>
                  <button className="hero-store-btn" style={{
                    background: '#1A1A2E', color: '#fff', padding: '0.85rem 1.75rem',
                    borderRadius: '16px', border: 'none', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer'
                  }}>
                    <Play size={24} fill="white" />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 600 }}>DISPONIBLE EN</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.3px', marginTop: '-2px' }}>Google Play</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Right Content - Phone Mockup */}
              <div className="hero-image" style={{ flex: 1, display: 'flex', justifyContent: 'center', position: 'relative', width: '100%', minHeight: '680px' }}>
                {/* Visual Backdrop Rings */}
                <div style={{
                  position: 'absolute', width: '90%', maxWidth: '500px', aspectRatio: '1',
                  background: 'linear-gradient(135deg, #CCFBF1 0%, transparent 100%)', borderRadius: '50%', zIndex: 0, right: '0%', top: '5%'
                }}></div>
                <div style={{
                  position: 'absolute', width: '70%', maxWidth: '400px', aspectRatio: '1',
                  background: 'linear-gradient(135deg, #E0E7FF 0%, transparent 100%)', borderRadius: '50%', zIndex: 0, left: '5%', bottom: '5%'
                }}></div>
                
                {/* Floating Badge 1 (Left) */}
                <div className="floating-badge" style={{ top: '25%', left: '-5%', animation: 'float 6s ease-in-out infinite' }}>
                  <div style={{background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff', borderRadius: '16px', padding: '0.75rem', boxShadow: '0 10px 20px rgba(16,185,129,0.3)'}}><ShieldCheck size={24}/></div>
                  <div style={{display: 'flex', flexDirection: 'column'}}>
                     <span style={{fontSize:'0.8rem', color:'#64748b', fontWeight:600}}>Cifrado 256-bit</span>
                     <span style={{fontSize:'1.1rem', color:'#0F172A', fontWeight:800}}>Seguridad Total</span>
                  </div>
                </div>

                {/* Floating Badge 2 (Right) */}
                <div className="floating-badge" style={{ bottom: '25%', right: '-8%', animation: 'float-delay 7s ease-in-out infinite' }}>
                  <div style={{background: 'linear-gradient(135deg, #4F46E5, #3730A3)', color: '#fff', borderRadius: '16px', padding: '0.75rem', boxShadow: '0 10px 20px rgba(79,70,229,0.3)'}}><TrendingUp size={24}/></div>
                  <div style={{display: 'flex', flexDirection: 'column'}}>
                    <span style={{fontSize:'0.8rem', color:'#64748b', fontWeight:600}}>Rendimiento</span>
                    <span style={{fontSize:'1.3rem', color:'#0F172A', fontWeight:800}}>+24.5%</span>
                  </div>
                </div>
                
                {/* Realistic Phone Frame */}
                <div className="phone-mockup" style={{ transform: 'rotate(5deg)' }}>
                  <div className="phone-notch"></div>
                  <div className="phone-screen">
                    <div className="mock-header"></div>
                    <div className="mock-hero"></div>
                    
                    {/* Simulated Animated List Items */}
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
          <section style={{ padding: '8rem 4rem', background: '#fff' }}>
            <div style={{ maxWidth: '1250px', margin: '0 auto' }}>
              <h2 style={{ fontSize: '3.5rem', fontWeight: 800, color: '#4F46E5', marginBottom: '0.5rem', letterSpacing: '-1.5px', lineHeight: 1.1 }}>
                Elige mejor <br /> <span style={{ color: '#1A1A2E' }}>con LendFlow</span>
              </h2>
              <p style={{ color: '#64748b', fontSize: '1.25rem', marginTop: '1.5rem', maxWidth: '600px', lineHeight: 1.6 }}>Las herramientas que necesitas bajo una UI perfecta. Descubre por qué las mejores agencias nos eligen.</p>

              <div className="features-grid">
                {/* Card 1 */}
                <div className="feature-card" style={{
                  background: 'linear-gradient(145deg, #E0F2FE 0%, #BAE6FD 100%)', padding: '3.5rem 2.5rem', borderRadius: '36px',
                  display: 'flex', flexDirection: 'column', height: '100%',
                  boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5)'
                }}>
                  <div style={{ background: '#fff', width: '72px', height: '72px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'auto', boxShadow: '0 20px 30px -10px rgba(2, 132, 199, 0.3)' }}>
                    <ShieldCheck size={36} color="#0284C7" />
                  </div>
                  <h3 style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '4rem', color: '#0369A1', lineHeight: 1.2, letterSpacing: '-0.5px' }}>Protege tu <br/>cartera</h3>
                </div>

                {/* Card 2 */}
                <div className="feature-card" style={{
                  background: 'linear-gradient(145deg, #FEF3C7 0%, #FDE68A 100%)', padding: '3.5rem 2.5rem', borderRadius: '36px',
                  display: 'flex', flexDirection: 'column', height: '100%',
                  boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5)'
                }}>
                  <div style={{ background: '#fff', width: '72px', height: '72px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'auto', boxShadow: '0 20px 30px -10px rgba(217, 119, 6, 0.3)' }}>
                    <PiggyBank size={36} color="#D97706" />
                  </div>
                  <h3 style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '4rem', color: '#B45309', lineHeight: 1.2, letterSpacing: '-0.5px' }}>Mejora tu <br/>cobranza</h3>
                </div>

                {/* Card 3 */}
                <div className="feature-card" style={{
                  background: 'linear-gradient(145deg, #FFEDD5 0%, #FED7AA 100%)', padding: '3.5rem 2.5rem', borderRadius: '36px',
                  display: 'flex', flexDirection: 'column', height: '100%',
                  boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5)'
                }}>
                  <div style={{ background: '#fff', width: '72px', height: '72px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'auto', boxShadow: '0 20px 30px -10px rgba(234, 88, 12, 0.3)' }}>
                    <TrendingUp size={36} color="#EA580C" />
                  </div>
                  <h3 style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '4rem', color: '#C2410C', lineHeight: 1.2, letterSpacing: '-0.5px' }}>Múltiples metas <br/>a la vez</h3>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Split Content (Phone 2) */}
          <section style={{ padding: '8rem 4rem', background: '#fafbfc', borderTop: '1px solid #F1F5F9', borderBottom: '1px solid #F1F5F9' }}>
            <div className="split-section" style={{
              maxWidth: '1250px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6rem'
            }}>
              <div className="split-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <h2 style={{ fontSize: '3.5rem', fontWeight: 800, color: '#4F46E5', lineHeight: 1.1, letterSpacing: '-1.5px', margin: 0 }}>
                  Toma control <br /> <span style={{ color: '#1A1A2E' }}>de tus finanzas</span>
                </h2>

                <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '1rem 0 0 0', color: '#334155' }}>Gestión al alcance de tus dedos</h3>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '1.15rem', color: '#475569', fontWeight: 600 }}>
                    <div style={{background: '#D1FAE5', padding: '0.4rem', borderRadius: '50%'}}><CheckCircle2 size={24} color="#059669" /></div>
                    Monitoreo fácil con vista única
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '1.15rem', color: '#475569', fontWeight: 600 }}>
                    <div style={{background: '#D1FAE5', padding: '0.4rem', borderRadius: '50%'}}><CheckCircle2 size={24} color="#059669" /></div>
                    Asignación de agentes en 1 clic
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '1.15rem', color: '#475569', fontWeight: 600 }}>
                    <div style={{background: '#D1FAE5', padding: '0.4rem', borderRadius: '50%'}}><CheckCircle2 size={24} color="#059669" /></div>
                    Recordatorios de cobro premium
                  </li>
                </ul>
              </div>

              <div style={{ flex: 1, display: 'flex', justifyContent: 'center', position: 'relative', width: '100%', minHeight: '640px' }}>
                <div style={{
                  position: 'absolute', width: '100%', maxWidth: '400px', aspectRatio: '1',
                  background: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)', borderRadius: '50%', zIndex: 0, top: '5%'
                }}></div>
                
                <div className="phone-mockup" style={{ transform: 'rotate(-5deg)', marginTop: '20px' }}>
                  <div className="phone-notch"></div>
                  <div className="phone-screen">
                    <div style={{ height: '70px', background: 'linear-gradient(135deg, #10B981, #059669)', borderRadius: '20px', marginBottom: '1.5rem', boxShadow: '0 10px 20px rgba(16,185,129,0.2)' }}></div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                      <div style={{ flex: 1, height: '90px', background: '#D1FAE5', borderRadius: '20px' }}></div>
                      <div style={{ flex: 1, height: '90px', background: '#E0E7FF', borderRadius: '20px' }}></div>
                    </div>
                    
                    <div className="mock-row">
                      <div className="mock-avatar" style={{ background: '#f1f5f9', borderRadius: '12px' }}></div>
                      <div style={{ flex: 1 }}>
                        <div className="mock-line-1" style={{ background: '#94a3b8' }}></div>
                        <div className="mock-line-2"></div>
                      </div>
                    </div>
                    <div className="mock-row">
                      <div className="mock-avatar" style={{ background: '#f1f5f9', borderRadius: '12px' }}></div>
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

          {/* Section 3: Bento Grid "Construyendo experiencia" */}
          <section style={{ padding: '8rem 4rem', background: '#fff' }}>
            <div style={{ maxWidth: '1250px', margin: '0 auto' }}>
              <h2 style={{ fontSize: '3.5rem', fontWeight: 800, color: '#4F46E5', marginBottom: '4rem', letterSpacing: '-1.5px', lineHeight: 1.1 }}>
                Construyendo <br /> <span style={{ color: '#1A1A2E' }}>experiencia para ti</span>
              </h2>

              <div className="bento-grid">
                {/* Panel 1 */}
                <div className="bento-item bento-tall" style={{ background: 'linear-gradient(145deg, #CCFBF1, #A7F3D0)' }}>
                  <div style={{background: '#047857', width: '64px', height: '64px', borderRadius: '20px', display: 'flex', alignItems:'center', justifyContent:'center', marginBottom: '2rem', boxShadow: '0 10px 20px rgba(4,120,87,0.3)'}}>
                     <ShieldCheck size={32} color="#fff"/>
                  </div>
                  <h3 style={{ fontSize: '1.6rem', color: '#064E3B', lineHeight: 1.4, fontWeight: 800, margin: 0 }}>
                    Nuestra probada experiencia en servicios financieros significa que tu cartera está manejada con el mejor software.
                  </h3>
                   <div style={{marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#047857', fontWeight: 700, cursor: 'pointer'}}>
                    Descubre más <MousePointerClick size={18}/>
                  </div>
                </div>

                {/* Panel 2 */}
                <div className="bento-item bento-large" style={{ background: 'linear-gradient(135deg, #4F46E5, #3730A3)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', width: '72px', height: '72px', borderRadius: '24px', display: 'flex', alignItems:'center', justifyContent:'center', marginBottom: '2rem'}}>
                     <Award size={36} color="#fff"/>
                  </div>
                  <h3 style={{ fontSize: '3rem', color: '#fff', lineHeight: 1.1, fontWeight: 800, margin: 0, maxWidth: '85%', letterSpacing: '-1px' }}>
                    Las mentes más brillantes realizan la investigación difícil.
                  </h3>
                  <p style={{color: '#C7D2FE', fontSize: '1.15rem', marginTop: '1.5rem', maxWidth: '75%', lineHeight: 1.6}}>
                    Para que puedas tomar decisiones verdaderamente prudentes sobre tu dinero sin fricciones y enfocarte al 100% en expandir tu agencia.
                  </p>
                </div>

                {/* Panel 3 */}
                <div className="bento-item bento-wide" style={{ background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
                  <div style={{textAlign: 'center'}}>
                    <div style={{ fontSize: '4rem', fontWeight: 800, color: '#4F46E5', lineHeight: 1, letterSpacing: '-2px' }}>150+</div>
                    <div style={{ color: '#64748b', fontWeight: 700, fontSize: '1.1rem', marginTop: '0.75rem' }}>Préstamos Gestionados</div>
                  </div>
                  <div style={{width: '2px', height: '100px', background: '#E2E8F0', borderRadius: '2px'}}></div>
                  <div style={{textAlign: 'center'}}>
                    <div style={{ fontSize: '4rem', fontWeight: 800, color: '#4F46E5', lineHeight: 1, letterSpacing: '-2px' }}>60+</div>
                    <div style={{ color: '#64748b', fontWeight: 700, fontSize: '1.1rem', marginTop: '0.75rem' }}>Agentes Activos</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Map/Stats */}
          <section style={{ padding: '8rem 4rem', background: '#fafbfc', textAlign: 'center', borderTop: '1px solid #F1F5F9' }}>
            <h2 style={{ fontSize: '3.5rem', fontWeight: 800, color: '#1A1A2E', marginBottom: '1rem', letterSpacing: '-1.5px' }}>
              El mundo de <span style={{ color: '#4F46E5' }}>LendFlow</span>
            </h2>
            <p style={{ color: '#64748b', maxWidth: '600px', margin: '0 auto 5rem auto', fontSize: '1.25rem', lineHeight: 1.6 }}>
              Más de 1000 usuarios confían en nuestra plataforma para mantener su cartera sana y libre de estrés.
            </p>

            {/* Fake Map Illustration via icons */}
            <div style={{ maxWidth: '800px', margin: '0 auto', height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ width: '100%', height: '400px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '10%', left: '25%', background: '#4F46E5', padding: '1.25rem', borderRadius: '50%', color: '#fff', boxShadow: '0 15px 30px rgba(79, 70, 229, 0.3)', animation: 'float 6s infinite' }}><Users size={28} /></div>
                <div style={{ position: 'absolute', top: '40%', left: '75%', background: '#10B981', padding: '1rem', borderRadius: '50%', color: '#fff', boxShadow: '0 15px 30px rgba(16, 185, 129, 0.3)', animation: 'float-delay 5s infinite' }}><Users size={24} /></div>
                <div style={{ position: 'absolute', top: '70%', left: '35%', background: '#F59E0B', padding: '1.5rem', borderRadius: '50%', color: '#fff', boxShadow: '0 15px 30px rgba(245, 158, 11, 0.3)', animation: 'float 7s infinite' }}><Users size={32} /></div>
                <div style={{ position: 'absolute', top: '45%', left: '50%', background: '#0EA5E9', padding: '1.8rem', borderRadius: '50%', color: '#fff', boxShadow: '0 15px 30px rgba(14, 165, 233, 0.4)', transform: 'translate(-50%, -50%)', zIndex: 10 }}><MapPin size={40} /></div>
              </div>
            </div>

            <div className="stats-row" style={{ display: 'flex', justifyContent: 'center', gap: '6rem', marginTop: '4rem' }}>
              <div>
                <div style={{ fontSize: '3.5rem', fontWeight: 800, color: '#1A1A2E', letterSpacing: '-2px' }}>60+</div>
                <div style={{ color: '#64748b', fontSize: '1rem', fontWeight: 700, marginTop: '0.5rem' }}>Ubicaciones</div>
              </div>
              <div>
                <div style={{ fontSize: '3.5rem', fontWeight: 800, color: '#1A1A2E', letterSpacing: '-2px' }}>20L+</div>
                <div style={{ color: '#64748b', fontSize: '1rem', fontWeight: 700, marginTop: '0.5rem' }}>Operaciones</div>
              </div>
              <div>
                <div style={{ fontSize: '3.5rem', fontWeight: 800, color: '#1A1A2E', letterSpacing: '-2px' }}>$900k</div>
                <div style={{ color: '#64748b', fontSize: '1rem', fontWeight: 700, marginTop: '0.5rem' }}>Cartera Expansiva</div>
              </div>
            </div>
          </section>

          {/* Footer Area */}
          <footer style={{ background: '#111827', padding: '8rem 4rem 4rem 4rem', color: '#fff', overflow: 'hidden' }}>
            <div className="footer-grid" style={{ maxWidth: '1250px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(300px, 450px) 1fr', gap: '2rem', alignItems: 'center' }}>
              <div style={{position: 'relative', zIndex: 10}}>
                <h2 style={{ fontSize: '4rem', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-1.5px', margin: '0 0 2.5rem 0' }}>
                  Gestionar tus finanzas es <br /> a un clic.
                </h2>
                <div style={{ display: 'flex', gap: '1.25rem' }}>
                  <button style={{
                    background: '#fff', color: '#111827', padding: '0.85rem 1.75rem',
                    borderRadius: '16px', border: 'none', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer',
                    transition: 'transform 0.2s', boxShadow: '0 10px 20px rgba(0,0,0,0.2)'
                  }} onMouseOver={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseOut={e=>e.currentTarget.style.transform='translateY(0)'}>
                    <Apple size={28} />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 700 }}>Descárgalo en la</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.3px', marginTop: '-2px' }}>App Store</div>
                    </div>
                  </button>
                  <button style={{
                    background: '#2dd4bf', color: '#111827', padding: '0.85rem 1.75rem',
                    borderRadius: '16px', border: 'none', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer',
                    transition: 'transform 0.2s', boxShadow: '0 10px 20px rgba(0,0,0,0.2)'
                  }} onMouseOver={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseOut={e=>e.currentTarget.style.transform='translateY(0)'}>
                    <Play size={24} fill="#111827" />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 700 }}>DISPONIBLE EN</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.3px', marginTop: '-2px' }}>Google Play</div>
                    </div>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', position: 'relative', width: '100%' }}>
                <div className="phone-mockup" style={{ 
                  marginRight: '2rem', height: '400px', transform: 'translateY(100px) rotate(-10deg)', 
                  borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: 0 
                }}>
                  <div className="phone-notch"></div>
                  <div className="phone-screen" style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
                    <div className="mock-hero" style={{ height: '180px', background: 'linear-gradient(135deg, #10B981, #059669)' }}></div>
                    
                    <div className="mock-row" style={{ marginTop: '2rem' }}>
                      <div className="mock-avatar" style={{ background: '#E0E7FF' }}></div>
                      <div style={{ flex: 1 }}>
                        <div className="mock-line-1" style={{ width: '90%' }}></div>
                        <div className="mock-line-2" style={{ width: '60%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ maxWidth: '1250px', margin: '4rem auto 0 auto', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2.5rem', display: 'flex', justifyContent: 'space-between', opacity: 0.7, fontSize: '0.95rem' }}>
              <div>© 2026 LendFlow Inc. Todos los derechos reservados.</div>
              <div style={{ display: 'flex', gap: '2.5rem' }}>
                <a href="#" style={{ color: '#fff', textDecoration: 'none', fontWeight: 600 }}>Términos</a>
                <a href="#" style={{ color: '#fff', textDecoration: 'none', fontWeight: 600 }}>Privacidad</a>
              </div>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

export default Home;
