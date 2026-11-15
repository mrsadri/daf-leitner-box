# Visual Bible: „Ein Foto aus Graz“

The single source of truth for every image in the series. Every image prompt copies its blocks **word for word**. Never paraphrase a block inside a prompt; if a block must change, change it here first, then regenerate the affected prompts.

Version: 1.1 (2026-11-15). Covers stories 1 and 2 in detail; later stories add outfits, guests and locations at the end of the relevant sections.

---

## 1. How to use this file with Gemini

1. **Create the reference sheets once** (section 8; each prompt there is complete, copy it as it is). Save each image under its file name (for example `ref-NILI.png`). Regenerate a sheet until the face matches the anchor text closely, because every later image inherits it.
2. **For each scene prompt**, open a new Gemini chat, attach only the reference sheets listed under „Attach“ for that prompt, then paste the prompt text.
3. If a face drifts, do not edit the prompt. Regenerate, or edit the image in the same chat with: „Keep everything, but make [name]'s face match the attached reference sheet exactly.“
4. Each image is 4:3 landscape. Keep faces and key action away from the outer edges, because the app may crop slightly on narrow screens.

---

## 2. Fixed blocks (copied verbatim into every prompt)

### 2.1 FORMAT
```
Landscape orientation, 4:3 aspect ratio, full-bleed single illustration with no border and no frame. Keep all faces and the key action inside the central 85 percent of the frame.
```

### 2.2 STYLE
```
Hand-painted watercolor illustration for a contemporary European graded-reader book series: transparent layered washes on textured cold-press cotton paper with visible paper grain, soft wet-on-wet skies and backgrounds, crisper wet-on-dry detail on faces and hands, delicate fine sepia-brown ink linework under the paint, the white of the paper left for highlights, gentle colour blooms and soft edges. Semi-realistic adult proportions, natural and expressive faces, calm storytelling mood, the same brushwork and level of detail as every other image in the series.
```

### 2.3 PALETTE
```
Series palette: muted teal and deep sea-green, slate blue and navy, sage and olive green, warm cream and paper white, soft stone grey, dusty rose and burgundy accents, small touches of muted ochre-yellow. Medium saturation, earthy and calm. Orange is never a dominant colour.
```
Reference values for humans (not for the prompt): teal #3E8A8A, sea-green #2F5D5A, slate #5B6F82, navy #2C3E5C, sage #9CAF88, olive #6B7A3E, cream #F3EBDD, stone #B9B5AD, dusty rose #C9938F, burgundy #7A2E3A, ochre #C9A54A.

### 2.4 REFERENCE LINE (only when sheets are attached; fill in the names)
```
Reference images are attached for: {names}. Match each named character's face, skin tone, hair, body proportions, glasses and jewellery to the reference exactly. Take clothing, pose and setting from this text, not from the reference.
```

### 2.5 AVOID
```
No text, letters, numbers, words, logos or readable signage anywhere in the image: posters, papers, phone screens, books, labels and signs are blank or show only abstract marks. No speech bubbles, captions, borders or watermarks. No orange as a dominant colour. No photorealism, no 3D render, no anime or cartoon style, no thick black outlines. No extra or missing fingers, no distorted hands, no duplicated characters. Do not alter any named character's face, hair, skin tone, glasses or earrings.
```

---

## 3. Main characters

Each main character has three layers:
- **Anchor**: face, body, hair and permanent accessories. Never changes in any image, any season, any year. Copied verbatim.
- **Outfit**: one code per prompt, copied verbatim. A character keeps the same outfit for every image set on the same day.
- **Props**: added only when the scene calls for them.

### 3.1 NILI (Nilufar Karimi)

**Anchor**
```
Nilufar "Nili" Karimi, a 26-year-old Iranian woman, 1.62 m tall, slim build, oval face with warm olive skin, large dark-brown almond-shaped eyes, thick straight black eyebrows, a small beauty mark under her left eye, shoulder-length wavy black hair always tied in a low ponytail with a few loose strands framing her face, small silver crescent-moon earrings.
```

**Outfits**
| Code | When | Text (verbatim) |
|---|---|---|
| NILI-A | Everyday, mild weather, indoors all year | `a teal knitted scarf, a navy-blue cardigan over a cream blouse, dark-grey trousers, brown leather ankle boots, a brown leather crossbody bag` |
| NILI-B | Cold weather, outdoors (from S02-Q6 on) | `a knee-length grey wool coat, a thick turquoise knitted scarf, a red knitted beanie, black gloves, dark-grey trousers, brown leather ankle boots, a brown leather crossbody bag` |
| NILI-C | Summer | `a short-sleeved cream linen blouse, light-grey linen trousers, brown leather sandals, a thin teal cotton scarf tied to the strap of her brown leather crossbody bag` |
| NILI-D | Formal | `a navy-blue tailored blazer over a cream blouse, dark-grey trousers, low black heels, a teal silk scarf` |
| NILI-E | Sport | `a navy-blue long-sleeved running top, black running leggings, white-and-grey running shoes` |
| NILI-H | At home, ill or relaxing | `a cream long-sleeved cotton top, her navy-blue cardigan, soft dark-grey trousers, thick grey wool socks` |

**Props:** `a small green notebook with an elastic band`; the 1976 photo (section 6).

### 3.2 LUCIA (Lucía Fernández)

**Anchor**
```
Lucía Fernández, a 22-year-old Spanish woman, 1.68 m tall, athletic build, round face with light tan skin and freckles across her nose and cheeks, hazel-green eyes, long thick curly dark-brown hair held back by a red fabric scrunchie, a wide smile, small gold hoop earrings.
```

