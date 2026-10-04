# Delivery verification

Verification covers local artwork, export integrity and application integration, not a production deployment.

The [brand asset policy](../BRAND-ASSETS.md) separates the icon artwork from the software's MIT license and preserves the guide fonts' OFL terms. This delivery has not undergone trademark clearance or an ownership assessment; technical verification does not certify uniqueness, registrability or legal exclusivity.

- The primary SVG render matches the approved source pixel-for-pixel at 1024px.
- The board and all four PDF pages were rendered and visually inspected.
- After replacing the document fonts, PDF font resources and embedded font metadata were inspected: the embedded fonts are Loop Guide Sans subsets derived from Noto Sans SC, with no Arial Unicode MS embedded. Text extraction was checked on all four pages.
- The bundled static regular and bold font subsets retain the source copyright and OFL metadata. Their source attribution and complete SIL OFL 1.1 license are included in `fonts/`; board lettering is outlined from those fonts.
- PNG dimensions, alpha behavior and image metadata were checked.
- The ICO directory and embedded frames were checked; the ICNS was generated from the retained iconset and decoded for inspection.
- Manifest references, relative Markdown/SVG links and standalone SVG resources were checked locally.
- Maskable foreground bounds were checked against the central safe circle.
- Application icon copies match the approved exports. Targeted UI and startup tests, type/format/architecture checks, and the Bun frontend build passed. The sidebar and welcome icons were visually checked in a local browser; conventional favicon and Safari routes were checked through HTTP.
- The white-tile adaptation preserves the primary SVG geometry and changes only the tile and gradient colors. Light/Dark switching, return to System on a light system, and saved Dark restoration after reload were checked in a local browser. Live operating-system color-scheme changes were not simulated; their behavior uses the CSS media query.
- Text, metadata and archive filenames were scanned for personal paths, credentials and unintended runtime data. Checksums cover the delivered files.

No real model calls or full application test suite were needed. Small-size previews preserve the master proportions and do not claim separate optical redrawing.
