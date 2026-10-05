# Usage and specifications

These are technical instructions for authorized uses. The icon artwork is separately reserved under the [brand asset policy](../BRAND-ASSETS.md), including its reproductions in the PDF and presentation board. It is not licensed under MIT for reuse as another product's identity.

## Identity

The L and returning stroke represent one continuous coding workflow. The left upright and horizontal foot remain white; color begins at the lower-right return and ends at the inner tip. The mark is static, not an execution-state indicator.

| Parameter | Value |
| --- | --- |
| Canvas | 64 × 64 units |
| Tile | `#222428`, corner radius 15 |
| Stroke | 7.5 units, rounded endpoints |
| Gradient | `#FFFFFF` to `#4D8DFF` |
| Upper arch | Center (40, 23), centerline radius 7 |
| Mark bounds | x 13.25-50.75, y 12.25-51.75 |
| Color-transition start | Lower-right return, centerline point (37, 48) |

The upper arch meets the vertical strokes tangentially. Smooth the color field inside the outline only; do not blur the outline. The master preserves the exact approved rendered appearance. Color values are sRGB; no CMYK or spot-color match is specified.

## Backgrounds and spacing

- Use [the primary tile](../svg/loop-icon.svg) on either light or dark backgrounds. Preserve its supplied inner spacing.
- The application's Dark theme uses [the white-tile adaptation](../svg/loop-icon-light.svg): a white tile with a `#222428` to `#4D8DFF` mark. Light uses the primary tile. Both preserve the same paths, proportions and smooth color blending. System follows the browser's current color scheme; explicit theme selections take precedence. This adaptation supplements the primary design shown in the PDF and presentation board.
- Reserve external clear space of at least one eighth of the displayed icon width. For example, allow 4px around a 32px icon where layout permits. This is a usage recommendation, not additional canvas padding.
- Use [the gradient mark](../svg/loop-mark.svg) on a dark solid surface. Its white start disappears on white backgrounds.
- Use [the dark mark](../svg/loop-mark-dark.svg) on light surfaces and [the white mark](../svg/loop-mark-white.svg) on dark surfaces.
- The [currentColor mark](../svg/loop-mark-current.svg) inherits CSS color when inlined. External image elements do not inherit the host text color.
- Do not stretch, rotate, change the gradient direction, crop the supplied tile, or add outlines, glow, shadows or decorative elements to the mark.

## Small sizes

Use the supplied size-specific PNG exports at 16-32px. The geometry remains the approved master; there is no separately redrawn small-size logo. The gap and gradient are naturally less distinct at 16px. Prefer 24px or larger for interface branding. The presentation board shows actual 16, 24, 32, 48, 64 and 96px samples.

## Web handoff

The Loop application includes copies of the favicon, Apple touch and Safari mask assets in `packages/web-ui/src/frontend/assets/`. Its sidebar and welcome screen share the supplied 256px primary and white-tile PNGs, displayed at 28px or 64px. Browser favicons and Safari icons retain the standard artwork independently of the application's theme setting. The PWA manifest remains a delivery template. For other authorized deployments, copy the contents of `web/` together and adapt URLs to the host application. The following fragment assumes the files are served under `/assets/loop/`:

```html
<link rel="icon" href="/assets/loop/favicon.ico" sizes="16x16 32x32 48x48 256x256" />
<link rel="icon" type="image/png" href="/assets/loop/favicon-32.png" sizes="32x32" />
<link rel="icon" type="image/svg+xml" href="/assets/loop/favicon.svg" sizes="any" />
<link rel="apple-touch-icon" href="/assets/loop/apple-touch-icon.png" sizes="180x180" />
<link rel="mask-icon" href="/assets/loop/safari-pinned-tab.svg" color="#222428" />
<link rel="manifest" href="/assets/loop/site.webmanifest" />
```

The ICO contains PNG-compressed 16, 32, 48 and 256px frames for modern consumers. Safari receives a filter-free black silhouette. The 180px Apple touch image is opaque and square so the platform can apply its own corner shape.

The PWA manifest is an asset template. Review `start_url`, `scope` and deployment paths in the actual application; the template does not add a service worker or offline behavior. Standard icons retain the approved tile. Maskable images use an opaque square background and an 80% mark scale, keeping the mark inside the central safe circle.

## Native handoff

[Loop.icns](../native/Loop.icns) packages 16, 32, 128, 256 and 512px representations at 1x and 2x. The retained [iconset](../native/Loop.iconset) can be rebuilt with the macOS `iconutil` command:

```bash
iconutil -c icns native/Loop.iconset -o native/Loop.icns
```

The [macOS source](../svg/loop-icon-macos.svg) scales the tile to 80.46875% and centers it with transparent margins. This adapts the approved design to a desktop-icon canvas without changing the mark-to-tile proportions. The ICNS has not been installed in an application bundle.

## Editing and compatibility

The SVG master contains vector curves and local gradients. Masks and Gaussian blur are used only to blend the color field. No external images, fonts, network resources or scripts are required by the primary icon. An editor that does not implement these filters faithfully may change its appearance; use the PNG export in that case.

The presentation board references adjacent files; keep the package folder structure when opening it. Its lettering is outlined from Loop Guide Sans, so it has no installed-font dependency. The PDF guide embeds regular and bold subsets of the same open-source font and has selectable text on all four pages, including the cover. The bundled fonts are renamed derivatives of Noto Sans SC under SIL OFL 1.1; see [font source and license](../fonts/README.md) and retain [OFL.txt](../fonts/OFL.txt) when redistributing them.
