export type EchoAgent = { id: string; name: string; instructions: string; avatar?: string };

export type EchoConversation = {
  id: string;
  name: string;
  agentIds: string[];
  responderId: string;
  privateAgentId?: string;
  computerId?: string;
};

export type EchoConversationView = EchoConversation & { updatedAt?: string; preview?: string };

export type EchoConnection = {
  provider: "loop-sandbox";
  endpoint: string;
  tokenSaved?: boolean;
  idleSeconds: number;
  desktop: boolean;
};

export type EchoData = {
  version: 1;
  agents: EchoAgent[];
  conversations: EchoConversation[];
  connection?: EchoConnection;
};

export type EchoView = Omit<EchoData, "conversations"> & {
  conversations: EchoConversationView[];
};
