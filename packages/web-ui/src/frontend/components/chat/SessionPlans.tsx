import type { SessionSnapshot } from "../../../shared/protocol";
import { PlanResultCard } from "./PlanResultCard";
import "./SessionPlans.css";

export const SessionPlans = ({
  plans,
}: {
  plans: NonNullable<SessionSnapshot["state"]["planning"]>["plans"];
}) => {
  return (
    <div className="session-plans">
      {plans.map((plan) => (
        <PlanResultCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
};
