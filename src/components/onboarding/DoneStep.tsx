type DoneStepProps = {
  onAddAnother: () => void;
  onOpenInbox: () => void;
};

export const DoneStep = ({ onAddAnother, onOpenInbox }: DoneStepProps) => (
  <section className="onboarding-step-screen">
    <div className="onboarding-step-copy">
      <p className="eyebrow">Done</p>
      <h2>You&apos;re all set</h2>
      <p>Your account is saved and the inbox worker is ready. OAuth still needs the callback/token exchange cut, but the manual IMAP path now lands in the real desktop backend.</p>
    </div>

    <div className="onboarding-step-actions">
      <button className="onboarding-secondary-button" onClick={onAddAnother} type="button">
        Add another account
      </button>
      <button className="onboarding-primary-link" onClick={onOpenInbox} type="button">
        Open inbox
      </button>
    </div>
  </section>
);
