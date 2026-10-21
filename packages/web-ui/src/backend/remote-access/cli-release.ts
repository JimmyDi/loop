import { RemoteAccessError } from "./errors";

export const cliVersion = "1.0.2115+e16833f284";

const releases: Record<string, { asset: string; sha256: string }> = {
  "win32-x64": {
    asset: "devtunnel.exe",
    sha256: "f11c797e90397a0a8e9bee711d500473632be27839deeb4fb3d0f5dbc6ffd2dc",
  },
  "darwin-arm64": {
    asset: "osx-arm64-devtunnel",
    sha256: "7cac9a23cbb5e7c17b33d38b9921c8b0c108337533980bdb24d56c0c6e4b54fe",
  },
  "darwin-x64": {
    asset: "osx-x64-devtunnel",
    sha256: "39e5cbfbb5b21a94f14bfa1500d7e531dc90ae047bfe96146c4e05ab5ae4a18c",
  },
  "linux-arm64": {
    asset: "linux-arm64-devtunnel",
    sha256: "b537f270a55d57f23b7621cec0b09806aa9ada119713b33e9255284179b76bde",
  },
  "linux-x64": {
    asset: "linux-x64-devtunnel",
    sha256: "723d6aebdc226064aef321258fb17c8a2770c9cc2bd05004c0fb83e72b302c3f",
  },
};

export const getCliRelease = (platform = process.platform, arch = process.arch) => {
  const release = releases[platform + "-" + arch];
  if (!release) throw new RemoteAccessError("unsupported_platform");
  return {
    ...release,
    version: cliVersion,
    url: "https://tunnelsassetsprod.blob.core.windows.net/cli/" + cliVersion + "/" + release.asset,
  };
};

export const supportsCli = (): boolean => {
  try {
    getCliRelease();
    return true;
  } catch {
    return false;
  }
};
