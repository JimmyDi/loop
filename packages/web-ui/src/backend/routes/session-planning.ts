import { startPlanExecution } from "../session-plan-execution";
import type { SessionController } from "../session-controller";
import { isSessionMode } from "@loop/coding-agent";

import { HttpError } from "../http/errors";
import { pageSnapshot } from "../../shared/session-history";

export const planningRoute = async (
  request: Request,
  action: string | undefined,
  body: Record<string, unknown>,
  controller: SessionController,
): Promise<Response | undefined> => {
  const method = request.method;
  if (action === "skip-plan" && method === "POST") {
    if (
      !controller.session.skipPlan ||
      typeof body.id !== "string" ||
      !Number.isSafeInteger(body.version)
    )
      throw new HttpError(400, "invalid_plan");
    const plan = controller.session.state.planning?.plans.at(-1);
    if (
      controller.busy ||
      controller.session.state.isRunning ||
      !!controller.session.state.queue?.length ||
      controller.session.state.planning?.mode !== "plan" ||
      plan?.status !== "ready" ||
      plan.id !== body.id ||
      plan.version !== body.version
    )
      throw new HttpError(409, "plan_not_ready");
    await controller.command("mode", () =>
      controller.session.skipPlan!(body.id as string, body.version as number),
    );
    return Response.json(pageSnapshot(controller.snapshot));
  }
  if (action === "execute-plan" && method === "POST") {
    if (
      !controller.session.executePlan ||
      typeof body.id !== "string" ||
      !Number.isSafeInteger(body.version)
    )
      throw new HttpError(400, "invalid_plan");
    const plan = controller.session.state.planning?.plans.at(-1);
    if (
      controller.busy ||
      controller.session.state.isRunning ||
      !!controller.session.state.queue?.length ||
      controller.session.state.planning?.mode !== "plan" ||
      plan?.status !== "ready" ||
      plan.id !== body.id ||
      plan.version !== body.version
    )
      throw new HttpError(409, "plan_not_ready");
    startPlanExecution(controller, body.id, body.version as number);
    return Response.json({ accepted: true }, { status: 202 });
  }
  if (action === "mode" && method === "PUT") {
    if (!isSessionMode(body.mode) || !controller.session.setMode)
      throw new HttpError(400, "invalid_mode");
    const mode = body.mode;
    await controller.command("mode", () => controller.session.setMode!(mode));
  }
  if (action !== "mode" && action !== "execute-plan" && action !== "skip-plan") return undefined;
  if (action === "mode" && method === "PUT")
    return Response.json(pageSnapshot(controller.snapshot));
  throw new HttpError(405, "method_not_allowed");
};
