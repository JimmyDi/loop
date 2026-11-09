import { getAgentDir, VoiceResourceManager } from "@loop/coding-agent";

import { createProfileService } from "../profile-service";
import type { BusinessContext, BusinessHandler } from "../http/business-context";
import type { VoiceUpgradeHandler } from "../http/voice-upgrade-types";
import { HttpError } from "../http/errors";

/** Only the authenticated private worker may supply this trusted identity. */
export const createBusinessService = () => {
  const root = getAgentDir();
  const resources = new VoiceResourceManager(root);
  const services = new Map<string, ReturnType<typeof createProfileService>>();
  const revoked = new Set<string>();
  const serviceFor = (context?: BusinessContext) => {
    if (!context?.userId || revoked.has(context.principal))
      throw new HttpError(401, "account_unauthorized");
    let service = services.get(context.userId);
    if (!service) {
      service = createProfileService(root, context.userId, resources);
      services.set(context.userId, service);
    }
    return service;
  };
  const handle: BusinessHandler = (request, context) =>
    serviceFor(context).handle(request, context);
  const connect: VoiceUpgradeHandler = (socket, id, context) =>
    serviceFor(context).voice.connect(socket, id, context);
  return {
    handle,
    voice: {
      connect,
      revoke: async (principal: string) => {
        revoked.add(principal);
        await Promise.all([...services.values()].map((service) => service.voice.revoke(principal)));
      },
    },
    close: async () => {
      await Promise.all([...services.values()].map((service) => service.close()));
    },
  };
};
