import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { handleApiError } from '@/lib/api/errors';
import { useLoginMutation } from '@/hooks/useAuth';
import HomeAuthPanel from '@/pages/Home/components/HomeAuthPanel';
import HomeBentoSection from '@/pages/Home/components/HomeBentoSection';
import HomeControlSection from '@/pages/Home/components/HomeControlSection';
import HomeFeaturesSection from '@/pages/Home/components/HomeFeaturesSection';
import HomeFooter from '@/pages/Home/components/HomeFooter';
import HomeHeader from '@/pages/Home/components/HomeHeader';
import HomeHeroSection from '@/pages/Home/components/HomeHeroSection';
import HomeWorldSection from '@/pages/Home/components/HomeWorldSection';
import { controlItemKeys, featureCards, worldStats } from '@/pages/Home/homeContent';

import './Home.scss';

function Home({ onLogin }) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMutation = useLoginMutation();
  const loading = loginMutation.isPending;

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

  const resetAuthState = () => {
    setError('');
    setEmail('');
    setPassword('');
  };

  const handleLoginClick = () => {
    setShowForm(true);
    setShowRegister(false);
    resetAuthState();
  };

  const handleSignUpClick = () => {
    setShowForm(true);
    setShowRegister(true);
    resetAuthState();
  };

  const handleBackHome = () => {
    setShowForm(false);
    setShowRegister(false);
    resetAuthState();
  };

  return (
    <div className="home-container">
      <div className="home-page">
        <HomeHeader
          t={t}
          onBackHome={handleBackHome}
          onLoginClick={handleLoginClick}
          onSignUpClick={handleSignUpClick}
        />

        {showForm ? (
          <HomeAuthPanel
            t={t}
            showRegister={showRegister}
            email={email}
            password={password}
            error={error}
            loading={loading}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onSubmit={handleLogin}
            onBackHome={handleBackHome}
          />
        ) : (
          <>
            <HomeHeroSection t={t} />
            <HomeFeaturesSection t={t} featureCards={featureCards} />
            <HomeControlSection t={t} controlItemKeys={controlItemKeys} />
            <HomeBentoSection t={t} />
            <HomeWorldSection t={t} worldStats={worldStats} />
            <HomeFooter t={t} />
          </>
        )}
      </div>
    </div>
  );
}

export default Home;
