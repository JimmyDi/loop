import { createReadStream } from "node:fs";
import { join } from "node:path";
import type { VoiceReleaseScanInput } from "./release-assets-types";

const pathMarkers = [
  "/Users/",
  "/home/",
  "/root/",
  "/user/",
  "\\Users\\",
  "/Documents and Settings/",
];
const markers = pathMarkers.flatMap((marker) => [
  Buffer.from(marker.toLowerCase()),
  Buffer.from(marker.toLowerCase(), "utf16le"),
  Buffer.from(marker.toLowerCase(), "utf16le").swap16(),
]);
const overlapBytes = Math.max(...markers.map((marker) => marker.length)) - 1;

export const assertReleaseFilesClean = async (
  directory: string,
  component: VoiceReleaseScanInput,
): Promise<void> => {
  for (const file of component.files) {
    let previous = Buffer.alloc(0);
    for await (const chunk of createReadStream(join(directory, file.path))) {
      const bytes = Buffer.concat([previous, chunk as Buffer]);
      const ascii = Buffer.from(bytes);
      for (let index = 0; index < ascii.length; index++) {
        const value = ascii[index]!;
        if (value >= 65 && value <= 90) ascii[index] = value + 32;
      }
      if (markers.some((marker) => ascii.includes(marker)))
        throw new Error("voice_release_embedded_home_path");
      previous = bytes.subarray(Math.max(0, bytes.length - overlapBytes));
    }
  }
};