**Outfits**
| Code | When | Text (verbatim) |
|---|---|---|
| LUCIA-A | Everyday, mild weather, indoors all year | `a light-blue denim jacket with three small enamel pins (a guitar, a lemon, a star) on the left chest, a white T-shirt, black jeans, white sneakers` |
| LUCIA-B | Cold weather, outdoors | `a dark-green padded parka worn open over her light-blue denim jacket with three small enamel pins (a guitar, a lemon, a star), a burgundy knitted scarf, black jeans, black ankle boots` |
| LUCIA-C | Summer | `a white T-shirt, light-blue denim shorts, white sneakers, her light-blue denim jacket with three small enamel pins (a guitar, a lemon, a star) tied around her waist` |
| LUCIA-D | Formal | `a dark-green wrap dress with three-quarter sleeves, a black blazer with three small enamel pins (a guitar, a lemon, a star) on the lapel, black flat shoes` |
| LUCIA-E | Sport | `a red sports top, black running leggings, white running shoes` |
| LUCIA-K | Housework at the Steiners (add on top of LUCIA-A, jacket off) | `a white T-shirt, black jeans, white sneakers, a sage-green cotton apron; her light-blue denim jacket with three enamel pins hangs on a chair nearby` |

### 3.3 JONAS (Jonas Huber)

**Anchor**
```
Jonas Huber, a 29-year-old Austrian man, 1.88 m tall, tall and lanky, long narrow face with light skin, short messy ash-blond hair, light stubble, blue-grey eyes behind round tortoiseshell glasses, a black digital wristwatch on his left wrist.
```

**Outfits**
| Code | When | Text (verbatim) |
|---|---|---|
| JONAS-A | Everyday, mild weather, indoors all year | `an olive-green hooded sweatshirt under an open charcoal-grey wool jacket, dark-blue jeans, grey running shoes, a grey canvas backpack` |
| JONAS-B | Cold weather, outdoors | `a navy-blue padded jacket over his olive-green hooded sweatshirt, a grey knitted beanie, dark-blue jeans, brown lace-up boots, a grey canvas backpack` |
| JONAS-C | Summer | `an olive-green short-sleeved T-shirt, beige chino shorts, grey running shoes` |
| JONAS-D | Formal (from S02-Q6 on) | `a well-fitting grey two-piece suit, a white shirt, a light-blue tie, a brown leather belt, black leather shoes` |
| JONAS-E | Sport | `a dark-grey running shirt, black running shorts, grey running shoes; he keeps his glasses on while running` |
| JONAS-S | On stage with his band | `a pastel-pink band T-shirt with no print, dark-blue jeans, grey running shoes` (before S02-Q5 the band T-shirt is plain white) |

---

## 4. Supporting characters

Same structure as the main characters: an **anchor** (face, hair, body, permanent accessories; never changes) plus **outfit codes**. `-A` is everyday and indoors, `-B` is cold weather outdoors. If a scene needs an outfit that is not listed, define it once in the story file under „Bible additions“, then copy it here.

### Murklang team
- **LECHNER**: `Brigitte Lechner, a 52-year-old Austrian woman, upright posture, a short silver bob haircut, red rectangular glasses, pearl stud earrings.`
- **WAGNER**: `Monika Wagner, a 45-year-old Austrian woman, petite with a round friendly face, short curly chestnut-brown hair, reading glasses on a thin chain around her neck.`
- **KENJI**: `Kenji Sato, a 31-year-old Japanese man, slim and of medium height, short straight black hair with a neat side part, clean-shaven, calm dark eyes, white over-ear headphones resting around his neck.`
- **EMILY**: `Emily Clark, a 28-year-old English woman, pale skin with rosy cheeks, chin-length straight light-brown hair with a blunt fringe, grey-blue eyes.`
- **PIERRE**: `Pierre Dubois, a 24-year-old French man, slim and of average height, narrow clean-shaven face, brown eyes, dark-brown wavy chin-length hair pushed behind his ears, a thin brown leather bracelet.`
- **MEI**: `Mei Lin, a 27-year-old Chinese woman, medium height, light skin, straight black hair in a shoulder-length bob with blunt bangs, a black camera on a woven strap around her neck.`

| Code | When | Text (verbatim) |
|---|---|---|
| LECHNER-A | Everyday | `a navy-blue blazer over a white blouse, dark trousers, black low-heeled shoes` |
| LECHNER-B | Cold | `a long navy-blue wool coat, a grey cashmere scarf, black leather gloves, dark trousers, black ankle boots` |
| WAGNER-A | Everyday | `a moss-green cardigan over a cream top, a grey skirt, black tights, flat brown shoes` |
| WAGNER-B | Cold | `a short dark-brown quilted coat over her moss-green cardigan, a cream knitted scarf, a grey skirt, black tights, brown boots` |
| KENJI-A | Everyday | `a dark-grey crew-neck sweater, black trousers, white sneakers` |
| KENJI-B | Cold | `a black wool coat over his dark-grey sweater, a slate-blue scarf, black trousers, black boots` |
| EMILY-A | Everyday | `a dusty-pink turtleneck sweater, a black midi skirt, black tights, black ankle boots` |
| EMILY-B | Cold | `a burgundy wool coat over her dusty-pink turtleneck sweater, a black midi skirt, black tights, black ankle boots` |
| PIERRE-A | Everyday | `a light-grey denim shirt with rolled sleeves, beige chinos, brown suede shoes` |
| PIERRE-B | Cold | `a navy-blue pea coat over his light-grey denim shirt, a sage-green knitted scarf, beige chinos, brown boots` |
| MEI-A | Everyday | `a sage-green oversized shirt over a white top, black wide-leg trousers, white sneakers` |
| MEI-B | Cold | `a long stone-grey padded coat over her sage-green shirt, a black beanie, black wide-leg trousers, black boots` |

