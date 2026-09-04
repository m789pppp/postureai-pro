# Image credits and licences

Every image in this directory is third-party work used under a licence that
permits commercial use. **These are licence obligations, not courtesies** — the
CC BY-SA images below require attribution wherever they are displayed, and that
attribution is rendered in the app (see `frontend/src/lib/exerciseMedia.js`,
which carries the credit line for each file and the UI that shows it).

Do not add an image to this directory without recording it here, and do not use
an image whose licence you have not checked. Most exercise and posture imagery
on the web is all-rights-reserved; a paid product cannot ship it.

## Sitting posture reference

| File | `sitting-posture-reference.webp` |
|---|---|
| Source | [Computer Workstation Variables cleanup](https://commons.wikimedia.org/wiki/File:Computer_Workstation_Variables_cleanup.png), Wikimedia Commons |
| Author | Yamavu, after the original by Ergonomics, Integrated Safety Management, Berkeley Lab |
| Licence | **CC0 1.0** (public domain dedication) — no attribution required, none of the share-alike obligations below apply |
| Modification | Resized to 505×760 and converted to WebP |

## Exercise illustrations

All six are by **BruceBlaus** on Wikimedia Commons, under
**[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)**.

That licence requires, wherever these are shown: credit to the author, a link to
the licence, and an indication of whether changes were made. Every one below was
resized and converted to WebP, which counts as a change and is noted in the app.

| File | Source file on Commons |
|---|---|
| `neck-glide.webp` | [Exercise NeckGlide.png](https://commons.wikimedia.org/wiki/File:Exercise_NeckGlide.png) |
| `neck-bends.webp` | [Exercise Neck Bends.png](https://commons.wikimedia.org/wiki/File:Exercise_Neck_Bends.png) |
| `shoulder-shrugs.webp` | [Exercise Neck Shrugs.png](https://commons.wikimedia.org/wiki/File:Exercise_Neck_Shrugs.png) |
| `wrist-extensor.webp` | [Exercise Wrist Extensor Stretch.png](https://commons.wikimedia.org/wiki/File:Exercise_Wrist_Extensor_Stretch.png) |
| `finger-extensions.webp` | [Exercise Finger Extensions.png](https://commons.wikimedia.org/wiki/File:Exercise_Finger_Extensions.png) |
| `chair-squat.webp` | [Exercise Chair Squat.png](https://commons.wikimedia.org/wiki/File:Exercise_Chair_Squat.png) |

### What share-alike means here, in practice

CC BY-SA's copyleft attaches to *adaptations of the image*, not to the
application that displays it. Resizing and re-encoding produce an adapted image,
so these WebP files are themselves CC BY-SA 4.0 — which is why they live in a
clearly-marked directory of their own rather than being pulled into a sprite
sheet or baked into a larger composite. The rest of the codebase is unaffected.

Two consequences to respect:

- **Do not composite these into another image** (a montage, a PDF page layout, a
  social share card) without accepting that the result inherits CC BY-SA.
- **Do not remove the credit line** from the break screen. It is the licence
  term, not decoration.

If either becomes inconvenient, the answer is to commission or draw a
replacement — not to drop the attribution.

## Why the break routine looks the way it does

The exercises in `BreakPage.jsx` were chosen partly around what could be
illustrated under a free licence. Free coverage is patchy: there is no
suitably-licensed illustration of a seated spinal twist, a standing chest
opener, or an eye-rest exercise, so those are not in the routine (the 20-20-20
eye break stays, with no illustration, because it needs none). Everything that
is in the routine has a picture, from one illustrator, so the screen reads as
one thing rather than a mix of styles.
