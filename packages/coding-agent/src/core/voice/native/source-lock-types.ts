export type SourceLockFile = [path: string, bytes: number, blobSha1: string, sha256: string];

export type SourceLock = {
  version: number;
  revision: string;
  files: SourceLockFile[];
};
