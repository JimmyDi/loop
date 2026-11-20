import { spawnSync } from "node:child_process";

const service = "loop-sandbox";

export const credentialCommand = (
  mode: "read" | "write",
  account: string,
  token?: string,
): string => {
  const options = { encoding: "utf8" as const, timeout: 10_000, maxBuffer: 64 * 1024 };
  const result =
    process.platform === "darwin"
      ? mode === "read"
        ? spawnSync(
            "/usr/bin/security",
            ["find-generic-password", "-s", service, "-a", account, "-w"],
            options,
          )
        : spawnSync("/usr/bin/security", ["-i"], {
            ...options,
            input:
              "add-generic-password -U -s " +
              service +
              " -a " +
              account +
              " -X " +
              Buffer.from(token!).toString("hex") +
              "\n",
          })
      : process.platform === "linux"
        ? spawnSync(
            "secret-tool",
            mode === "read"
              ? ["lookup", "service", service, "account", account]
              : ["store", "--label=Loop Sandbox", "service", service, "account", account],
            { ...options, input: mode === "write" ? token : undefined },
          )
        : undefined;
  if (
    !result ||
    result.error ||
    result.status !== 0 ||
    (mode === "write" && result.stderr?.includes("SecKeychain"))
  )
    throw new Error(
      "OS credential store unavailable. Use --file explicitly or configure LOOP_SANDBOX_TOKEN.",
    );
  return result.stdout.trim();
};
