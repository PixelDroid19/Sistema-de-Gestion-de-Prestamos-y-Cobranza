import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../services/authService';
import { toast } from '../lib/toast';
import { extractStatusCode, getSafeErrorText } from '../services/safeErrorMessages';
import { getDefaultRouteForUser } from '../constants/appAccess';
import { APP_BRAND } from '../constants/appShell';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import { tTerm } from '../i18n/terminology';
import { ActionButton, AppInput, FormField } from './shared/Surfaces';

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
      const defaultRoute = getDefaultRouteForUser(authenticatedUser);
      const nextRoute = defaultRoute === '/login' ? defaultRoute : (from || defaultRoute);
      navigate(nextRoute, { replace: true });
    } catch (err: any) {
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
    <div className="login-page">
      <aside className="login-aside" aria-label={APP_BRAND.name}>
        <div className="login-aside__content">
          <p className="login-aside__workspace">{APP_BRAND.workspace}</p>
          <h1 className="login-aside__title">{APP_BRAND.name}</h1>
          <p className="login-aside__tagline">{tTerm('login.tagline')}</p>
        </div>
        <p className="login-aside__footnote">{tTerm('login.footer')}</p>
      </aside>

      <main className="login-main">
        <div className="login-main__inner">
          <header className="login-main__header">
            <p className="login-main__brand">{APP_BRAND.name}</p>
            <h2 className="login-main__title">{tTerm('login.title')}</h2>
            <p className="login-main__subtitle">{tTerm('login.subtitle')}</p>
          </header>

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            {error && (
              <div className="login-error" role="alert" aria-live="polite">
                <AlertCircle className="size-5 shrink-0" aria-hidden="true" />
                <p>{error}</p>
              </div>
            )}

            <FormField label={tTerm('login.emailLabel')}>
              <AppInput
                id="email"
                name="email"
                variant="email"
                autoComplete="email"
                required
                disabled={isLoading}
                placeholder={tTerm('login.emailPlaceholder')}
                value={email}
                onValueChange={(v, _detail, e) => setEmail(v)}
                icon={<Mail size={16} aria-hidden="true" />}
                shellClassName="login-control"
              />
            </FormField>

            <FormField label={tTerm('login.passwordLabel')}>
              <AppInput
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                variant={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                disabled={isLoading}
                placeholder={tTerm('login.passwordPlaceholder')}
                value={password}
                onValueChange={(v) => setPassword(v)}
                icon={<Lock size={16} aria-hidden="true" />}
                suffix={(
                  <button
                    type="button"
                    className="operational-control-affordance"
                    onClick={() => setShowPassword((visible) => !visible)}
                    disabled={isLoading}
                    aria-label={showPassword ? tTerm('login.password.hide') : tTerm('login.password.show')}
                  >
                    {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                )}
                shellClassName="login-control"
              />
            </FormField>

            <ActionButton
              type="submit"
              disabled={!isFormValid || isLoading}
              className="login-submit group"
              fullWidth
              variant="primary"
              isLoading={isLoading}
              loadingLabel={tTerm('login.loading')}
              icon={!isLoading ? (
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              ) : undefined}
            >
              {tTerm('login.submit')}
            </ActionButton>
          </form>

          <p className="login-main__footnote lg:hidden">{tTerm('login.footer')}</p>
        </div>
      </main>
    </div>
  );
}
