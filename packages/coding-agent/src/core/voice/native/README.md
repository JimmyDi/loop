# Native voice resources

The Node application manages a separate CPU sidecar. End users need Node.js 24,
not Python, a compiler, Homebrew, Docker, or global library configuration.
Voice resources are optional and excluded from the npm distribution.

## Build and local validation

Development and CI require a C++17 compiler, CMake, a build tool, Python 3.10 or
newer and archive tools. The validated macOS ARM64 release path builds both
sherpa-onnx and ONNX Runtime from source. From the workspace root:

```bash
node --import tsx packages/coding-agent/src/core/voice/native/build-clean.ts
node --import tsx packages/coding-agent/src/core/voice/native/prepare-models.ts
node --conditions=loop-source --import tsx packages/coding-agent/src/core/voice/native/import-local.ts .tools/voice/build/darwin-arm64 .tools/voice/model-assets/models
```

The source builder uses the pinned sherpa-onnx 2.0.0 commit and verifies every
linked dependency archive. ONNX Runtime 1.28.2 source is fetched from a fixed
public commit using the checked-in source lock: each file has a byte count, Git
blob SHA-1 and SHA-256. This locally recorded lock pins the reviewed public
source; it is not an upstream signature. Build data and downloads stay in .tools.
Only the necessary source directories are fetched; no Git executable is invoked.
Optional LOOP_VOICE_CMAKE and LOOP_VOICE_NINJA select existing developer tools.

Compiler file, macro and debug prefix maps keep build roots out of diagnostics.
One checked source patch disables sherpa's absolute dependency RPATH insertion;
another removes ONNX Runtime's versioned filename aliases so the bundle carries
one runtime library. Both use relative library names and preserve runtime
version reporting. Missing patch context fails the build. Tests, Python bindings,
hardware providers and Git discovery are disabled. The builder also verifies
the JSON header used by the sidecar. It
copies only the C API and ONNX Runtime libraries, uses relative library loading,
and writes engine-manifest.json with every included file's digest. Source model
metadata pins the bilingual int8 Zipformer and Kokoro revisions, Silero int8,
and necessary tokens, voices, English/Chinese lexicons and license files.
No full-precision duplicates or espeak-ng data are included.
Model preparation creates each file's parent directories, including nested license
directories, before downloading; existing files are reused only after size and
SHA-256 verification.

import-local is a developer-only filesystem operation. It checks the supported
platform, protocol, engine version and every declared file before copying.
Model files must match the built-in catalog exactly. It accepts no download URL
or command and is not exposed through the browser API. The engine manifest is
local trust input, not a signature; import only a build produced by this source
and reviewed dependencies.

## Release assets

The voice-native workflow builds darwin-arm64 automatically when resource inputs
change on main, or on voice-vX.Y.Z tag pushes. Watched inputs include native source,
dependency locks, patches, model catalog, download validation, resource/protocol
contracts and the workflow itself. Native tests and documentation are excluded;
retained licenses are included. Ordinary frontend and Agent changes do not trigger it.
Each matching main push rebuilds all engine and model bundles using the semantic
version in resources/release-version.ts, targeting that exact source commit.
Bump major for incompatible contracts, minor for compatible features/models and
patch for fixes before publishing changed resources. Reruns keep the
same tag and cannot overwrite an existing release. This monitors checked-in inputs,
not upstream releases; upstream updates require changing the pinned inputs first.
Manual runs accept a comma-separated targets allowlist, defaulting to
darwin-arm64, and only prepare artifacts. It validates the list before generating
the build matrix for selected macOS/Linux x64 and ARM64 or Windows x64 CPU bundles,
three model bundles, SHA-256 and expanded
file manifests, and a published-catalog.ts candidate. It uploads CI artifacts
for all entry points. Main and tag pushes additionally publish verified archives, manifests,
SHA256SUMS and the catalog candidate to GitHub Releases. Publication stages a draft
before making it public and refuses to replace an existing release. Review failed
drafts before retrying. Voice releases are not marked as the latest application
release. The workflow never publishes an npm package.
Configure the repository Actions secret VOICE_RELEASE_TOKEN before publishing.
Use a repository-scoped fine-grained token with Contents and Workflows read/write
permissions, or an equivalent GitHub App token, to support creating release tags
for commits that modify workflows. Keep credentials only in Actions secrets and
replace the secret before its token expires. Publication fails explicitly when
the secret is missing; build jobs do not receive this credential.
The catalog generator verifies every compressed archive's size and SHA-256,
extracts its exact allowed file list, verifies every expanded file, and checks
model metadata against the pinned source catalog before emitting download URLs.
Engine packaging and catalog preparation also reject embedded home-directory
paths in file contents, including ASCII and UTF-16 binary strings. This is a
targeted local check; it does not replace review of other private data or notices.

