type OAuthStepProps = {
  authUrl: string | null;
  authorizationCode: string;
  clientId: string;
  displayName: string;
  email: string;
  providerName: string;
  status: string | null;
  onAuthorizationCodeChange: (value: string) => void;
  onBack: () => void;
  onClientIdChange: (value: string) => void;
  onContinue: () => void;
  onDisplayNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPrepare: () => Promise<void> | void;
};

export const OAuthStep = ({
  authUrl,
  authorizationCode,
  clientId,
  displayName,
  email,
  providerName,
  status,
  onAuthorizationCodeChange,
  onBack,
  onClientIdChange,
  onContinue,
  onDisplayNameChange,
  onEmailChange,
  onPrepare
}: OAuthStepProps) => (
  <section className="onboarding-step-screen">
    <div className="onboarding-step-copy">
      <p className="eyebrow">OAuth</p>
      <h2>Authorize {providerName}</h2>
      <p>
        Prepare the browser handoff, finish the provider consent flow, then paste the returned authorization code so
        Open Mail can store the account in the desktop backend.
      </p>
    </div>

    <div className="onboarding-form-grid">
      <label className="onboarding-field onboarding-field-full">
        <span>{providerName} client ID</span>
        <input
          onChange={(event) => onClientIdChange(event.target.value)}
          placeholder="Paste the OAuth client id"
          type="text"
          value={clientId}
        />
      </label>
      <label className="onboarding-field">
        <span>Name</span>
        <input onChange={(event) => onDisplayNameChange(event.target.value)} type="text" value={displayName} />
      </label>
      <label className="onboarding-field">
        <span>Email</span>
        <input onChange={(event) => onEmailChange(event.target.value)} type="email" value={email} />
      </label>
      <label className="onboarding-field onboarding-field-full">
        <span>Authorization code</span>
        <textarea
          className="onboarding-auth-code"
          onChange={(event) => onAuthorizationCodeChange(event.target.value)}
          placeholder="Paste the code returned by the provider"
          rows={4}
          value={authorizationCode}
        />
      </label>
    </div>

    {status ? <p className="onboarding-inline-status">{status}</p> : null}
    {authUrl ? (
      <div className="onboarding-auth-preview">
        <span>Authorization URL prepared</span>
        <code>{authUrl}</code>
      </div>
    ) : null}

    <div className="onboarding-step-actions">
      <button className="onboarding-secondary-button" onClick={onBack} type="button">
        Back
      </button>
      <button className="onboarding-secondary-button" onClick={() => void onPrepare()} type="button">
        Prepare browser auth
      </button>
      <button className="onboarding-primary-button" disabled={!authUrl || !authorizationCode.trim() || !email.trim() || !displayName.trim()} onClick={onContinue} type="button">
        Continue
      </button>
    </div>
  </section>
);
