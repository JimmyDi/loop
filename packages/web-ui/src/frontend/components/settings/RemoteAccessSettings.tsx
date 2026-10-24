import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { RemoteAccessCommand } from "../../../shared/remote-access";
import { useRemoteAccess } from "../../hooks/useRemoteAccess";
import { ActionButton } from "../ui/ActionButton";
import { RemoteAccessInfo } from "./RemoteAccessInfo";
import { RemoteAccessIssue } from "./RemoteAccessIssue";
import { RemoteAccessMarker } from "./RemoteAccessMarker";
import { RemoteCliProgress } from "./RemoteCliProgress";
import { remoteAccessErrorStep } from "./remote-access-error";
import { remoteAccessIcons } from "./remote-access-icons";
import { remoteAccessProgress } from "./remote-access-progress";
import "./RemoteAccessSettings.css";

export const RemoteAccessSettings = ({
  children,
}: {
  children?: (connected: boolean) => ReactNode;
}) => {
  const { t } = useTranslation();
  const { query, execute, checking, pending, error } = useRemoteAccess();
  const [requested, setRequested] = useState<RemoteAccessCommand>();
  const [requestStep, setRequestStep] = useState(-1);
  const run = async (action: RemoteAccessCommand) => {
    setRequested(action);
    setRequestStep(
      {
        install: 0,
        uninstall: 0,
        login: 1,
        logout: 1,
        start: 2,
        stop: current,
        pause: 0,
        resume: 0,
      }[action],
    );
    try {
      await execute(action);
    } finally {
      setRequested(undefined);
    }
  };
  const status = query.data;
  const blocked = checking || pending || query.isError || !status?.supported;
  const progress = remoteAccessProgress(status, requested, requestStep);
  const { phase, active, connected, installing, accountActivity, activities } = progress;
  const { current, busyStep, canDisconnect } = progress;
  const installTitle = status?.installed ? "uninstall" : "install";
  const accountAction = status?.signedIn || accountActivity === "signing-out" ? "logout" : "login";
  const errorStep = remoteAccessErrorStep(status);
  const errorMessage =
    "remote.errors." + (status?.supported === false ? "unsupported_platform" : status?.error);
  const steps = [
    { title: installTitle, action: "install", complete: !!status?.installed, ready: true },
    {
      title: accountAction,
      action: "login",
      complete: !!status?.signedIn,
      ready: !!status?.installed,
    },
    {
      title: connected || phase === "stopping" ? "disconnect" : "start",
      action: "start",
      complete: connected,
      ready: !!status?.signedIn,
    },
  ] as const;

  return (
    <div className="remote-access-settings">
      <header className="remote-access-header">
        <h3 className="settings-section-title">{t("remoteAccess")}</h3>
        <RemoteAccessInfo />
      </header>
      <ol className="remote-access-steps" aria-label={t("remote.steps")}>
        {steps.map((step, index) => {
          const loading = (checking && status?.supported !== false) || busyStep === index;
          const failed =
            !!status?.failedSteps?.includes(step.action) || (query.isError && step.complete);
          return (
            <li key={step.action} data-complete={step.complete && !loading && !failed}>
              <RemoteAccessMarker complete={step.complete} loading={loading} failed={failed} />
              <div className="remote-access-step-content">
                <div className="remote-access-step-heading">
                  <span className="remote-access-step-number">
                    {t("remote.step", { number: index + 1 })}
                  </span>
                  <div className="remote-access-step-title">
                    <div className="remote-access-actions">
                      {[
                        ...(!step.complete && !(index === 2 && phase === "stopping")
                          ? [
                              {
                                action: index === 1 ? accountAction : step.action,
                                label: step.title,
                                disabled: blocked || active || !step.ready,
                              } as const,
                            ]
                          : []),
                        ...((index === 0 && status?.installed) || (index === 1 && status?.signedIn)
                          ? [
                              {
                                action: index === 0 ? ("uninstall" as const) : ("logout" as const),
                                label: index === 0 ? "uninstall" : "logout",
                                disabled: blocked || (active && !(index === 1 && connected)),
                              },
                            ]
                          : []),
                        ...(index === 2 && canDisconnect
                          ? [
                              {
                                action: "stop" as const,
                                label: "disconnect",
                                disabled: checking || pending || phase === "stopping",
                              },
                            ]
                          : []),
                      ].map(({ action, label, disabled }) => (
                        <span
                          className="remote-access-action"
                          key={action}
                          title={t("remote." + label)}
                        >
                          <ActionButton
                            className="icon ghost"
                            aria-label={t("remote." + label)}
                            title={t("remote." + label)}
                            disabled={disabled}
                            onClick={() => void run(action)}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d={remoteAccessIcons[action]} />
                            </svg>
                          </ActionButton>
                        </span>
                      ))}
                    </div>
                    <h4 title={t("remote." + step.title)}>{t("remote." + step.title)}</h4>
                    {activities[index] && <RemoteCliProgress activity={activities[index]} />}
                    {index === 0 && installing && (
                      <RemoteCliProgress
                        download={status?.download}
                        onTogglePause={() =>
                          void run(status?.download?.paused ? "resume" : "pause")
                        }
                        onCancel={() => void run("stop")}
                        controlsDisabled={checking || pending}
                        pauseDisabled={!status?.download}
                      />
                    )}
                    {errorStep === step.action && (
                      <RemoteAccessIssue
                        message={errorMessage}
                        warning={status?.supported === false}
                      />
                    )}
                    {!!error && requestStep === index && (
                      <RemoteAccessIssue message="remote.requestFailed" warning />
                    )}
                  </div>
                </div>
                <div className="remote-access-step-detail">
                  {active &&
                    !connected &&
                    current === index &&
                    index !== 1 &&
                    !activities[index] &&
                    !(index === 0 && installing) && (
                      <p role="status" className="remote-access-progress">
                        {t("remote.phases." + phase)}
                      </p>
                    )}
                </div>
              </div>
            </li>
          );
        })}
        {children?.(connected && !checking && !pending && !query.isError)}
      </ol>
      {!!query.error && <RemoteAccessIssue message="remote.requestFailed" warning />}
      {query.isError && (
        <ActionButton disabled={query.isFetching} onClick={() => void query.refetch()}>
          {t("retry")}
        </ActionButton>
      )}
    </div>
  );
};