The currently pinned upstream macOS ARM64 libraries contain build-machine source
paths in runtime diagnostic strings. They work for local development but fail
the release check; tar files prepared from those upstream binaries are not
publishable artifacts. The macOS ARM64 workflow uses the clean source build.
Stripping debug symbols does not remove those runtime strings. Publication needs
clean upstream libraries or source builds of sherpa-onnx, ONNX Runtime and linked
dependencies with compiler prefix mapping (for example -ffile-prefix-map,
-fmacro-prefix-map and -fdebug-prefix-map, or MSVC /pathmap), followed by the same
content scan and real inference tests. The workflow does not imply release
readiness merely because a platform binary was compiled.

Loop derives the versioned Release URL from VOICE_RELEASE_VERSION and downloads
manifest.json during resource discovery, with a 15-second timeout, 1 MiB limit and
one-minute retry/cache interval. It validates the schema, protocol, engine version,
paths and executable, exact archive URLs and pinned model identities. Downloads
retain archive and expanded-file size/SHA-256 verification. HTTPS and the public
Release repository are the trust root; checksums are not independent signatures.
Failures preserve use of installed resources. No generated TypeScript catalog
needs to be copied into the repository. Updating resources requires bumping the
supported version and any model pins in Loop; arbitrary upstream models are never
automatically adopted. Loop does not use GitHub latest-release discovery.
Unpublished versions remain unavailable until their manifest and packages exist.

The builder and packers can also be run individually:

```bash
node --import tsx packages/coding-agent/src/core/voice/native/prepare-engine.ts <engine-directory> <asset-directory>
node --import tsx packages/coding-agent/src/core/voice/native/prepare-catalog.ts <complete-asset-directory> voice-v1.0.0
```

Both commands prepare local output; they do not upload it. Catalog preparation
defaults to darwin-arm64 for the first release; pass --targets with a comma-separated
list to select additional validated platforms. The workflow passes its selected
targets to catalog preparation. Every selected native bundle and all three model artifacts
must be present and tested before adopting the generated catalog.
The current real runtime check covers macOS ARM64. Other targets require their
workflow run and smoke verification; cross-platform readiness is not established
by source compilation alone.

## Installation and recovery

Resources live under the configured Loop data directory in voice/engines,
voice/models and voice/staging, isolated by platform, version and content digest.
active.json atomically records the complete compatible activation. Failed updates
leave the previous activation available. Interrupted downloads retain bounded
partial files and verify the full digest after resuming. Uninstall removes only
managed voice resources and is refused while a runtime lease is active.

A call holds one resource lease. Installation, update, local import and removal
are mutually exclusive across managers and processes using the same resource
directory. A PID and unique-owner directory lock remains held throughout a call.
Only a confirmed absent PID allows automatic stale-lock recovery; ambiguous
ownership stays busy. If a crash leaves an empty or malformed .resource-lock,
stop all Loop processes using that data directory before manually removing it.
The native process reads
bounded JSONL on stdin and writes protocol frames only on stdout. It performs
streaming 16 kHz PCM ASR/VAD and concurrent cancellable Kokoro synthesis; VAD ends
a segment after 1.2 seconds of silence. No recordings or synthesized audio are
written to disk by the runtime. Final text belongs to the ordinary session.

## Licenses and limitations

Exact retained notices are in licenses/ and copied into native bundles. The
ONNX Runtime notices correspond to 1.28.2 used by the pinned macOS release; each
other target must confirm its linked runtime and review matching notices before
publication. See THIRD_PARTY_LICENSES.md. Model packages retain their own notices.
The bilingual model is small and CPU oriented; real mixed-language speech can
contain recognition errors. Successful synthetic and sample-file checks establish
integration, not microphone accuracy, echo cancellation, latency or platform
availability. Browser/device tests remain required.

## Source layout

- [Build entry](build.ts) coordinates [verified dependency downloads](native-download.ts),
  [sidecar compilation](compile-sidecar.ts) and [manifest generation](engine-manifest.ts).
- [Source locks](source-lock-types.ts), [source dependencies](source-dependency-types.ts),
  [release metadata](release-assets-types.ts) and [workflow contracts](workflow-matrix-types.ts)
  keep tooling contracts separate from implementation.
- [Source fetching](onnxruntime-source.ts), [archives](source-archives.ts),
  [checked patches](source-patch.ts) and [command execution](source-command.ts) each own one
  build responsibility. Source-fetch, archive, patch, release and workflow tests are colocated.
