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
  AlertCircle,
} from 'lucide-react';
import { tTerm } from '../i18n/terminology';
import { ActionButton, FormField, IconActionButton, TextInput } from './shared/Surfaces';

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
        <div className="absolute top-1/4 -left-20 size-96 bg-blue-500/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 -right-20 size-96 bg-emerald-500/15 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 size-[600px] -translate-x-1/2 -translate-y-1/2 bg-slate-800/50 rounded-full blur-[120px]" />
        
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
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl mb-8">
            <Lock className="size-7 text-white/80" strokeWidth={1.5} />
          </div>
          
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
            {APP_BRAND.name}
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed">
            {tTerm('login.brandSubtitle')}
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 lg:p-12 relative">
        {/* Mobile header */}
        <div className="lg:hidden flex flex-col items-center mb-10">
          <div className="inline-flex items-center justify-center size-12 rounded-xl bg-slate-900 mb-4">
            <Lock className="size-5 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-bold text-text-primary">{APP_BRAND.name}</h1>
        </div>

        <div className="w-full max-w-[380px]">
          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-[28px] font-bold text-text-primary tracking-tight mb-2">
              {tTerm('login.title')}
            </h2>
            <p className="text-[15px] text-text-secondary leading-relaxed">
              {tTerm('login.subtitle')}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error */}
            {error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-500/[0.08] border border-red-200 dark:border-red-500/20 p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <AlertCircle className="size-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-400 leading-relaxed">
                  {error}
                </p>
              </div>
            )}

            {/* Email */}
            <FormField label={tTerm('login.emailLabel')}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="size-[18px] text-text-secondary/40" />
                </div>
                <TextInput
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={isLoading}
                  placeholder={tTerm('login.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl py-2.5 pl-10 pr-4 text-[15px]"
                />
              </div>
            </FormField>

            {/* Password */}
            <FormField label={tTerm('login.passwordLabel')}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="size-[18px] text-text-secondary/40" />
                </div>
                <TextInput
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={isLoading}
                  placeholder={tTerm('login.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-xl py-2.5 pl-10 pr-11 text-[15px]"
                />
                <IconActionButton
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  className="absolute right-1 top-1/2 -translate-y-1/2 !border-0 !bg-transparent"
                  tabIndex={-1}
                  label={showPassword ? tTerm('login.password.hide') : tTerm('login.password.show')}
                  icon={showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                />
              </div>
            </FormField>

            {/* Submit */}
            <ActionButton
              type="submit"
              disabled={!isFormValid || isLoading}
              className="group mt-2 rounded-xl py-2.5 text-[15px]"
              fullWidth
              variant="primary"
              isLoading={isLoading}
              loadingLabel={tTerm('login.loading')}
              icon={!isLoading ? <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform duration-200" /> : undefined}
            >
              {tTerm('login.submit')}
            </ActionButton>
          </form>
        </div>
      </div>
    </div>
  );
}