### Steiner family (Geidorf)
- **CLAUDIA**: `Claudia Steiner, a 41-year-old Austrian woman, tall, straight blond shoulder-length hair, light-blue eyes.`
- **MARTIN**: `Martin Steiner, a 44-year-old Austrian man, medium height, short dark hair, a short dark beard with grey streaks.`
- **PAUL**: `Paul Steiner, a 9-year-old Austrian boy, a brown bowl haircut, brown eyes.`
- **LENA**: `Lena Steiner, a 6-year-old Austrian girl, blond hair in two braids, round blue eyes.`
- **HERMINE**: `Hermine Steiner, a 78-year-old Austrian woman, small and slightly bent, white hair in a neat bun, bright blue eyes, deep laughter lines, a silver brooch shaped like the Graz clock tower always pinned to her outer layer.`

| Code | When | Text (verbatim) |
|---|---|---|
| CLAUDIA-A | Everyday, at home or at work | `a light-grey blouse, dark trousers, a stethoscope around her neck` |
| CLAUDIA-B | Cold | `a light-grey wool coat, a white knitted scarf, dark trousers, black ankle boots` |
| MARTIN-A | Everyday | `a black turtleneck with rolled-up sleeves, dark trousers` |
| MARTIN-B | Cold | `a black wool coat over his black turtleneck, a dark-grey scarf, dark trousers, black boots` |
| PAUL-A | Everyday | `a blue football shirt with the number 9 shown only as an abstract shape, jeans, sneakers` |
| PAUL-B | Cold | `a blue padded jacket over his blue football shirt, a grey beanie, jeans, winter boots` |
| LENA-A | Everyday, indoors | `a yellow long-sleeved top, a denim pinafore dress, white socks` |
| LENA-B | Outdoors, rain or cold | `a yellow raincoat over a warm sweater, a white knitted hat, light-blue jeans, red rubber boots` |
| HERMINE-A | Everyday | `a burgundy wool cardigan over a cream blouse, a dark-grey skirt, sensible black shoes` |
| HERMINE-B | Cold | `a long dark-green wool coat, a burgundy knitted scarf, black gloves, black ankle boots` |

### German course
- **NOVAK**: `Ana Novak, a 38-year-old German woman, tall, a black pixie cut, large silver hoop earrings.`
- **KEMAL**: `Kemal Yıldız, a 34-year-old Turkish man, broad-shouldered, a short black beard, dark eyes.`
- **AYSE**: `Ayşe Yıldız, a 34-year-old Turkish woman, round glasses, a lilac headscarf.`
- Other course members (Yuki, Wei, Sophie, Tom, Carlos) appear only as loosely painted background figures.

| Code | When | Text (verbatim) |
|---|---|---|
| NOVAK-A | Everyday | `a blue-and-white striped sweater, black trousers, black ankle boots` |
| NOVAK-B | Cold | `a black parka over her blue-and-white striped sweater, black trousers, black boots` |
| KEMAL-A | Everyday (he comes straight from work) | `a white chef's jacket, black trousers` |
| KEMAL-B | Cold | `a black padded jacket over his white chef's jacket, black trousers` |
| AYSE-A | Everyday | `a soft grey cardigan over a long cream blouse, a long dark skirt` |
| AYSE-B | Cold | `a long navy-blue coat, black gloves, a long dark skirt` |

### Story 2 onward
- **PICHLER**: `Theresia Pichler, a 67-year-old Austrian woman, stout, permed grey hair, rosy cheeks.`
- **SABINE**: `Sabine, an Austrian running coach of about 40, fit, tanned skin, short sporty dark-blond hair.`

| Code | When | Text (verbatim) |
|---|---|---|
| PICHLER-A | Everyday, at home | `a flowered apron over a dark-blue dress, slippers` |
| PICHLER-B | Cold | `a heavy brown wool coat over a dark-blue dress, a dark-green felt hat, brown lace-up shoes` |
| SABINE-A | Training | `a navy-blue club track jacket, black leggings, running shoes, a whistle on a cord around her neck` |
| SABINE-B | Cold training | `a navy-blue padded club vest over her track jacket, a grey headband over her ears, black leggings, running shoes, a whistle on a cord around her neck` |

### Hermine and Bahram in the past, Bahram today (never mixed)
These anchors already include the clothes of that time, so they take no outfit code.
- **HERMINE-1976**: `Hermine at 28, in 1976: a small, slim young Austrian woman with bright blue eyes, dimples and a wide laugh, shoulder-length wavy honey-brown hair, a light summer dress with a small flower print.`
- **BAHRAM-1976**: `Bahram Karimi at 24, in 1976: a thin young Iranian man with black curly hair, a thick black moustache, dark eyes, a white shirt with rolled-up sleeves.`
- **BAHRAM-NOW**: `Bahram Karimi at 74: a slim Iranian man with white wavy hair, a white moustache, dark eyes, gold-rimmed glasses, a grey suit jacket over a white shirt.`


---

## 5. Recurring locations (copy verbatim, then add the scene's specifics)

- **LOC-MURKLANG**: `The Murklang office on the first floor of an old Graz townhouse in the Annenstraße: tall windows with white frames, white walls hung with framed concert posters that show only abstract shapes, a long wooden meeting table with mismatched chairs, potted green plants, a small espresso machine on a shelf, and Monika Wagner's desk by the window with a landline phone and stacks of folders.`
- **LOC-KURS**: `A plain evening classroom of a language school in Graz: a blank whiteboard, light wooden tables arranged in a U-shape, plastic chairs, a large window, warm ceiling lights.`
- **LOC-STEINER**: `The Steiner family's early-20th-century villa in Geidorf: cream façade, dark-green shutters, a garden with an apple tree; inside, a bright family kitchen with a long wooden table, sage-green cabinets and children's drawings (abstract scribbles) on the fridge. Next door, behind a low hedge, Hermine's smaller ivy-covered house.`
- **LOC-GRIES-ROOM**: `Nili's small temporary furnished room in the Griesgasse: white walls, a narrow bed with a grey blanket, a small desk, one tall window facing an inner courtyard.`
- **LOC-PICHLER-ROOM**: `Nili's 16-square-metre room on the second floor of Frau Pichler's tall old house in Lend: a high ceiling, a tall window and a glass door to a small balcony looking over red-tiled rooftops, wooden floorboards, a second-hand wooden wardrobe, a kitchen table used as a desk with two plain wooden chairs, a low blue-grey velvet armchair, a white plastic chest of drawers, a metal-and-glass lamp, and a hand-painted ceramic lamp from Seville with a blue-and-white tile pattern.` (Before S02-Q4 is complete the room is empty except for a narrow old bed.)
- **LOC-WASCHSALON** (from S02-Q5): `The Café Waschsalon in the Annenstraße: a long row of white front-loading washing machines and stacked dryers, a small café counter with a chrome espresso machine and wooden bar stools, a folding table for laundry, a large shop window to the street.`
- **LOC-STADTPARK**: `The Graz Stadtpark: wide gravel paths, tall old chestnut and plane trees, green lawns, wrought-iron benches, an ornate fountain in the distance.`
- **LOC-UHRTURM**: `The Graz clock tower (Uhrturm) on the green Schlossberg hill above the old town: a white square stone tower with a dark wooden roofed gallery and large clock faces, above a sea of red-tiled roofs.`

