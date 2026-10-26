import type { VoiceComponent, VoicePlatform, VoiceResourceFile } from "./resource-types";

export const VOICE_RESOURCE_VERSION = "1-sherpa-2.0.0";
export const VOICE_ENGINE_VERSION = "1.0.0";

export const VOICE_ENGINE_LICENSE =
  "MIT; Apache-2.0; BSD; MPL-2.0; BSL-1.0; Unicode (see THIRD_PARTY_LICENSES.md)";

export const voicePlatform = (
  platform = process.platform,
  arch = process.arch,
): VoicePlatform | undefined => {
  const candidate = platform + "-" + arch;
  return ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "win32-x64"].includes(candidate)
    ? (candidate as VoicePlatform)
    : undefined;
};

const file = (
  repo: string,
  revision: string,
  path: string,
  sha256: string,
  bytes: number,
): VoiceResourceFile => ({
  path,
  url: "https://huggingface.co/csukuangfj/" + repo + "/resolve/" + revision + "/" + path,
  sha256,
  bytes,
});

const asrFile = (path: string, sha256: string, bytes: number) =>
  file(
    "sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20",
    "98590b7ed6443e77b714204da2757d75e1a642f4",
    path,
    sha256,
    bytes,
  );
const ttsFile = (path: string, sha256: string, bytes: number) =>
  file(
    "kokoro-int8-multi-lang-v1_1",
    "155831f1b4ba23b1f5c058be6a61df90cefb2a37",
    path,
    sha256,
    bytes,
  );

export const sourceVoiceModels: readonly VoiceComponent[] = [
  {
    id: "zipformer-zh-en-int8",
    name: "Zipformer Chinese / English int8",
    kind: "asr",
    version: "2023-02-20-98590b7",
    license: "Apache-2.0",
    files: [
      asrFile(
        "encoder-epoch-99-avg-1.int8.onnx",
        "8fa764187a261844f859d7143ebaa563af5d10adfece4c18a8f414c88cba2a9b",
        181895032,
      ),
      asrFile(
        "decoder-epoch-99-avg-1.int8.onnx",
        "1a70c593d71e53f023f5f55b0b4cfff5055abb786ee3992e5f63dc2e273cc4fa",
        13091040,
      ),
      asrFile(
        "joiner-epoch-99-avg-1.int8.onnx",
        "1ed689c5ed19dbaa725d9d191bb4822b5f4855a39e1ffd28cbc1f340d25b2ee0",
        3228404,
      ),
      asrFile(
        "tokens.txt",
        "a8e0e4ec53810e433789b54a5c0134a7eaa2ffca595a6334d54c00da858841d3",
        56317,
      ),
      {
        path: "LICENSE",
        url: "https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/8abb7c8f87eae85b2e75f9a4115236c978980add/LICENSE",
        sha256: "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30",
        bytes: 11358,
      },
    ],
  },
  {
    id: "silero-vad",
    name: "Silero voice activity detector",
    kind: "vad",
    version: "int8-c36d490",
    license: "MIT",
    files: [
      {
        path: "silero_vad.int8.onnx",
        url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.int8.onnx",
        sha256: "c36d490aff5ab924ca6c7aeec4d8f6bd3d22db6fa17611b9c5b17eae58ac3a20",
        bytes: 212860,
      },
      {
        path: "LICENSE",
        url: "https://raw.githubusercontent.com/snakers4/silero-vad/v6.2.1/LICENSE",
        sha256: "2e63e9a38b6e8fc0c7bc37ce174caca1862870856c6daf5697cfb785e925520b",
        bytes: 1075,
      },
    ],
  },
  {
    id: "kokoro-zh-en-int8",
    name: "Kokoro Chinese / English int8",
    kind: "tts",
    version: "1.1-155831f",
    license: "Apache-2.0; MIT",
    files: [
      ttsFile(
        "model.int8.onnx",
        "bda15858163726a492d02a9a727bc263551b86ac77f90812c4b30ff41d380e26",
        114299010,
      ),
      ttsFile(
        "voices.bin",
        "e64a5a581d8c2a350d848f51c3121657cd83aa07ed6109172177345874a7244c",
        53790720,
      ),
      ttsFile(
        "tokens.txt",
        "931ab2df2400cd65d580a22402024c2347ced8ae9ea300e545144b1aacc48e14",
        1111,
      ),
      ttsFile(
        "lexicon-us-en.txt",
        "7daaab53a181be9885b853a8582bf1838186317e5dadacbcef9c426d6fa0da14",
        5956885,
      ),
      ttsFile(
        "lexicon-zh.txt",
        "11111d8cd695fba2ace1367a1d0a708b586e6ef5c1f9be91da5d7eef129b651c",
        2119465,
      ),
      ttsFile("LICENSE", "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30", 11358),
      {
        path: "licenses/misaki.txt",
        url: "https://raw.githubusercontent.com/hexgrad/misaki/fba1236595f2d2bf21d414ba6e57d25256afada3/LICENSE",
        sha256: "c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4",
        bytes: 11357,
      },
      {
        path: "licenses/python-pinyin.txt",
        url: "https://raw.githubusercontent.com/mozillazg/python-pinyin/af3cc771ac768d366eddd838d7d5f6f2835142b8/LICENSE.txt",
        sha256: "1e6c90014b4912815c296ee64bb6f6280af47e6d4c5d80e86232dfc5defe764c",
        bytes: 1105,
      },
      {
        path: "licenses/pinyin-data.txt",
        url: "https://raw.githubusercontent.com/mozillazg/pinyin-data/9d05c9e29cb6a7e5c79f2f5279f5c1014246a19a/LICENSE",
        sha256: "9c048697be2502a16e8bcb282d5d465a07295b2def0ffb05a269c5d39dbe1586",
        bytes: 1076,
      },
      {
        path: "licenses/phrase-pinyin-data.txt",
        url: "https://raw.githubusercontent.com/mozillazg/phrase-pinyin-data/195893902791321fe38ae7b4ebdd9905389cfd41/LICENSE",
        sha256: "89ac55df747e4776088c3e77531ef61b973a1a59dd8e6a4548a58996da9a4f70",
        bytes: 1066,
      },
    ],
  },
];

export { publishedVoiceEngines, publishedVoiceModels } from "./published-catalog";
