import { BooleanStateStore } from "./boolean-state-store";

/** Last successful sign-in only; credentials remain in the CLI account store. */
export class SignInStore extends BooleanStateStore {
  constructor(file: string) {
    super(file, "signedIn", "sign_in_state_failed");
  }
}