---

## 6. Recurring props

- **PROP-PHOTO-1976**: `a small square faded colour photograph from 1976 with a white border and warm, slightly yellowed tones, showing a thin young Iranian man with black curly hair, a thick black moustache and a white shirt with rolled-up sleeves next to a small, slim, laughing young woman with bright blue eyes, dimples, shoulder-length wavy honey-brown hair and a light summer dress with a small flower print, both standing in front of the Graz clock tower; the faces are small, and any handwriting on its back is never readable.` The two people in the photo are BAHRAM-1976 and HERMINE-1976.
- **PROP-NOTEBOOK**: `Nili's small green notebook with an elastic band.`
- **PROP-BANDSHIRT**: `the Murbuam band T-shirt with no print` (plain white until S02-Q5, pastel pink from S02-Q5 on).
- **PROP-SEVILLA-LAMP**: `a hand-painted ceramic lamp from Seville with a blue-and-white tile pattern.`

---

## 7. Season and timeline

| Story | Time | Default outfits |
|---|---|---|
| 1 | September, year 1. Late summer, mild, about 20 °C | A for everyone |
| 2 | Late September to mid-November, year 1. Cooler, misty mornings, rain in late October | A until S02-Q5; NILI-B and JONAS-D first appear in S02-Q6; E for running scenes |
| 3 | Late November to Christmas, year 1. Bern and Graz, cold, first snow | B outdoors, A indoors, JONAS-D and NILI-D at the fair |
| 4 | January onward, year 2. Winter turning to spring | B, then A |
| 5 | March, year 2, then autumn (Munich, Vienna), year 2 | A; B on cold days |
| 6 | Spring to summer, year 3. Eastern Styria, Lake Constance | A, then C |
| 7 to 10 | Derive from the story text and add a row here | |

Nobody visibly ages across the series. Hair length and hairstyle never change.

---

## 8. Reference sheet prompts (generate once, before any scene)

Each prompt below is complete: paste it as it is into a new Gemini chat, with nothing attached. Each sheet uses the same STYLE and PALETTE as the scenes, so the reference already looks like the series. Everyone wears their `-A` outfit; scene prompts change the clothes, never the face. Generate `ref-BAHRAM.png` only when Bahram appears today (stories 9 and 10).

Each prompt is also saved on its own in `image-prompts/refs/ref-<NAME>.md` (prompt text only, ready to paste). If you change a prompt here, update its file too.

### ref-NILI.png

```
Create a character reference sheet.

FORMAT: Landscape orientation, 4:3 aspect ratio, full-bleed single illustration with no border and no frame. Keep all faces and the key action inside the central 85 percent of the frame.

STYLE: Hand-painted watercolor illustration for a contemporary European graded-reader book series: transparent layered washes on textured cold-press cotton paper with visible paper grain, soft wet-on-wet skies and backgrounds, crisper wet-on-dry detail on faces and hands, delicate fine sepia-brown ink linework under the paint, the white of the paper left for highlights, gentle colour blooms and soft edges. Semi-realistic adult proportions, natural and expressive faces, calm storytelling mood, the same brushwork and level of detail as every other image in the series.

CHARACTER: Nilufar "Nili" Karimi, a 26-year-old Iranian woman, 1.62 m tall, slim build, oval face with warm olive skin, large dark-brown almond-shaped eyes, thick straight black eyebrows, a small beauty mark under her left eye, shoulder-length wavy black hair always tied in a low ponytail with a few loose strands framing her face, small silver crescent-moon earrings. Wearing: a teal knitted scarf, a navy-blue cardigan over a cream blouse, dark-grey trousers, brown leather ankle boots, a brown leather crossbody bag.

LAYOUT: Four views of the same person side by side on a plain warm-white paper background with no scenery: full-body front view, full-body three-quarter view, full-body side profile, and a large head-and-shoulders close-up with a gentle, shy smile. Neutral standing pose, arms relaxed, even soft daylight, identical face and proportions in every view.

PALETTE: Series palette: muted teal and deep sea-green, slate blue and navy, sage and olive green, warm cream and paper white, soft stone grey, dusty rose and burgundy accents, small touches of muted ochre-yellow. Medium saturation, earthy and calm. Orange is never a dominant colour.

AVOID: No text, letters, numbers, words, logos or readable signage anywhere in the image: posters, papers, phone screens, books, labels and signs are blank or show only abstract marks. No speech bubbles, captions, borders or watermarks. No orange as a dominant colour. No photorealism, no 3D render, no anime or cartoon style, no thick black outlines. No extra or missing fingers, no distorted hands, no duplicated characters. Do not alter any named character's face, hair, skin tone, glasses or earrings. No labels, names, arrows or colour swatches. No background scenery.
```

### ref-LUCIA.png

