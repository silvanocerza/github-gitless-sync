import { useState, useEffect } from "react";

const STEPS = [
  "welcome",
  "repo",
  "token",
  "folders",
  "sync",
  "interface",
  "first_sync",
  "done",
] as const;

type Step = (typeof STEPS)[number];

type StepData = {
  repo?: { owner: string; repo: string; branch: string };
  token?: { token: string };
  folders?: { repoFolder: string; vaultFolder: string };
  sync?: {
    mode: "manual" | "interval";
    syncOnStart: boolean;
    onConflict: "ignore" | "ask" | "overwrite";
  };
};

const WelcomeStepComponent = () => {
  return (
    <div
      style={{
        display: "flex",
        flexFlow: "column",
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <h1 style={{ textAlign: "center" }}>First setup</h1>
      <p style={{ textAlign: "center" }}>
        This plugin is still in beta so not all features are available yet. If
        you find any issues report that.
      </p>
      <p style={{ textAlign: "center" }}>
        You'll be guided through some steps to get you started.
      </p>
    </div>
  );
};

const RepoStepComponent = ({
  values = { owner: "", repo: "", branch: "" },
  onChange,
}: {
  values?: { owner: string; repo: string; branch: string };
  onChange: (values: { owner: string; repo: string; branch: string }) => void;
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexFlow: "column",
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <p
        style={{
          textAlign: "center",
        }}
      >
        First we need the repository owner, name and branch.
      </p>
      <p
        style={{
          textAlign: "center",
        }}
      >
        You must use a repository that you have read and write access to. If
        your vault already has content I suggest creating a new private
        repository to sync.
      </p>
      <div
        style={{
          display: "flex",
          flexFlow: "column",
          gap: "var(--size-4-2)",
        }}
      >
        <input
          type="text"
          spellCheck="false"
          placeholder="Owner"
          style={{ width: "100%" }}
          value={values.owner}
          onChange={(e) => onChange({ ...values, owner: e.target.value })}
        />
        <input
          type="text"
          spellCheck="false"
          placeholder="Repository"
          style={{ width: "100%" }}
          value={values.repo}
          onChange={(e) => onChange({ ...values, repo: e.target.value })}
        />
        <input
          type="text"
          spellCheck="false"
          placeholder="Branch"
          style={{ width: "100%" }}
          value={values.branch}
          onChange={(e) => onChange({ ...values, branch: e.target.value })}
        />
      </div>
    </div>
  );
};

const TokenStepComponent = ({
  values = { token: "" },
  onChange,
}: {
  values?: { token: string };
  onChange: (values: { token: string }) => void;
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexFlow: "column",
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <p
        style={{
          textAlign: "center",
        }}
      >
        Now we need a GitHub Personal Access Token.
      </p>
      <p
        style={{
          textAlign: "center",
        }}
      >
        The token is used to get, create and update the files between your vault
        and your GitHub repository. Click{" "}
        <a href="https://github.com/settings/personal-access-tokens">here</a> to
        create a new token. For more information about the tokens see{" "}
        <a href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token">
          the official GitHub documentation.
        </a>
      </p>
      <p
        style={{
          textAlign: "center",
        }}
      >
        The token must have the Contents Read and Write permissions for the same
        repository you set in the previous step.
      </p>
      <input
        type="text"
        spellCheck="false"
        placeholder="Token"
        style={{ width: "100%" }}
        value={values.token}
        onChange={(e) => onChange({ token: e.target.value })}
      />
    </div>
  );
};

const FoldersStepComponent = ({
  values = { repoFolder: "", vaultFolder: "" },
  onChange,
}: {
  values?: { repoFolder: string; vaultFolder: string };
  onChange: (values: { repoFolder: string; vaultFolder: string }) => void;
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexFlow: "column",
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <p style={{ textAlign: "center" }}>
        Optionally you can sync only part of your remote repository or your
        vault.
      </p>
      <p style={{ textAlign: "center" }}>
        Leave blank to sync the whole repository and the whole vault.
      </p>
      <div
        style={{
          display: "flex",
          flexFlow: "column",
          gap: "var(--size-4-2)",
        }}
      >
        <input
          type="text"
          spellCheck="false"
          placeholder="Repository folder"
          value={values.repoFolder}
          onChange={(e) => onChange({ ...values, repoFolder: e.target.value })}
          style={{ width: "100%" }}
        />
        <input
          type="text"
          spellCheck="false"
          placeholder="Vault folder"
          value={values.vaultFolder}
          onChange={(e) => onChange({ ...values, vaultFolder: e.target.value })}
          style={{ width: "100%" }}
        />
      </div>
    </div>
  );
};

const SyncSettingsStepComponent = ({
  values = { mode: "manual", syncOnStart: false, onConflict: "overwrite" },
  onChange,
}: {
  values?: {
    mode: "manual" | "interval";
    syncOnStart: boolean;
    onConflict: "ignore" | "ask" | "overwrite";
  };
  onChange: (values: {
    mode: "manual" | "interval";
    syncOnStart: boolean;
    onConflict: "ignore" | "ask" | "overwrite";
  }) => void;
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexFlow: "column",
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <p>
        You can sync your vault manually or every minute. You can change the
        interval at a later time.
      </p>
      <select
        className="dropdown"
        value={values.mode}
        onChange={(e) =>
          onChange({
            ...values,
            mode: e.target.value as typeof values.mode,
          })
        }
      >
        <option value="manual">Manually</option>
        <option value="interval">On Interval</option>
      </select>
      <p>Optionally you can sync every time you open Obsidian.</p>
      <div
        className={`checkbox-container ${values.syncOnStart ? "is-enabled" : ""}`}
        onClick={() =>
          onChange({ ...values, syncOnStart: !values.syncOnStart })
        }
      >
        <input type="checkbox" readOnly={true} checked={values.syncOnStart} />
      </div>
      <p>In case of conflicts you can choose how to handle them.</p>
      <p>
        This is not yet implemented so remote files will always overwrite local
        files in case of conflicts.
      </p>
      <select
        className="dropdown"
        disabled={true}
        value={values.onConflict}
        onChange={(e) =>
          onChange({
            ...values,
            onConflict: e.target.value as typeof values.onConflict,
          })
        }
      >
        <option value="ignore">Ignore remote file</option>
        <option value="ask">Ask</option>
        <option value="overwrite">Overwrite local file</option>
      </select>
    </div>
  );
};

const FirstSyncStepComponent = ({
  setIsValid,
}: {
  setIsValid: (valid: boolean) => void;
}) => {
  setIsValid(true);
  return (
    <div
      style={{
        display: "flex",
        flexFlow: "column",
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <p style={{ textAlign: "center" }}>
        Now we can sync your vault with your repository. This might take a few
        minutes depending on the size of your vault.
      </p>
      <div className="progress-bar">
        <div className="progress-bar-message u-center-text">
          Syncing vault...
        </div>
        <div className="progress-bar-indicator" style={{ width: "100%" }}>
          <div className="progress-bar-line"></div>
          <div className="progress-bar-subline mod-increase"></div>
          <div className="progress-bar-subline mod-decrease"></div>
        </div>
        <div className="progress-bar-context">
          <div>Show failure or success message here</div>
        </div>
      </div>
    </div>
  );
};

const OnBoardingComponent = () => {
  // It starts as true because the first step is just a welcome message
  // so the button is already enabled.
  const [isValid, setIsValid] = useState<boolean>(true);
  const [step, setStep] = useState<Step>("welcome");
  const [stepData, setStepData] = useState<StepData>({});

  const updateStepData = (step: Step, data: StepData[keyof StepData]) => {
    setStepData((stepData) => {
      return {
        ...stepData,
        [step]: data,
      };
    });
  };

  const isStepValid = (step: Step) => {
    switch (step) {
      // Only these steps have required data, the others don't
      // so the step is automatically valid
      case "repo":
        const { owner, repo, branch } = stepData.repo ?? {};
        return Boolean(owner && repo && branch);
      case "token":
        return Boolean(stepData.token?.token);
      case "sync":
      default:
        return true;
    }
  };

  useEffect(() => {
    setIsValid(isStepValid(step));
  }, [step, stepData]);

  const previousStep = () => {
    setStep((currentStep) => {
      const currentIndex = STEPS.indexOf(currentStep);
      return STEPS[currentIndex - 1] ?? STEPS[0];
    });
  };

  const nextStep = () => {
    setStep((currentStep) => {
      const currentIndex = STEPS.indexOf(currentStep);
      return STEPS[currentIndex + 1] ?? STEPS[STEPS.length - 1];
    });
  };

  const currentStepComponent = () => {
    switch (step) {
      case "welcome":
        return <WelcomeStepComponent />;
      case "repo":
        return (
          <RepoStepComponent
            values={stepData.repo}
            onChange={(data) => updateStepData("repo", data)}
          />
        );
      case "token":
        return (
          <TokenStepComponent
            values={stepData.token}
            onChange={(data) => updateStepData("token", data)}
          />
        );
      case "folders":
        return (
          <FoldersStepComponent
            values={stepData.folders}
            onChange={(data) => updateStepData("folders", data)}
          />
        );
      case "sync":
        return (
          <SyncSettingsStepComponent
            values={stepData.sync}
            onChange={(data) => updateStepData("sync", data)}
          />
        );
      case "first_sync":
        return <FirstSyncStepComponent setIsValid={setIsValid} />;
      // case "done":
      //   return <DoneStepComponent />;
    }
  };
  return (
    <div className="modal-content">
      <div
        style={{
          padding: "var(--size-4-18)",
          display: "flex",
          flexFlow: "column",
          flexGrow: 1,
          position: "relative",
        }}
      >
        <button
          className="mod-cta"
          style={{
            borderRadius: "50%",
            border: "none",
            padding: "8px",
            width: "fit-content",
            height: "fit-content",
            position: "absolute",
            left: "var(--size-4-4)",
            top: "50%",
            display: step === "welcome" ? "none" : "",
          }}
          onClick={previousStep}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            style={{ stroke: "var(--text-on-accent)" }}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-chevron-left"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        {currentStepComponent()}
        <button
          className="mod-cta"
          style={{
            borderRadius: "50%",
            border: "none",
            padding: "8px",
            width: "fit-content",
            height: "fit-content",
            position: "absolute",
            right: "var(--size-4-4)",
            top: "50%",
          }}
          disabled={!isValid}
          onClick={nextStep}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            style={{ stroke: "var(--text-on-accent)" }}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-chevron-right"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default OnBoardingComponent;
