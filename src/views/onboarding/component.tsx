import { useState, useEffect } from "react";

type Step =
  | "welcome"
  | "repo"
  | "token"
  | "folders"
  | "sync"
  | "interface"
  | "first_sync"
  | "done";

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
  setIsValid,
}: {
  setIsValid: (valid: boolean) => void;
}) => {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("");

  useEffect(() => {
    setIsValid(
      owner.trim() !== "" && repo.trim() !== "" && branch.trim() !== "",
    );
  }, [owner, repo, branch]);

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
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        />
        <input
          type="text"
          spellCheck="false"
          placeholder="Repository"
          style={{ width: "100%" }}
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
        />
        <input
          type="text"
          spellCheck="false"
          placeholder="Branch"
          style={{ width: "100%" }}
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
        />
      </div>
    </div>
  );
};

const TokenStepComponent = ({
  setIsValid,
}: {
  setIsValid: (valid: boolean) => void;
}) => {
  const [token, setToken] = useState("");

  useEffect(() => {
    setIsValid(token.trim() !== "");
  }, [token]);

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
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
    </div>
  );
};

const FoldersStepComponent = () => {
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
          style={{ width: "100%" }}
        />
        <input
          type="text"
          spellCheck="false"
          placeholder="Vault folder"
          style={{ width: "100%" }}
        />
      </div>
    </div>
  );
};

const SyncSettingsStepComponent = () => {
  const [syncMode, setSyncMode] = useState<"manual" | "interval">("manual");
  const [syncOnStart, setSyncOnStart] = useState(false);
  const [onConflict, setOnConflict] = useState<"ignore" | "ask" | "overwrite">(
    "overwrite",
  );

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
        value={syncMode}
        onChange={(e) => setSyncMode(e.target.value)}
      >
        <option value="manual">Manually</option>
        <option value="interval">On Interval</option>
      </select>
      <p>Optionally you can sync every time you open Obsidian.</p>
      <div
        className={`checkbox-container ${syncOnStart ? "is-enabled" : ""}`}
        onClick={() => setSyncOnStart(!syncOnStart)}
      >
        <input type="checkbox" checked={syncOnStart} />
      </div>
      <p>In case of conflicts you can choose how to handle them.</p>
      <p>
        This is not yet implemented so remote files will always overwrite local
        files in case of conflicts.
      </p>
      <select
        className="dropdown"
        disabled={true}
        value={onConflict}
        onChange={(e) => setOnConflict(e.target.value)}
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
  const [step, setStep] = useState<Step>("welcome");

  // It starts as true because the first step is just a welcome message
  // so the button is already enabled.
  const [isValid, setIsValid] = useState(true);

  const previousStep = () => {
    setStep((step) => {
      switch (step) {
        case "welcome":
          return "welcome";
        case "repo":
          // Reset the valid state to true since we come back to welcome
          setIsValid(true);
          return "welcome";
        case "token":
          return "repo";
        case "folders":
          return "token";
        case "sync":
          return "folders";
        case "interface":
          return "sync";
        case "first_sync":
          return "interface";
        case "done":
          return "done";
      }
    });
  };

  const nextStep = () => {
    setStep((step) => {
      switch (step) {
        case "welcome":
          return "repo";
        case "repo":
          return "token";
        case "token":
          return "folders";
        case "folders":
          return "sync";
        case "sync":
          return "interface";
        case "interface":
          return "first_sync";
        case "first_sync":
          return "done";
        case "done":
          return "done";
      }
    });
  };

  const currentStepComponent = () => {
    switch (step) {
      case "welcome":
        return <WelcomeStepComponent />;
      case "repo":
        return <RepoStepComponent setIsValid={setIsValid} />;
      case "token":
        return <TokenStepComponent setIsValid={setIsValid} />;
      case "folders":
        return <FoldersStepComponent />;
      case "sync":
        return <SyncSettingsStepComponent />;
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