```
Create a character reference sheet.

FORMAT: Landscape orientation, 4:3 aspect ratio, full-bleed single illustration with no border and no frame. Keep all faces and the key action inside the central 85 percent of the frame.

STYLE: Hand-painted watercolor illustration for a contemporary European graded-reader book series: transparent layered washes on textured cold-press cotton paper with visible paper grain, soft wet-on-wet skies and backgrounds, crisper wet-on-dry detail on faces and hands, delicate fine sepia-brown ink linework under the paint, the white of the paper left for highlights, gentle colour blooms and soft edges. Semi-realistic adult proportions, natural and expressive faces, calm storytelling mood, the same brushwork and level of detail as every other image in the series.

CHARACTER: Lucía Fernández, a 22-year-old Spanish woman, 1.68 m tall, athletic build, round face with light tan skin and freckles across her nose and cheeks, hazel-green eyes, long thick curly dark-brown hair held back by a red fabric scrunchie, a wide smile, small gold hoop earrings. Wearing: a light-blue denim jacket with three small enamel pins (a guitar, a lemon, a star) on the left chest, a white T-shirt, black jeans, white sneakers.

LAYOUT: Four views of the same person side by side on a plain warm-white paper background with no scenery: full-body front view, full-body three-quarter view, full-body side profile, and a large head-and-shoulders close-up with a wide, warm laugh. Neutral standing pose, arms relaxed, even soft daylight, identical face and proportions in every view.

PALETTE: Series palette: muted teal and deep sea-green, slate blue and navy, sage and olive green, warm cream and paper white, soft stone grey, dusty rose and burgundy accents, small touches of muted ochre-yellow. Medium saturation, earthy and calm. Orange is never a dominant colour.

AVOID: No text, letters, numbers, words, logos or readable signage anywhere in the image: posters, papers, phone screens, books, labels and signs are blank or show only abstract marks. No speech bubbles, captions, borders or watermarks. No orange as a dominant colour. No photorealism, no 3D render, no anime or cartoon style, no thick black outlines. No extra or missing fingers, no distorted hands, no duplicated characters. Do not alter any named character's face, hair, skin tone, glasses or earrings. No labels, names, arrows or colour swatches. No background scenery.
```

### ref-JONAS.png

```
Create a character reference sheet.

FORMAT: Landscape orientation, 4:3 aspect ratio, full-bleed single illustration with no border and no frame. Keep all faces and the key action inside the central 85 percent of the frame.

STYLE: Hand-painted watercolor illustration for a contemporary European graded-reader book series: transparent layered washes on textured cold-press cotton paper with visible paper grain, soft wet-on-wet skies and backgrounds, crisper wet-on-dry detail on faces and hands, delicate fine sepia-brown ink linework under the paint, the white of the paper left for highlights, gentle colour blooms and soft edges. Semi-realistic adult proportions, natural and expressive faces, calm storytelling mood, the same brushwork and level of detail as every other image in the series.

CHARACTER: Jonas Huber, a 29-year-old Austrian man, 1.88 m tall, tall and lanky, long narrow face with light skin, short messy ash-blond hair, light stubble, blue-grey eyes behind round tortoiseshell glasses, a black digital wristwatch on his left wrist. Wearing: an olive-green hooded sweatshirt under an open charcoal-grey wool jacket, dark-blue jeans, grey running shoes, a grey canvas backpack.

LAYOUT: Four views of the same person side by side on a plain warm-white paper background with no scenery: full-body front view, full-body three-quarter view, full-body side profile, and a large head-and-shoulders close-up with a dry, lopsided half-smile. Neutral standing pose, arms relaxed, even soft daylight, identical face and proportions in every view.

PALETTE: Series palette: muted teal and deep sea-green, slate blue and navy, sage and olive green, warm cream and paper white, soft stone grey, dusty rose and burgundy accents, small touches of muted ochre-yellow. Medium saturation, earthy and calm. Orange is never a dominant colour.

AVOID: No text, letters, numbers, words, logos or readable signage anywhere in the image: posters, papers, phone screens, books, labels and signs are blank or show only abstract marks. No speech bubbles, captions, borders or watermarks. No orange as a dominant colour. No photorealism, no 3D render, no anime or cartoon style, no thick black outlines. No extra or missing fingers, no distorted hands, no duplicated characters. Do not alter any named character's face, hair, skin tone, glasses or earrings. No labels, names, arrows or colour swatches. No background scenery.
```

### ref-MURKLANG-1.png

```
Create a character reference sheet.

FORMAT: Landscape orientation, 4:3 aspect ratio, full-bleed single illustration with no border and no frame. Keep all faces and the key action inside the central 85 percent of the frame.

STYLE: Hand-painted watercolor illustration for a contemporary European graded-reader book series: transparent layered washes on textured cold-press cotton paper with visible paper grain, soft wet-on-wet skies and backgrounds, crisper wet-on-dry detail on faces and hands, delicate fine sepia-brown ink linework under the paint, the white of the paper left for highlights, gentle colour blooms and soft edges. Semi-realistic adult proportions, natural and expressive faces, calm storytelling mood, the same brushwork and level of detail as every other image in the series.

CHARACTERS:
1. Brigitte Lechner, a 52-year-old Austrian woman, upright posture, a short silver bob haircut, red rectangular glasses, pearl stud earrings. Wearing: a navy-blue blazer over a white blouse, dark trousers, black low-heeled shoes.
2. Monika Wagner, a 45-year-old Austrian woman, petite with a round friendly face, short curly chestnut-brown hair, reading glasses on a thin chain around her neck. Wearing: a moss-green cardigan over a cream top, a grey skirt, black tights, flat brown shoes.
3. Kenji Sato, a 31-year-old Japanese man, slim and of medium height, short straight black hair with a neat side part, clean-shaven, calm dark eyes, white over-ear headphones resting around his neck. Wearing: a dark-grey crew-neck sweater, black trousers, white sneakers.

LAYOUT: The 3 people above, in the listed order from left to right, on a plain warm-white paper background with no scenery. Top row: each person full body, front view, standing, evenly spaced and clearly separate. Bottom row: a large head-and-shoulders close-up of each person, in the same order. Even soft daylight, no overlap between figures, each face clearly different from the others.

PALETTE: Series palette: muted teal and deep sea-green, slate blue and navy, sage and olive green, warm cream and paper white, soft stone grey, dusty rose and burgundy accents, small touches of muted ochre-yellow. Medium saturation, earthy and calm. Orange is never a dominant colour.

AVOID: No text, letters, numbers, words, logos or readable signage anywhere in the image: posters, papers, phone screens, books, labels and signs are blank or show only abstract marks. No speech bubbles, captions, borders or watermarks. No orange as a dominant colour. No photorealism, no 3D render, no anime or cartoon style, no thick black outlines. No extra or missing fingers, no distorted hands, no duplicated characters. Do not alter any named character's face, hair, skin tone, glasses or earrings. No labels, names, arrows or colour swatches. No background scenery.
```

