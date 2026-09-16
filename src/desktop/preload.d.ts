export {};
declare global {
  interface Window {
    loop: {
      run(request: {
        prompt: string;
        provider?: string;
        model?: string;
      }): Promise<{ output?: string }>;
      history(): Promise<unknown>;
      health(): Promise<{ ok: boolean }>;
    };
  }
}
