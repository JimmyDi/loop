import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { chmod, lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import { join } from "node:path";

import type { DownloadProgress } from "./cli-download";
import { CliDownload } from "./cli-download";
import { getCliRelease } from "./cli-release";
import { RemoteAccessError } from "./errors";

export class CliInstaller {
  readonly file: string;
  private download?: CliDownload;

  constructor(
    private readonly directory: string,
    private readonly release = getCliRelease(),
  ) {
    this.file = join(
      directory,
      release.version,
      process.platform === "win32" ? "devtunnel.exe" : "devtunnel",
    );
  }

  async installed(signal?: AbortSignal): Promise<boolean> {
    try {
      if (!(await lstat(this.file)).isFile()) return false;
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(this.file, { signal })) hash.update(chunk);
      return hash.digest("hex") === this.release.sha256;
    } catch (error) {
      signal?.throwIfAborted();
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw new RemoteAccessError("cli_install_failed");
    }
  }

  async install(signal: AbortSignal, progress: (value: DownloadProgress) => void): Promise<void> {
    if (await this.installed(signal)) return;
    const folder = join(this.directory, this.release.version);
    const temporary = join(folder, randomUUID() + ".download");
    try {
      await mkdir(folder, { recursive: true, mode: 0o700 });
      const handle = await open(temporary, "wx", 0o600);
      try {
        let downloaded: DownloadProgress = { received: 0 };
        this.download = new CliDownload(this.release.url, handle, signal, (value) => {
          downloaded = value;
          progress(value);
        });
        await this.download.run();
        this.download = undefined;
        signal.throwIfAborted();
        progress({ ...downloaded, stage: "verifying", paused: false });
        const hash = createHash("sha256");
        for await (const chunk of createReadStream(temporary, { signal })) hash.update(chunk);
        if (hash.digest("hex") !== this.release.sha256)
          throw new RemoteAccessError("cli_integrity_failed");
        await handle.sync();
      } finally {
        this.download = undefined;
        await handle.close();
      }
      signal.throwIfAborted();
      if (process.platform !== "win32") await chmod(temporary, 0o700);
      await rename(temporary, this.file);
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof RemoteAccessError) throw error;
      throw new RemoteAccessError("cli_install_failed");
    } finally {
      await unlink(temporary).catch(() => {});
    }
  }

  pause(paused: boolean): boolean {
    return this.download?.pause(paused) ?? false;
  }

  async uninstall(): Promise<void> {
    try {
      await unlink(this.file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        throw new RemoteAccessError("cli_uninstall_failed");
    }
  }
}