### ref-MURKLANG-2.png

```
Create a character reference sheet.

FORMAT: Landscape orientation, 4:3 aspect ratio, full-bleed single illustration with no border and no frame. Keep all faces and the key action inside the central 85 percent of the frame.

STYLE: Hand-painted watercolor illustration for a contemporary European graded-reader book series: transparent layered washes on textured cold-press cotton paper with visible paper grain, soft wet-on-wet skies and backgrounds, crisper wet-on-dry detail on faces and hands, delicate fine sepia-brown ink linework under the paint, the white of the paper left for highlights, gentle colour blooms and soft edges. Semi-realistic adult proportions, natural and expressive faces, calm storytelling mood, the same brushwork and level of detail as every other image in the series.

CHARACTERS:
1. Emily Clark, a 28-year-old English woman, pale skin with rosy cheeks, chin-length straight light-brown hair with a blunt fringe, grey-blue eyes. Wearing: a dusty-pink turtleneck sweater, a black midi skirt, black tights, black ankle boots.
2. Pierre Dubois, a 24-year-old French man, slim and of average height, narrow clean-shaven face, brown eyes, dark-brown wavy chin-length hair pushed behind his ears, a thin brown leather bracelet. Wearing: a light-grey denim shirt with rolled sleeves, beige chinos, brown suede shoes.
3. Mei Lin, a 27-year-old Chinese woman, medium height, light skin, straight black hair in a shoulder-length bob with blunt bangs, a black camera on a woven strap around her neck. Wearing: a sage-green oversized shirt over a white top, black wide-leg trousers, white sneakers.

LAYOUT: The 3 people above, in the listed order from left to right, on a plain warm-white paper background with no scenery. Top row: each person full body, front view, standing, evenly spaced and clearly separate. Bottom row: a large head-and-shoulders close-up of each person, in the same order. Even soft daylight, no overlap between figures, each face clearly different from the others.

PALETTE: Series palette: muted teal and deep sea-green, slate blue and navy, sage and olive green, warm cream and paper white, soft stone grey, dusty rose and burgundy accents, small touches of muted ochre-yellow. Medium saturation, earthy and calm. Orange is never a dominant colour.

AVOID: No text, letters, numbers, words, logos or readable signage anywhere in the image: posters, papers, phone screens, books, labels and signs are blank or show only abstract marks. No speech bubbles, captions, borders or watermarks. No orange as a dominant colour. No photorealism, no 3D render, no anime or cartoon style, no thick black outlines. No extra or missing fingers, no distorted hands, no duplicated characters. Do not alter any named character's face, hair, skin tone, glasses or earrings. No labels, names, arrows or colour swatches. No background scenery.
```

### ref-STEINER-1.png

```
Create a character reference sheet.

FORMAT: Landscape orientation, 4:3 aspect ratio, full-bleed single illustration with no border and no frame. Keep all faces and the key action inside the central 85 percent of the frame.

STYLE: Hand-painted watercolor illustration for a contemporary European graded-reader book series: transparent layered washes on textured cold-press cotton paper with visible paper grain, soft wet-on-wet skies and backgrounds, crisper wet-on-dry detail on faces and hands, delicate fine sepia-brown ink linework under the paint, the white of the paper left for highlights, gentle colour blooms and soft edges. Semi-realistic adult proportions, natural and expressive faces, calm storytelling mood, the same brushwork and level of detail as every other image in the series.

CHARACTERS:
1. Claudia Steiner, a 41-year-old Austrian woman, tall, straight blond shoulder-length hair, light-blue eyes. Wearing: a light-grey blouse, dark trousers, a stethoscope around her neck.
2. Martin Steiner, a 44-year-old Austrian man, medium height, short dark hair, a short dark beard with grey streaks. Wearing: a black turtleneck with rolled-up sleeves, dark trousers.
3. Hermine Steiner, a 78-year-old Austrian woman, small and slightly bent, white hair in a neat bun, bright blue eyes, deep laughter lines, a silver brooch shaped like the Graz clock tower always pinned to her outer layer. Wearing: a burgundy wool cardigan over a cream blouse, a dark-grey skirt, sensible black shoes.

LAYOUT: The 3 people above, in the listed order from left to right, on a plain warm-white paper background with no scenery. Top row: each person full body, front view, standing, evenly spaced and clearly separate. Bottom row: a large head-and-shoulders close-up of each person, in the same order. Even soft daylight, no overlap between figures, each face clearly different from the others.

PALETTE: Series palette: muted teal and deep sea-green, slate blue and navy, sage and olive green, warm cream and paper white, soft stone grey, dusty rose and burgundy accents, small touches of muted ochre-yellow. Medium saturation, earthy and calm. Orange is never a dominant colour.

AVOID: No text, letters, numbers, words, logos or readable signage anywhere in the image: posters, papers, phone screens, books, labels and signs are blank or show only abstract marks. No speech bubbles, captions, borders or watermarks. No orange as a dominant colour. No photorealism, no 3D render, no anime or cartoon style, no thick black outlines. No extra or missing fingers, no distorted hands, no duplicated characters. Do not alter any named character's face, hair, skin tone, glasses or earrings. No labels, names, arrows or colour swatches. No background scenery.
```

