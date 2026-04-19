import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../services/authService';
import { toast } from '../lib/toast';
import { getSafeErrorText } from '../services/safeErrorMessages';
import { getDefaultRouteForUser } from '../constants/appAccess';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const from = location.state?.from?.pathname;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const response = await login({ email, password });
      const authenticatedUser = response?.data?.user;
      const nextRoute = from || (authenticatedUser ? getDefaultRouteForUser(authenticatedUser) : '/dashboard');
      navigate(nextRoute, { replace: true });
    } catch (err: any) {
      console.error('[auth] login failed', err);
      setError(getSafeErrorText(err, { domain: 'auth', action: 'login' }));
      toast.apiErrorSafe(err, { domain: 'auth', action: 'login' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-bg-surface p-8 rounded-2xl shadow-sm border border-border-subtle">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-text-primary">
            LendingSys
          </h2>
          <p className="mt-2 text-center text-sm text-text-secondary">
            Inicia sesión para continuar
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px flex flex-col gap-4">
            <div>
              <label htmlFor="email-address" className="sr-only">Email</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-border-subtle placeholder-text-secondary text-text-primary focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-bg-base"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Contraseña</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-border-subtle placeholder-text-secondary text-text-primary focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-bg-base"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-bg-base bg-text-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Iniciar Sesión
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
