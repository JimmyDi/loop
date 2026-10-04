# Guide fonts and license

The PDF guide uses **Loop Guide Sans**, a renamed, static subset derived from **Noto Sans SC**. The presentation board uses outlines generated from the same fonts. The icon artwork itself does not use a font.

## Included files

| File | Weight | Purpose |
| --- | --- | --- |
| `LoopGuideSans-Regular.ttf` | 400 | Body text and labels |
| `LoopGuideSans-Bold.ttf` | 700 | Titles and headings |
| [OFL.txt](OFL.txt) | — | Source copyright notice and complete SIL Open Font License 1.1 |

These font files remain licensed under the **SIL Open Font License 1.1**, independently of the repository's license. Keep the copyright notice and license with redistributed font files. The OFL permits embedding, modification and redistribution subject to its terms; font files may not be sold by themselves. It does not require documents created with the fonts to use the OFL.

## Source and changes

- Upstream: [Noto Sans SC variable TrueType font](https://github.com/notofonts/noto-cjk/blob/main/Sans/Variable/TTF/Subset/NotoSansSC-VF.ttf), from the official Noto CJK repository.
- Upstream license: [Sans/LICENSE](https://github.com/notofonts/noto-cjk/blob/main/Sans/LICENSE).
- Source version: `Version 2.004;hotconv 1.0.118;makeotfexe 2.5.65603`.
- Source font Git blob: `5371a543be5fc670c7cdee9760c03554ee3e9b8e`.
- Source font SHA-256: `d68bafcb48a2707749396aa12bbbd833cb70401f3a9a689fd2902c7e0d295964`.
- Upstream license Git blob: `d952d62c065f3f35fb83a173496e90b21525aef3`.
- Source copyright: © 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'.

FontTools 4.66.1 was used to instantiate weights 400 and 700, subset the glyphs, and rename the derivatives to Loop Guide Sans. Each file contains 364 glyphs. Source copyright and license metadata are retained. The PostScript names are `LoopGuideSans-Regular` and `LoopGuideSans-Bold`; neither derivative is a variable font.

The subsets cover the guide and board text plus basic Latin characters. They are not general-purpose Chinese fonts. For new text with missing characters, use the full upstream font or create a new appropriately named subset while preserving the OFL notices. This derivation does not imply endorsement by the upstream authors.
