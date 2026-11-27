import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { desktopIconSizes, encodeIcns, encodeIco } from "./desktop-icon-formats";

export const ensureDesktopIcons = async (desktop: string, pnpm: string): Promise<void> => {
  const source = join(desktop, "assets/icon.png");
  const native = join(desktop, "src-tauri");
  const config = JSON.parse(await readFile(join(native, "tauri.conf.json"), "utf8"));
  const icons: string[] = config.bundle.icon;
  const { mtimeMs } = await stat(source);
  const current = await Promise.all(
    icons.map(async (icon) => {
      try {
        return (await stat(join(native, icon))).mtimeMs >= mtimeMs;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw error;
      }
    }),
  );
  if (current.every(Boolean)) return;

  const tools = join(desktop, ".tools");
  await mkdir(tools, { recursive: true });
  const staging = await mkdtemp(join(tools, "desktop-icons-"));
  try {
    execFileSync(
      process.execPath,
      [
        pnpm,
        "exec",
        "tauri",
        "icon",
        source,
        "--output",
        staging,
        ...desktopIconSizes.flatMap((size) => ["--png", String(size)]),
      ],
      { cwd: desktop, stdio: "inherit" },
    );
    const images = new Map(
      await Promise.all(
        desktopIconSizes.map(
          async (size) =>
            [size, await readFile(join(staging, size + "x" + size + ".png"))] as const,
        ),
      ),
    );
    const png = (size: number): Buffer => {
      const image = images.get(size);
      if (!image) throw new Error("Missing Desktop icon PNG for size " + size);
      return image;
    };
    await Promise.all([
      writeFile(join(staging, "icon.icns"), encodeIcns(png)),
      writeFile(join(staging, "icon.ico"), encodeIco(png)),
    ]);
    for (const icon of icons) {
      const destination = join(native, icon);
      await mkdir(dirname(destination), { recursive: true });
      await rename(join(staging, basename(icon)), destination);
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
};
