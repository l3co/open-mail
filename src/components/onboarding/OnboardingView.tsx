import { Link } from 'react-router';
import { CheckCircle2, KeyRound, MailCheck, ServerCog, Sparkles } from 'lucide-react';

const setupSteps = [
  {
    title: 'Connect account',
    description: 'Choose OAuth or manual IMAP when Phase 6 wires providers.',
    icon: MailCheck
  },
  {
    title: 'Verify secrets',
    description: 'Keep credentials in the native vault instead of browser storage.',
    icon: KeyRound
  },
  {
    title: 'Prime sync',
    description: 'Warm up folders, labels, and the first thread window in the background.',
    icon: ServerCog
  }
];

export const OnboardingView = () => (
  <main className="onboarding-root" aria-label="Open Mail onboarding">
    <section className="onboarding-card">
      <div className="onboarding-orbit" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="onboarding-copy">
        <p className="eyebrow">First-run route</p>
        <h1>Prepare the inbox before the mail arrives.</h1>
        <p>
          This standalone onboarding surface stays outside the mailbox shell so first-run setup can focus on account
          trust, provider choices, and sync readiness without sidebar noise.
        </p>
        <div className="onboarding-actions">
          <Link className="onboarding-primary-link" to="/">
            Continue to mailbox
          </Link>
          <span className="onboarding-note">Phase 6 will replace this with the account wizard.</span>
        </div>
      </div>

      <div className="onboarding-panel" aria-label="Setup preview">
        <div className="onboarding-panel-header">
          <div className="brand-mark">
            <Sparkles size={18} />
          </div>
          <div>
            <span>Open Mail setup</span>
            <strong>3 readiness checks</strong>
          </div>
        </div>

        <ol className="onboarding-steps">
          {setupSteps.map((step, index) => {
            const Icon = step.icon;

            return (
              <li key={step.title}>
                <div className="onboarding-step-index">
                  <Icon size={17} />
                </div>
                <div>
                  <span>0{index + 1}</span>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                </div>
                <CheckCircle2 aria-hidden="true" className="onboarding-step-check" size={18} />
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  </main>
);
