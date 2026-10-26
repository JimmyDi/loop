# Native voice dependencies

The Loop sidecar is MIT licensed. Native bundles retain the workspace notice
in licenses/loop.txt, the dependency notices below and their linked notices.
Model bundles are separate resources and retain their own notices.

## Source-built macOS ARM64 engine

The source build uses sherpa-onnx 2.0.0 at commit
8abb7c8f87eae85b2e75f9a4115236c978980add and ONNX Runtime 1.28.2 at commit
33ca9628233dc8f002435e868d4c2e9f82766ca1. Public source:

- https://github.com/k2-fsa/sherpa-onnx/tree/8abb7c8f87eae85b2e75f9a4115236c978980add
- https://github.com/microsoft/onnxruntime/tree/33ca9628233dc8f002435e868d4c2e9f82766ca1

The build applies compiler prefix maps, disables automatic absolute dependency
RPATH insertion in sherpa, and removes ONNX Runtime filename version aliases.
These build changes do not alter inference code. The build scripts, checked
patch contexts and complete source/dependency pins are distributed with Loop's
repository under packages/coding-agent/src/core/voice/native.

The sherpa C API statically links these source dependencies; their retained
license texts are included individually in licenses/:

| Dependency | Version | Public source |
| --- | --- | --- |
| kaldi-native-fbank | 1.22.4 | https://github.com/csukuangfj/kaldi-native-fbank/tree/v1.22.4 |
| kaldi-decoder | 0.3.0 | https://github.com/k2-fsa/kaldi-decoder/tree/v0.3.0 |
| kaldifst | 1.8.0 | https://github.com/k2-fsa/kaldifst/tree/v1.8.0 |
| OpenFst | 1.8.5-2026-07-09 | https://github.com/csukuangfj/openfst/tree/v1.8.5-2026-07-09 |
| Eigen | 5.0.1 | https://gitlab.com/libeigen/eigen/-/tree/5.0.1 |
| utf8proc | 2.12.0 | https://github.com/JuliaStrings/utf8proc/tree/v2.12.0 |
| simple-sentencepiece | 0.7 | https://github.com/pkufool/simple-sentencepiece/tree/v0.7 |
| kissfft | febd4caeed32e33ad8b2e0bb5ea77542c40f18ec | https://github.com/mborgerding/kissfft/tree/febd4caeed32e33ad8b2e0bb5ea77542c40f18ec |
| nlohmann/json | 3.12.0 | https://github.com/nlohmann/json/tree/v3.12.0 |

ONNX Runtime retains its MIT license, upstream ThirdPartyNotices.txt and an
additional onnxruntime-linked-dependencies.txt containing the top-level license,
notice and author files copied from the exact source dependencies in the build.
The pinned dependency archive manifest records abseil-cpp 20250814.0, re2
2024-07-02, protobuf 21.12, date 3.0.1, mp11 1.82.0, nlohmann/json 3.11.3,
cpuinfo 4628dc060ce4e82345dc166bbac875609db4ff69, GSL 4.2.1, SafeInt 3.0.28,
FlatBuffers 23.5.26, ONNX 1.22.0 and Eigen 1d8b82b0740839c0de7f1242a3585e3390ff5f33.
The protobuf compiler is a build-only pinned 21.12 tool. Licenses include MIT,
Apache-2.0, BSD variants, MPL-2.0, Boost and Unicode terms; retained texts govern.

Other native targets use their pinned upstream builds and still require actual
platform inference validation, binary privacy scanning and matching linked
dependency notice review before publication. Successful packaging is not a
license audit.

## Models and dictionary data

Bilingual Zipformer uses Apache-2.0, Silero VAD uses MIT, and Kokoro 1.1 uses
Apache-2.0 with bundled dictionary notices. The selected sherpa 2.0.0 Kokoro
frontend uses lexicons; no espeak-ng code or data is included by Loop. Legacy
metadata and error strings can still mention external phonemizers.

Retained dictionary notices and the limits of historical export provenance are
documented in [Kokoro resources](licenses/kokoro-resources.md).
