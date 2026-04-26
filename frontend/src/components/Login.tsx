import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../services/authService';
import { toast } from '../lib/toast';
import { extractStatusCode, getSafeErrorText } from '../services/safeErrorMessages';
import { getDefaultRouteForUser } from '../constants/appAccess';
import { APP_BRAND } from '../constants/appShell';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const from = location.state?.from?.pathname;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError('');
    setIsLoading(true);
    try {
      const response = await login({ email, password });
      const authenticatedUser = response?.data?.user;
      const nextRoute = from || (authenticatedUser ? getDefaultRouteForUser(authenticatedUser) : '/dashboard');
      navigate(nextRoute, { replace: true });
    } catch (err: any) {
      console.error('[auth] login failed', err);
      setError(getSafeErrorText(err, { domain: 'auth', action: 'login' }));
      if (extractStatusCode(err) !== 401) {
        toast.apiErrorSafe(err, { domain: 'auth', action: 'login' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = email.trim().length > 0 && password.length > 0;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-bg-base">
      {/* ── Left decorative panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-1/2 relative items-center justify-center overflow-hidden">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-slate-900" />
        
        {/* Animated orbs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-500/15 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-slate-800/50 rounded-full blur-[120px]" />
        
        {/* Subtle grid */}
        <div 
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)`,
            backgroundSize: '32px 32px'
          }}
        />

        {/* Content */}
        <div className="relative z-10 text-center px-16 max-w-lg">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl mb-8">
            <Lock className="w-7 h-7 text-white/80" strokeWidth={1.5} />
          </div>
          
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
            {APP_BRAND.name}
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed">
            Plataforma integral para la gestión de préstamos, cobranzas y seguimiento financiero.
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 lg:p-12 relative">
        {/* Mobile header */}
        <div className="lg:hidden flex flex-col items-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 mb-4">
            <Lock className="w-5 h-5 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-bold text-text-primary">{APP_BRAND.name}</h1>
        </div>

        <div className="w-full max-w-[380px]">
          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-[28px] font-bold text-text-primary tracking-tight mb-2">
              Iniciar sesión
            </h2>
            <p className="text-[15px] text-text-secondary leading-relaxed">
              Ingresa tus credenciales para continuar
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error */}
            {error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-500/[0.08] border border-red-200 dark:border-red-500/20 p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-400 leading-relaxed">
                  {error}
                </p>
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-[13px] font-semibold text-text-primary ml-1">
                Correo electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-[18px] w-[18px] text-text-secondary/40" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={isLoading}
                  placeholder="nombre@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 rounded-xl border border-border-subtle bg-bg-surface text-text-primary placeholder:text-text-secondary/30 focus:outline-none focus:ring-[3px] focus:ring-blue-500/10 focus:border-blue-500/40 transition-all duration-200 disabled:opacity-50 text-[15px]"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-[13px] font-semibold text-text-primary ml-1">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-[18px] w-[18px] text-text-secondary/40" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={isLoading}
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-11 py-2.5 rounded-xl border border-border-subtle bg-bg-surface text-text-primary placeholder:text-text-secondary/30 focus:outline-none focus:ring-[3px] focus:ring-blue-500/10 focus:border-blue-500/40 transition-all duration-200 disabled:opacity-50 text-[15px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-secondary/40 hover:text-text-secondary focus:outline-none transition-colors disabled:opacity-50"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                    <EyeOff className="h-[18px] w-[18px]" />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!isFormValid || isLoading}
              className="group relative w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-text-primary text-bg-base font-semibold text-[15px] hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-[3px] focus:ring-blue-500/20 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                <>
                  <span>Iniciar sesión</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform duration-200" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