### ref-STEINER-2.png

```
Create a character reference sheet.

FORMAT: Landscape orientation, 4:3 aspect ratio, full-bleed single illustration with no border and no frame. Keep all faces and the key action inside the central 85 percent of the frame.

STYLE: Hand-painted watercolor illustration for a contemporary European graded-reader book series: transparent layered washes on textured cold-press cotton paper with visible paper grain, soft wet-on-wet skies and backgrounds, crisper wet-on-dry detail on faces and hands, delicate fine sepia-brown ink linework under the paint, the white of the paper left for highlights, gentle colour blooms and soft edges. Semi-realistic adult proportions, natural and expressive faces, calm storytelling mood, the same brushwork and level of detail as every other image in the series.

CHARACTERS:
1. Paul Steiner, a 9-year-old Austrian boy, a brown bowl haircut, brown eyes. Wearing: a blue football shirt with the number 9 shown only as an abstract shape, jeans, sneakers.
2. Lena Steiner, a 6-year-old Austrian girl, blond hair in two braids, round blue eyes. Wearing: a yellow long-sleeved top, a denim pinafore dress, white socks.

LAYOUT: The 2 people above, in the listed order from left to right, on a plain warm-white paper background with no scenery. Top row: each person full body, front view, standing, evenly spaced and clearly separate. Bottom row: a large head-and-shoulders close-up of each person, in the same order. Even soft daylight, no overlap between figures, each face clearly different from the others.

PALETTE: Series palette: muted teal and deep sea-green, slate blue and navy, sage and olive green, warm cream and paper white, soft stone grey, dusty rose and burgundy accents, small touches of muted ochre-yellow. Medium saturation, earthy and calm. Orange is never a dominant colour.

AVOID: No text, letters, numbers, words, logos or readable signage anywhere in the image: posters, papers, phone screens, books, labels and signs are blank or show only abstract marks. No speech bubbles, captions, borders or watermarks. No orange as a dominant colour. No photorealism, no 3D render, no anime or cartoon style, no thick black outlines. No extra or missing fingers, no distorted hands, no duplicated characters. Do not alter any named character's face, hair, skin tone, glasses or earrings. No labels, names, arrows or colour swatches. No background scenery.
```

### ref-KURS.png

```
Create a character reference sheet.

FORMAT: Landscape orientation, 4:3 aspect ratio, full-bleed single illustration with no border and no frame. Keep all faces and the key action inside the central 85 percent of the frame.

STYLE: Hand-painted watercolor illustration for a contemporary European graded-reader book series: transparent layered washes on textured cold-press cotton paper with visible paper grain, soft wet-on-wet skies and backgrounds, crisper wet-on-dry detail on faces and hands, delicate fine sepia-brown ink linework under the paint, the white of the paper left for highlights, gentle colour blooms and soft edges. Semi-realistic adult proportions, natural and expressive faces, calm storytelling mood, the same brushwork and level of detail as every other image in the series.

CHARACTERS:
1. Ana Novak, a 38-year-old German woman, tall, a black pixie cut, large silver hoop earrings. Wearing: a blue-and-white striped sweater, black trousers, black ankle boots.
2. Kemal Yıldız, a 34-year-old Turkish man, broad-shouldered, a short black beard, dark eyes. Wearing: a white chef's jacket, black trousers.
3. Ayşe Yıldız, a 34-year-old Turkish woman, round glasses, a lilac headscarf. Wearing: a soft grey cardigan over a long cream blouse, a long dark skirt.

LAYOUT: The 3 people above, in the listed order from left to right, on a plain warm-white paper background with no scenery. Top row: each person full body, front view, standing, evenly spaced and clearly separate. Bottom row: a large head-and-shoulders close-up of each person, in the same order. Even soft daylight, no overlap between figures, each face clearly different from the others.

PALETTE: Series palette: muted teal and deep sea-green, slate blue and navy, sage and olive green, warm cream and paper white, soft stone grey, dusty rose and burgundy accents, small touches of muted ochre-yellow. Medium saturation, earthy and calm. Orange is never a dominant colour.

AVOID: No text, letters, numbers, words, logos or readable signage anywhere in the image: posters, papers, phone screens, books, labels and signs are blank or show only abstract marks. No speech bubbles, captions, borders or watermarks. No orange as a dominant colour. No photorealism, no 3D render, no anime or cartoon style, no thick black outlines. No extra or missing fingers, no distorted hands, no duplicated characters. Do not alter any named character's face, hair, skin tone, glasses or earrings. No labels, names, arrows or colour swatches. No background scenery.
```

### ref-LEND.png

```
Create a character reference sheet.

FORMAT: Landscape orientation, 4:3 aspect ratio, full-bleed single illustration with no border and no frame. Keep all faces and the key action inside the central 85 percent of the frame.

STYLE: Hand-painted watercolor illustration for a contemporary European graded-reader book series: transparent layered washes on textured cold-press cotton paper with visible paper grain, soft wet-on-wet skies and backgrounds, crisper wet-on-dry detail on faces and hands, delicate fine sepia-brown ink linework under the paint, the white of the paper left for highlights, gentle colour blooms and soft edges. Semi-realistic adult proportions, natural and expressive faces, calm storytelling mood, the same brushwork and level of detail as every other image in the series.

CHARACTERS:
1. Theresia Pichler, a 67-year-old Austrian woman, stout, permed grey hair, rosy cheeks. Wearing: a flowered apron over a dark-blue dress, slippers.
2. Sabine, an Austrian running coach of about 40, fit, tanned skin, short sporty dark-blond hair. Wearing: a navy-blue club track jacket, black leggings, running shoes, a whistle on a cord around her neck.

LAYOUT: The 2 people above, in the listed order from left to right, on a plain warm-white paper background with no scenery. Top row: each person full body, front view, standing, evenly spaced and clearly separate. Bottom row: a large head-and-shoulders close-up of each person, in the same order. Even soft daylight, no overlap between figures, each face clearly different from the others.

PALETTE: Series palette: muted teal and deep sea-green, slate blue and navy, sage and olive green, warm cream and paper white, soft stone grey, dusty rose and burgundy accents, small touches of muted ochre-yellow. Medium saturation, earthy and calm. Orange is never a dominant colour.

AVOID: No text, letters, numbers, words, logos or readable signage anywhere in the image: posters, papers, phone screens, books, labels and signs are blank or show only abstract marks. No speech bubbles, captions, borders or watermarks. No orange as a dominant colour. No photorealism, no 3D render, no anime or cartoon style, no thick black outlines. No extra or missing fingers, no distorted hands, no duplicated characters. Do not alter any named character's face, hair, skin tone, glasses or earrings. No labels, names, arrows or colour swatches. No background scenery.
```

