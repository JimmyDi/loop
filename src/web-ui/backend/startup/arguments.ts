export const parseArguments = (args: readonly string[]) => {
  let port = 3080;
  let open = true;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--no-open") open = false;
    else if (arg === "--help" || arg === "-h") help = true;
    else if (arg === "--port") {
      const value = args[++i] ?? "";

      if (!/^\d+$/.test(value) || Number(value) > 65535) throw new Error("Invalid port");

      port = Number(value);
    } else throw new Error("Unknown option: " + arg);
  }

  return { port, open, help };
};
