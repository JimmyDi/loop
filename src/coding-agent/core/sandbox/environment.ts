/** Avoid forwarding credentials and shell/loader startup hooks to confined children. */
export const sandboxEnvironment = (temporary: string): Record<string, string> => {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    TMPDIR: temporary,
    TMP: temporary,
    TEMP: temporary,
  };
  for (const key of ["HOME", "LANG", "LC_ALL", "TERM", "TZ"]) {
    if (process.env[key] !== undefined) env[key] = process.env[key]!;
  }
  return env;
};
