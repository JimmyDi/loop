import type { VoiceSourceDependency } from "./source-dependency-types";

export const sherpaSource = {
  revision: "8abb7c8f87eae85b2e75f9a4115236c978980add",
  sha256: "a5a7aac23fdc35fc4caf12e5a8ba63dc425ddb414904640bf13c4e7f38c3632b",
};

export const sherpaSourceDependencies: readonly VoiceSourceDependency[] = [
  {
    name: "kaldi-native-fbank",
    url: "https://github.com/csukuangfj/kaldi-native-fbank/archive/refs/tags/v1.22.4.tar.gz",
    sha256: "257fea639585ca6ee00860493bb9d7ab32488b8a5407ffe434c1f361ea545fae",
    licenses: ["LICENSE"],
  },
  {
    name: "utf8proc",
    url: "https://github.com/JuliaStrings/utf8proc/archive/refs/tags/v2.12.0.tar.gz",
    sha256: "f564011d38b2888d583d510b08e69ffa15aa117155db1b9b49ef1dfe1fa25111",
    licenses: ["LICENSE.md"],
  },
  {
    name: "kaldi-decoder",
    url: "https://github.com/k2-fsa/kaldi-decoder/archive/refs/tags/v0.3.0.tar.gz",
    sha256: "b9f34cfb4fd3b1344100eead79ef4d37aa15962274b9e3056de345021f76a1b0",
    licenses: ["LICENSE"],
  },
  {
    name: "simple-sentencepiece",
    url: "https://github.com/pkufool/simple-sentencepiece/archive/refs/tags/v0.7.tar.gz",
    sha256: "1748a822060a35baa9f6609f84efc8eb54dc0e74b9ece3d82367b7119fdc75af",
    licenses: ["LICENSE"],
  },
  {
    name: "json",
    url: "https://github.com/nlohmann/json/archive/refs/tags/v3.12.0.tar.gz",
    sha256: "4b92eb0c06d10683f7447ce9406cb97cd4b453be18d7279320f7b2f025c10187",
    licenses: ["LICENSE.MIT"],
  },
  {
    name: "eigen",
    url: "https://gitlab.com/libeigen/eigen/-/archive/5.0.1/eigen-5.0.1.tar.gz",
    sha256: "e9c326dc8c05cd1e044c71f30f1b2e34a6161a3b6ecf445d56b53ff1669e3dec",
    licenses: [
      "LICENSE",
      "COPYING.BSD",
      "COPYING.APACHE",
      "COPYING.MPL2",
      "COPYING.README",
      "COPYING.MINPACK",
    ],
  },
  {
    name: "openfst",
    url: "https://github.com/csukuangfj/openfst/archive/refs/tags/v1.8.5-2026-07-09.tar.gz",
    sha256: "2ff712a32952fcb01d351121a6bc8ccf4fdc6b2aa06ce8df2b3095dedd518c0e",
    licenses: ["COPYING", "AUTHORS"],
  },
  {
    name: "kaldifst",
    url: "https://github.com/k2-fsa/kaldifst/archive/refs/tags/v1.8.0.tar.gz",
    sha256: "3f247b7e5a2409071202f5e2bc6200060f66728c0a3443c03923ad2723e040b3",
    licenses: ["LICENSE"],
  },
  {
    name: "kissfft",
    url: "https://github.com/mborgerding/kissfft/archive/febd4caeed32e33ad8b2e0bb5ea77542c40f18ec.zip",
    sha256: "497103e664168ebe39580b757adbe616f6cf85a16572af581ca7bc42d0ab13fd",
    licenses: ["COPYING"],
  },
];
