import { join } from "node:path";

import { supportsCli } from "./cli-release";
import { createCliRuntime } from "./cli-runtime";
import { RemoteAccessController } from "./controller";
import { ConnectionStore } from "./connection-store";
import { SignInStore } from "./sign-in-store";

export const createRemoteAccess = async (
  agentDir: string,
  ingressFactory?: Parameters<typeof createCliRuntime>[1],
): Promise<RemoteAccessController> => {
  const signIn = new SignInStore(join(agentDir, "web-ui", "remote-access", "sign-in.json"));
  const connection = new ConnectionStore(
    join(agentDir, "web-ui", "remote-access", "connection.json"),
  );
  const [signedIn, enabled] = await Promise.all([signIn.read(), connection.read()]);
  const controller = new RemoteAccessController({
    supported: supportsCli(),
    signedIn,
    saveSignIn: (signedIn) => signIn.save(signedIn),
    saveConnection: (enabled) => connection.save(enabled),
    runtime: () =>
      ingressFactory
        ? createCliRuntime(join(agentDir, "bin", "devtunnel"), ingressFactory)
        : createCliRuntime(join(agentDir, "bin", "devtunnel")),
  });
  if (enabled) controller.restore();
  return controller;
};
