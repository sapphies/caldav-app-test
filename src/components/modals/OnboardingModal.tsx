import ArrowLeft from 'lucide-react/icons/arrow-left';
import ArrowRight from 'lucide-react/icons/arrow-right';
import Calendar from 'lucide-react/icons/calendar';
import CheckCircle2 from 'lucide-react/icons/check-circle-2';
import FolderKanban from 'lucide-react/icons/folder-kanban';
import Sparkles from 'lucide-react/icons/sparkles';
import User from 'lucide-react/icons/user';
import { useEffect, useState } from 'react';
import { useAccounts } from '@/hooks/queries';
import { useSettingsStore } from '@/store/settingsStore';
import { ModalWrapper } from '../ModalWrapper';

interface OnboardingModalProps {
  onComplete: () => void;
  onAddAccount: () => void;
}

interface OnboardingStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  illustration?: React.ReactNode;
}

const steps: OnboardingStep[] = [
  {
    title: 'Welcome to caldav-tasks',
    description:
      'A lightweight app that syncs with your CalDAV server. Keep your tasks organized across all your devices.',
    icon: <FolderKanban className="w-12 h-12 text-primary-500" />,
    illustration: (
      <div className="flex items-center justify-center gap-4 py-8">
        <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <FolderKanban className="w-8 h-8 text-primary-600 dark:text-primary-400" />
        </div>
      </div>
    ),
  },
  {
    title: 'Connect your CalDAV account',
    description:
      'Add your CalDAV server credentials to sync your tasks. We support Nextcloud, Fastmail, and any standard CalDAV server.',
    icon: <User className="w-12 h-12 text-primary-500" />,
    illustration: (
      <div className="flex items-center justify-center gap-4 py-8">
        <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <ArrowRight className="w-6 h-6 text-surface-400" />
        <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Calendar className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
      </div>
    ),
  },
  {
    title: 'Organize With Calendars & Tags',
    description:
      'Create multiple calendars for different projects. Use tags to categorize tasks across calendars. Everything stays in sync.',
    icon: <Calendar className="w-12 h-12 text-primary-500" />,
    illustration: (
      <div className="flex items-center justify-center gap-2 py-8 flex-wrap">
        <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
          Work
        </span>
        <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
          Personal
        </span>
        <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
          Urgent
        </span>
        <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
          Ideas
        </span>
      </div>
    ),
  },
  {
    title: "You're All Set!",
    description:
      'Start adding tasks and stay productive. Your tasks will sync automatically in the background.',
    icon: <CheckCircle2 className="w-12 h-12 text-primary-500" />,
    illustration: (
      <div className="flex items-center justify-center py-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center animate-pulse">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
      </div>
    ),
  },
];

export function OnboardingModal({ onComplete, onAddAccount }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [initialAccountCount, setInitialAccountCount] = useState(0);
  const { setOnboardingCompleted } = useSettingsStore();
  const { data: accounts = [] } = useAccounts();

  // Track initial account count and advance step when an account is added
  useEffect(() => {
    if (currentStep === 1) {
      // Just entered account step, record the current account count
      if (initialAccountCount === 0) {
        setInitialAccountCount(accounts.length);
      }
      // If account count increased, advance to next step
      else if (accounts.length > initialAccountCount) {
        setCurrentStep(currentStep + 1);
      }
    }
  }, [accounts, currentStep, initialAccountCount]);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;
  const isAccountStep = currentStep === 1;

  const handleNext = () => {
    if (isLastStep) {
      setOnboardingCompleted(true);
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleAddAccount = () => {
    onAddAccount();
  };

  const handleSkip = () => {
    setOnboardingCompleted(true);
    onComplete();
  };

  return (
    <ModalWrapper onClose={() => {}} preventClose>
      <div className="w-full max-w-md mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={isFirstStep}
            className={`p-2 rounded-lg transition-colors ${
              isFirstStep
                ? 'text-surface-300 dark:text-surface-600 cursor-not-allowed'
                : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'
            }`}
            title="Previous step"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? 'w-8 bg-primary-500'
                    : index < currentStep
                      ? 'bg-primary-300 dark:bg-primary-700'
                      : 'bg-surface-300 dark:bg-surface-600'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleNext}
            disabled={isLastStep}
            className={`p-2 rounded-lg transition-colors ${
              isLastStep
                ? 'text-surface-300 dark:text-surface-600 cursor-not-allowed'
                : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'
            }`}
            title="Next step"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center">
          {step.illustration}

          <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-3">
            {step.title}
          </h2>

          <p className="text-surface-600 dark:text-surface-400 mb-8 leading-relaxed">
            {step.description}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {isAccountStep ? (
            <>
              <button
                type="button"
                onClick={handleAddAccount}
                className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <User className="w-5 h-5" />
                Add CalDAV Account
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="w-full py-3 px-4 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-700 dark:text-surface-300 font-medium rounded-lg transition-colors"
              >
                I'll do this later
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleNext}
                className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isLastStep ? 'Get Started' : 'Continue'}
              </button>
            </>
          )}

          {isFirstStep && (
            <button
              type="button"
              onClick={handleSkip}
              className="w-full py-2 text-sm text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
            >
              Skip onboarding
            </button>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}
