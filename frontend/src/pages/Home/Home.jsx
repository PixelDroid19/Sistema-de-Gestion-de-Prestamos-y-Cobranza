import React, { useReducer } from 'react'
import { useTranslation } from 'react-i18next'

import { homeContentMock } from '@/config/homeContent'
import { useLoginMutation } from '@/hooks/useAuth'
import { handleApiError } from '@/lib/api/errors'
import HomeAuthPanel from '@/pages/Home/components/HomeAuthPanel'
import HomeBentoSection from '@/pages/Home/components/HomeBentoSection'
import HomeControlSection from '@/pages/Home/components/HomeControlSection'
import HomeFeaturesSection from '@/pages/Home/components/HomeFeaturesSection'
import HomeFooter from '@/pages/Home/components/HomeFooter'
import HomeHeader from '@/pages/Home/components/HomeHeader'
import HomeHeroSection from '@/pages/Home/components/HomeHeroSection'
import HomeWorldSection from '@/pages/Home/components/HomeWorldSection'

import './Home.scss'

const INITIAL_STATE = {
  showForm: false,
  showRegister: false,
  email: '',
  password: '',
  error: '',
}

function reducer(state, action) {
  switch (action.type) {
    case 'resetAuthState':
      return {
        ...state,
        email: '',
        password: '',
        error: '',
      }
    case 'showLogin':
      return {
        ...state,
        showForm: true,
        showRegister: false,
        email: '',
        password: '',
        error: '',
      }
    case 'showRegister':
      return {
        ...state,
        showForm: true,
        showRegister: true,
        email: '',
        password: '',
        error: '',
      }
    case 'showHome':
      return {
        ...state,
        showForm: false,
        showRegister: false,
        email: '',
        password: '',
        error: '',
      }
    case 'setEmail':
      return {
        ...state,
        email: action.value,
      }
    case 'setPassword':
      return {
        ...state,
        password: action.value,
      }
    case 'setError':
      return {
        ...state,
        error: action.value,
      }
    default:
      return state
  }
}

function Home({ onLogin }) {
  const { t } = useTranslation()
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)
  const { showForm, showRegister, email, password, error } = state

  const loginMutation = useLoginMutation()
  const loading = loginMutation.isPending

  const resetAuthState = () => {
    dispatch({ type: 'resetAuthState' })
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    dispatch({ type: 'setError', value: '' })

    try {
      await loginMutation.mutateAsync({ email, password })
      resetAuthState()
      onLogin()
    } catch (loginError) {
      handleApiError(loginError, (message) => dispatch({ type: 'setError', value: message }))
    }
  }

  const handleLoginClick = () => {
    dispatch({ type: 'showLogin' })
  }

  const handleSignUpClick = () => {
    dispatch({ type: 'showRegister' })
  }

  const handleBackHome = () => {
    dispatch({ type: 'showHome' })
  }

  return (
    <div className="home-container">
      <div className="home-page">
        <HomeHeader
          t={t}
          authMode={showForm}
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
            onEmailChange={(value) => dispatch({ type: 'setEmail', value })}
            onPasswordChange={(value) => dispatch({ type: 'setPassword', value })}
            onSubmit={handleLogin}
            onBackHome={handleBackHome}
            onLogin={onLogin}
            onShowLogin={handleLoginClick}
            onShowRegister={handleSignUpClick}
          />
        ) : (
          <>
            <HomeHeroSection t={t} storeButtons={homeContentMock.storeButtons.hero} />
            <HomeFeaturesSection t={t} featureCards={homeContentMock.featureCards} />
            <HomeControlSection t={t} controlItemKeys={homeContentMock.controlItems} />
            <HomeBentoSection t={t} stats={homeContentMock.bentoStats} />
            <HomeWorldSection t={t} worldStats={homeContentMock.worldStats} worldMarkers={homeContentMock.worldMarkers} />
            <HomeFooter t={t} storeButtons={homeContentMock.storeButtons.footer} />
          </>
        )}
      </div>
    </div>
  )
}

export default Home
