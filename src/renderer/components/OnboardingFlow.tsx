import React, { useState } from 'react'
import { OnboardingWelcome } from './OnboardingWelcome'
import { OnboardingApiKey } from './OnboardingApiKey'
import { OnboardingFirstProject } from './OnboardingFirstProject'
import { OnboardingTips } from './OnboardingTips'

interface Props {
  onComplete: () => void
}

type Step = 'welcome' | 'api-key' | 'first-project' | 'tips'

const STEPS: Step[] = ['welcome', 'api-key', 'first-project', 'tips']

export function OnboardingFlow({ onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState<Step>('welcome')

  const currentIndex = STEPS.indexOf(currentStep)

  const goToNext = () => {
    const nextIndex = currentIndex + 1
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex])
    }
  }

  const handleApiKeySubmit = async (apiKey: string, provider: string) => {
    if (apiKey.trim() || provider === 'local') {
      try {
        const updates: Record<string, string> = { aiProvider: provider }
        if (provider === 'bedrock') updates.bedrockApiKey = apiKey
        else if (provider === 'openai') updates.openaiApiKey = apiKey
        else if (provider === 'gemini') updates.geminiApiKey = apiKey
        else if (provider === 'grok') updates.grokApiKey = apiKey

        await window.electronAPI.updateSettings(updates)
      } catch { /* ignore — user can configure later */ }
    }
    goToNext()
  }

  const handleApiKeySkip = () => {
    goToNext()
  }

  const handleFirstProject = async (projectName: string) => {
    try {
      await window.electronAPI.createProject(projectName)
    } catch { /* ignore */ }
    goToNext()
  }

  const handleFirstProjectSkip = () => {
    goToNext()
  }

  const handleFinish = async () => {
    try {
      await window.electronAPI.updateSettings({ onboardingCompleted: 'true' })
    } catch { /* ignore */ }
    onComplete()
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-container">
        {/* Progress indicator */}
        <div className="onboarding-progress">
          {STEPS.map((step, index) => (
            <div
              key={step}
              className={`onboarding-progress-dot ${index === currentIndex ? 'active' : ''} ${index < currentIndex ? 'completed' : ''}`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="onboarding-content">
          {currentStep === 'welcome' && (
            <OnboardingWelcome onNext={goToNext} />
          )}
          {currentStep === 'api-key' && (
            <OnboardingApiKey onNext={handleApiKeySubmit} onSkip={handleApiKeySkip} />
          )}
          {currentStep === 'first-project' && (
            <OnboardingFirstProject onNext={handleFirstProject} onSkip={handleFirstProjectSkip} />
          )}
          {currentStep === 'tips' && (
            <OnboardingTips onFinish={handleFinish} />
          )}
        </div>
      </div>
    </div>
  )
}
