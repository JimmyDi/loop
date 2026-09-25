export const openBrowser = async (url: string): Promise<void> => {
  const command =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["rundll32", "url.dll,FileProtocolHandler", url]
        : ["xdg-open", url];
  const child = Bun.spawn(command, { stdout: "ignore", stderr: "ignore" });

  if ((await child.exited) !== 0) throw new Error("Browser could not be opened");
};
