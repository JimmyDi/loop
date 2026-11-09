import { create } from "zustand";

import type { Account } from "../../shared/accounts";

export const useAccount = create<{ user: Account | null }>(() => ({ user: null }));
