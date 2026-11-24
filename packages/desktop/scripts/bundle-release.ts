import { execFileSync } from "node:child_process";
import { readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const desktop = resolve(import.meta.dirname, "..");
const platformSigning = !process.argv.includes("--no-platform-signing");
const required = ["LOOP_UPDATER_URL", "LOOP_UPDATER_PUBLIC_KEY", "TAURI_SIGNING_PRIVATE_KEY"];
if (platformSigning)
  required.push(
    ...(process.platform === "darwin"
      ? [
          "APPLE_CERTIFICATE",
          "APPLE_CERTIFICATE_PASSWORD",
          "APPLE_SIGNING_IDENTITY",
          "APPLE_ID",
          "APPLE_PASSWORD",
          "APPLE_TEAM_ID",
        ]
      : ["WINDOWS_CERTIFICATE", "WINDOWS_CERTIFICATE_PASSWORD"]),
  );
for (const name of required)
  if (!process.env[name]) throw new Error("Release configuration missing " + name);
const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error("Run through pnpm exec");
const run = (args: string[]) =>
  execFileSync(process.execPath, [pnpm, ...args], { cwd: desktop, stdio: "inherit" });
const cert = join(desktop, ".tools/signing-certificate");
const keychain = join(desktop, ".tools/build.keychain-db");
try {
  run(["build"]);
  const path = join(desktop, ".tools/tauri-build.json");
  const config = JSON.parse(await readFile(path, "utf8"));
  if (platformSigning && process.platform === "darwin") {
    await writeFile(cert, Buffer.from(process.env.APPLE_CERTIFICATE!, "base64"), { mode: 0o600 });
    const password = crypto.randomUUID();
    execFileSync("security", ["create-keychain", "-p", password, keychain], { stdio: "ignore" });
    execFileSync("security", ["unlock-keychain", "-p", password, keychain], { stdio: "ignore" });
    execFileSync(
      "security",
      [
        "import",
        cert,
        "-k",
        keychain,
        "-P",
        process.env.APPLE_CERTIFICATE_PASSWORD!,
        "-T",
        "/usr/bin/codesign",
      ],
      { stdio: "ignore" },
    );
    execFileSync(
      "security",
      [
        "set-key-partition-list",
        "-S",
        "apple-tool:,apple:,codesign:",
        "-s",
        "-k",
        password,
        keychain,
      ],
      { stdio: "ignore" },
    );
    execFileSync("security", ["list-keychains", "-d", "user", "-s", keychain]);
    execFileSync(
      "codesign",
      [
        "--force",
        "--sign",
        process.env.APPLE_SIGNING_IDENTITY!,
        "--options",
        "runtime",
        "--timestamp",
        "--entitlements",
        join(desktop, "src-tauri/Node.entitlements.plist"),
        join(desktop, "dist/runtime/node"),
      ],
      { stdio: "inherit" },
    );
    config.bundle.macOS = {
      signingIdentity: process.env.APPLE_SIGNING_IDENTITY,
      hardenedRuntime: true,
    };
  } else if (platformSigning) {
    await writeFile(cert, Buffer.from(process.env.WINDOWS_CERTIFICATE!, "base64"), { mode: 0o600 });
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$password = ConvertTo-SecureString $env:WINDOWS_CERTIFICATE_PASSWORD -AsPlainText -Force; $cert = Import-PfxCertificate -FilePath $env:LOOP_SIGNING_CERTIFICATE -CertStoreLocation Cert:\\CurrentUser\\My -Password $password; $cert.Thumbprint | Out-File -Encoding ascii $env:LOOP_SIGNING_THUMBPRINT",
      ],
      {
        env: {
          ...process.env,
          LOOP_SIGNING_CERTIFICATE: cert,
          LOOP_SIGNING_THUMBPRINT: cert + ".thumbprint",
        },
        stdio: "ignore",
      },
    );
    config.bundle.windows = {
      certificateThumbprint: (await readFile(cert + ".thumbprint", "utf8")).trim(),
      digestAlgorithm: "sha256",
      timestampUrl: "http://timestamp.digicert.com",
    };
  }
  await writeFile(path, JSON.stringify(config, null, 2));
  run([
    "tauri",
    "build",
    "--config",
    ".tools/tauri-build.json",
    "--bundles",
    process.argv[2] ?? "app,dmg",
  ]);
} finally {
  await rm(cert, { force: true });
  await rm(cert + ".thumbprint", { force: true });
  if (platformSigning && process.platform === "darwin") {
    try {
      execFileSync("security", ["delete-keychain", keychain], { stdio: "ignore" });
    } catch {
      /* The keychain may not have been created. */
    }
  }
}