### ref-1976.png

```
Create a character reference sheet.

FORMAT: Landscape orientation, 4:3 aspect ratio, full-bleed single illustration with no border and no frame. Keep all faces and the key action inside the central 85 percent of the frame.

STYLE: Hand-painted watercolor illustration for a contemporary European graded-reader book series: transparent layered washes on textured cold-press cotton paper with visible paper grain, soft wet-on-wet skies and backgrounds, crisper wet-on-dry detail on faces and hands, delicate fine sepia-brown ink linework under the paint, the white of the paper left for highlights, gentle colour blooms and soft edges. Semi-realistic adult proportions, natural and expressive faces, calm storytelling mood, the same brushwork and level of detail as every other image in the series.

CHARACTERS:
1. Hermine at 28, in 1976: a small, slim young Austrian woman with bright blue eyes, dimples and a wide laugh, shoulder-length wavy honey-brown hair, a light summer dress with a small flower print.
2. Bahram Karimi at 24, in 1976: a thin young Iranian man with black curly hair, a thick black moustache, dark eyes, a white shirt with rolled-up sleeves.

LAYOUT: The 2 people above, in the listed order from left to right, on a plain warm-white paper background with no scenery. Top row: each person full body, front view, standing, evenly spaced and clearly separate. Bottom row: a large head-and-shoulders close-up of each person, in the same order. Even soft daylight, no overlap between figures, each face clearly different from the others.

PALETTE: Series palette: muted teal and deep sea-green, slate blue and navy, sage and olive green, warm cream and paper white, soft stone grey, dusty rose and burgundy accents, small touches of muted ochre-yellow. Medium saturation, earthy and calm. Orange is never a dominant colour.

AVOID: No text, letters, numbers, words, logos or readable signage anywhere in the image: posters, papers, phone screens, books, labels and signs are blank or show only abstract marks. No speech bubbles, captions, borders or watermarks. No orange as a dominant colour. No photorealism, no 3D render, no anime or cartoon style, no thick black outlines. No extra or missing fingers, no distorted hands, no duplicated characters. Do not alter any named character's face, hair, skin tone, glasses or earrings. No labels, names, arrows or colour swatches. No background scenery.
```

### ref-BAHRAM.png

```
Create a character reference sheet.

FORMAT: Landscape orientation, 4:3 aspect ratio, full-bleed single illustration with no border and no frame. Keep all faces and the key action inside the central 85 percent of the frame.

STYLE: Hand-painted watercolor illustration for a contemporary European graded-reader book series: transparent layered washes on textured cold-press cotton paper with visible paper grain, soft wet-on-wet skies and backgrounds, crisper wet-on-dry detail on faces and hands, delicate fine sepia-brown ink linework under the paint, the white of the paper left for highlights, gentle colour blooms and soft edges. Semi-realistic adult proportions, natural and expressive faces, calm storytelling mood, the same brushwork and level of detail as every other image in the series.

CHARACTER: Bahram Karimi at 74: a slim Iranian man with white wavy hair, a white moustache, dark eyes, gold-rimmed glasses, a grey suit jacket over a white shirt.

LAYOUT: Four views of the same person side by side on a plain warm-white paper background with no scenery: full-body front view, full-body three-quarter view, full-body side profile, and a large head-and-shoulders close-up with a warm, dignified smile. Neutral standing pose, arms relaxed, even soft daylight, identical face and proportions in every view.

PALETTE: Series palette: muted teal and deep sea-green, slate blue and navy, sage and olive green, warm cream and paper white, soft stone grey, dusty rose and burgundy accents, small touches of muted ochre-yellow. Medium saturation, earthy and calm. Orange is never a dominant colour.

AVOID: No text, letters, numbers, words, logos or readable signage anywhere in the image: posters, papers, phone screens, books, labels and signs are blank or show only abstract marks. No speech bubbles, captions, borders or watermarks. No orange as a dominant colour. No photorealism, no 3D render, no anime or cartoon style, no thick black outlines. No extra or missing fingers, no distorted hands, no duplicated characters. Do not alter any named character's face, hair, skin tone, glasses or earrings. No labels, names, arrows or colour swatches. No background scenery.
```

---

## 9. Guest characters (one-off, defined in the story files)

Guests are people who appear in a single scene (a shop assistant, a flatmate). The story's prompt file defines them; if a guest returns in a later story, move the description here.

- **GUEST-CHEESE** (S01-Q6): `a cheerful Austrian shop assistant in her fifties with short grey-blond hair, a white work coat and a white cap.`
- **GUEST-EBNER** (S02-Q5): `Herr Ebner, the owner of the Café Waschsalon, a round-faced Austrian man of about 60 with a bald head, a grey moustache and a dark-green knitted waistcoat over a checked shirt.`
- **GUEST-SALES** (S02-Q6): `a tall elegant shop assistant in her thirties with a sleek dark ponytail and a black dress, a tape measure around her neck.`
