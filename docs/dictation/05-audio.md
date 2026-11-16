# 05. Audio architecture

> **Decision of 2026-11-15 (owner):** no paid TTS and no API key. Two modes are offered: **B, natural voices made with
> Piper (default)** and **C, the device voice**. Mode A (paid provider) stays described below as a possible later
> addition, but nothing in the code needs it: the fallback chain skips a mode that has no audio index. Settings lets the
> learner choose B or C. Piper runs on the owner's Mac (`pip install piper-tts numpy` in a venv, `brew install espeak-ng`),
> the models come from huggingface.co/rhasspy/piper-voices into `build/dictation/piper-voices/` (not committed).
> Voices: `thorsten` (CC0) narrates, `kerstin` (CC0) is Ana Novak, the other characters are speakers of the MLS German model
> (CC-BY 4.0, OpenSLR 94: credit shown in Settings), chosen by `scripts/dictation/cast_voices.py` from the quick, clean
> speakers by pitch. `pavoque` is excluded (CC BY-NC-SA). The casting is a proposal made without listening: edit single
> entries in `content/dictation/voices.json`; only that character's files are generated again.
> Facts learned in the spike: the PyPI wheel `piper-tts` 1.8 has the espeak data path of its build machine compiled in, so
> the system espeak-ng data is passed explicitly; the cedilla bug is real (`c` + U+0327 for the ich-sound) and is fixed by
> `lib/phoneme_fix.py`; this ffmpeg has no `rubberband`, so pitch shifts use `asetrate` plus `atempo`.

Three modes, chosen by the learner in Settings, stored as `dictationAudioMode: 'A' | 'B' | 'C'` in `profiles.settings`
(synced across devices, absent for existing users, default `A`).

| Mode | Source | Voices | Needs network | Works without a German device voice |
|---|---|---|---|---|
| A | Pre-generated MP3 from a paid neural TTS | One fixed voice per character | Yes (cached files work offline) | Yes |
| B | Pre-generated MP3 from Piper (open source) | One fixed voice per character, pool-shared with pitch and tempo offsets | Yes (cached files work offline) | Yes |
| C | Live Web Speech API on the device | Characters mapped to device voices plus pitch and rate offsets | No | No (falls back, see below) |

Decision: **default A**, because it sounds the same on every device and does not depend on what voices the device
has. C stays available because it needs no network and no storage.

## Cast and the character-to-voice mapping (consistent across all stories)

`content/dictation/cast.json` lists characters once for the whole series (ids stable forever); `voices.json` maps each
character id to a voice per mode. A new story only adds characters it introduces. Characters known from
`storyline.md` (stories 1 and 2 need the first block; later ones are listed for planning):

| Id | Character | Profile (drives casting and Mode C offsets) |
|---|---|---|
| NARRATOR | Narrator | adult, neutral, calm, slightly slower |
| NILI | Nilufar Karimi | young woman |
| LUCIA | Lucía Fernández | young woman, lively, brighter than NILI |
| JONAS | Jonas Huber | man, 29, dry and calm |
| LECHNER | Brigitte Lechner | woman, 52, strict, lower |
| WAGNER | Monika Wagner | woman, 45, warm |
| KENJI, EMILY, PIERRE, MEI | Murklang team | man 31, woman 28, man 24, woman 27 |
| NOVAK | Ana Novak | woman, 38, teacher, clear |
| KEMAL, AYSE | Yıldız couple | man 34, woman 34 |
| CLAUDIA, MARTIN | Steiner parents | woman 41, man 44 |
| PAUL, LENA | Steiner children | boy 9, girl 6 |
| HERMINE | Hermine Steiner | woman, 78, slower |
| PICHLER, FELIX | landlady, flatmate (story 2) | woman 67, young man |
| GUEST_F1, GUEST_F2, GUEST_M1, GUEST_M2 | one-off minor speakers | generic, reused across stories |

Rules: non-native characters (Kenji, Emily, Pierre, Lucía, Kemal) speak **plain German without a caricatured
accent**, because the learner should hear a correct model. The validator fails when two characters that appear in
the same sequence resolve to the same effective voice in the chosen mode (same voice, pitch within 0.12 and rate
within 0.05); the sequences that contain each character are computed from the published JSON.

## Mode A: paid neural TTS, comparison and recommendation

| Criterion | ElevenLabs | Google Cloud Text-to-Speech |
|---|---|---|
| German naturalness and expressiveness for dialogue | Strongest of the two for conversational German; voices carry emotion | Good and very stable; Chirp 3 HD voices are natural, older Neural2 and Studio are flatter |
| Distinct voices for about 20 characters incl. child and elder | Large voice library with age and accent filters, voice design, cloning | A few dozen German voices, fewer age variants, no child voices |
| Austrian-accent option | Library may contain Austrian-accented German voices (verify in the spike) | de-DE only to the best of this plan's knowledge (verify in the spike) |
| Pronunciation control | Pronunciation dictionaries, phoneme tags on some models | Full SSML: `phoneme`, `sub`, `say-as`, breaks |
| Reproducibility | `seed` parameter, stability setting; output can vary slightly between runs | Deterministic for the same input |
| Cost for this corpus (about 16k German characters per story, 10 stories about 160k characters) | A paid plan for one or two months covers everything many times over | A few USD at most |
| Licensing of the generated files for a public app | Commercial use needs a paid plan; check the terms for redistribution and voice-library voices | Output may be stored and distributed under the Google Cloud terms |
| Risk | A library voice can be withdrawn by its owner: generated files are kept forever and never regenerated on demand | Voice names can be retired in future versions; files are kept forever too |

**Recommendation: ElevenLabs for Mode A**, because dialogue between about 20 recognizably different characters is the
core experience and voice variety and naturalness matter most; **Google Cloud TTS (Chirp 3 HD)** is the documented
backup and the choice if the spike finds a licence or consistency problem. The generator uses a provider adapter
(`TtsProvider.synthesize(text, voice, options) -> bytes`), so switching providers changes `voices.json` and one
adapter. Prices and terms change: confirm them in the Phase 0 spike (Open Questions).

## Mode B: Piper

- Piper runs locally (CLI or Python `piper-tts`) with `de_DE` voices from the Piper voices repository. The expected
  German inventory is small (a handful of voices: for example `thorsten` variants, `eva_k`, `karlsson`, `kerstin`,
  `pavoque`, `ramona`; verify the exact list and each voice's licence in the spike). There are no child or elderly
  voices and no Austrian voices.
- Consequence for the mapping: the roughly 20 characters **share** the available voices by gender and age group, and
  differ through post-processing (pitch shift of at most about 2 semitones and a tempo factor between 0.9 and 1.08,
  applied with `ffmpeg` `rubberband` or `asetrate` plus `atempo`) and through `length_scale` and `noise_scale`
  presets per character. The same validator rule as above applies.
- **Cedilla bug (known from the prototype).** Piper's phonemizer (espeak-ng) can emit the ich-sound as `c` followed by
  the combining cedilla U+0327 instead of the precomposed `ç` U+00E7. Some runtimes drop the unknown symbol silently,
  which removes or distorts the fricative. Pipeline fix, applied before ids are looked up:
  1. take the phoneme string for the sentence and run `unicodedata.normalize('NFC', phonemes)` (composes
     `c` + U+0327 into `ç`);
  2. check **every** resulting phoneme against the model's `phoneme_id_map`; if any symbol is missing, **fail the
     sentence with an error** naming the sentence id and the code point, never skip it silently;
  3. assert that no U+0327 remains anywhere;
  4. a test script `scripts/dictation/tests/test_piper_phonemes.py` phonemizes a fixture list (`ich, mich, Milch,
     Mädchen, China, Chemie, Küche, richtig, nicht, sprechen, Österreich`) and asserts steps 1 to 3 (skipped when
     Piper is not installed, so CI stays green);
  5. the listening check in the QA step covers those words per voice.
- Output: 22.05 kHz mono, re-encoded to MP3 like Mode A so the client has one decoder path.

## Mode C: live Web Speech with a character map

A new `storySpeaker` module (beside, not inside, `speechService`) offers `speakAs(characterId, text, rate)` and
returns a cancellable handle. `speechService.speak` is not changed. The map is computed by `voiceMap.ts` (pure,
unit-tested like `voices.ts`):

1. Input: the device's German voices (already filtered and sorted by `germanVoices()`), the cast profiles.
2. Guess voice gender from a name hint list (Anna, Petra, Marlene, Vicki, Katja, Helena, Hedda, Amala, Sabine are
   female; Markus, Yannick, Stefan, Conrad, Hans, Viktor are male); unknown stays neutral.
3. Walk the cast **in cast.json order** (never in story order, so assignment does not depend on which story is open).
   Assign each character the least-used voice of the matching gender group (neutral voices serve any), ties broken by
   a stable hash of the character id. The user's chosen voice from Settings (`daf_german_voice`) is used for NARRATOR.
4. Characters that end up sharing a voice receive offsets: base pitch by profile (child 1.35, young woman 1.10,
   adult man 0.92, older woman 0.88, elder 0.82, narrator 1.0) and base rate (narrator and elder 0.92, others 1.0),
   then a per-sharing step so that any two characters on the same voice differ by at least 0.15 pitch and 0.05
   rate. Clamp pitch to 0.7 to 1.5 and rate to 0.6 to 1.3. The learner's speech speed setting multiplies the rate.
5. Persist `{ voiceListHash, map }` in localStorage (`daf_dictation_voicemap_v1`). Recompute only when a mapped voice
   disappears or the list hash changes, so a character keeps its voice across sessions and stories.
6. Sentences with `segments` are spoken as consecutive utterances (one per segment) guarded by one playback token.
7. The speaker chip always shows who is speaking, because some browsers ignore `pitch`, and then two characters
   sound alike (see edge cases A19 to A22).

## Generation scripts

| Script | Runs where | Does | Secrets |
|---|---|---|---|
| `gen_audio.py NN --mode A` | The owner's Mac, never CI, never Vercel | For every sentence (and segment) computes the file key, skips existing, calls the provider, normalizes loudness (EBU R128, target -16 LUFS, true peak -1.5 dB), trims silence, adds 80 ms lead and 250 ms tail padding, joins segments with an 80 ms crossfade, encodes MP3 mono 64 kbps, writes to `build/dictation/audio/A/` and updates the index JSON | `ELEVENLABS_API_KEY` from the shell or the macOS keychain, never from a repo file and never with a `VITE_` prefix |
| `gen_audio.py NN --mode B` | Same | Same pipeline with Piper | none |
| `upload_media.py NN` | Same | Uploads audio and images to the `story-media` bucket with `cacheControl: 31536000`. **Dry run by default**; real upload needs `--target <project-ref> --yes`. Never overwrites an existing key | `SUPABASE_SERVICE_ROLE_KEY` from the shell only |
| `audio_qa.py NN` | Same | `ffprobe` and `volumedetect` on every file: duration within `[0.4 s, 1.5 s + 0.6 s per word]`, mean volume above -50 dB, sample rate and channels as expected; writes `audio-qa.md`; a human listens to a 10 percent sample plus every long, digit, ellipsis and quote-mixed sentence | none |

Cost guard: `gen_audio.py --dry-run` prints characters and the estimated cost; `--max-chars` aborts above a limit.

### File keys, storage and caching

- Key = first 16 hex of `sha256(provider | model | voiceId | voiceSettings | seed | speechText)` over all segments.
  Path: `audio/A/<key>.mp3`, `audio/B/<key>.mp3`, `images/S01-Q1.webp`. Identical text and voice yields the same file.
- The index `story-NN.audio.A.json` maps sentence id to `{ key, ms, bytes, textHash }`. It ships with the app.
- Size: a 5.6-word sentence is about 2.5 s, about 20 KB at 64 kbps; about 10 MB per story per mode.
- Bucket `story-media`: public read, no insert, update or delete policies (default deny for `anon` and
  `authenticated`), file size limit 2 MB, allowed types `audio/mpeg` and `image/webp`. Writes only with the service role.
- Client caching: HTTP `Cache-Control: public, max-age=31536000, immutable` (keys never change content). On top of that
  the page prefetches the next two sentences into the Cache API (`daf-dictation-audio-v1`, LRU 200 entries or 20 MB)
  and plays from `blob:` URLs, so replays and offline sessions cost no network.

### Regeneration when a sentence's text changes

Because the key includes the spoken text, any change creates a new key: the next `gen_audio.py` run generates only
the changed sentences and the index is updated. Old files are kept for at least 30 days (users may hold a cached old
index), then `gen_audio.py --gc` lists unreferenced keys and deletes them only with `--delete`. A voice change in
`voices.json` for one character regenerates exactly that character's sentences.

## Playback controller (client)

One `HTMLAudioElement` is created and unlocked on the first Start tap and reused for every sentence (this is what
makes iOS Safari accept later `play()` calls). A single token guards all state: `play()` increments it, calls
`audio.pause()` and `speechSynthesis.cancel()`, and every `ended`, `error` and `onend` callback ignores a stale
token, so rapid replays and overlapping requests never double-play. Replay is debounced by 150 ms. Speech speed uses
`audio.playbackRate` with `preservesPitch = true` for A and B, and `utterance.rate` for C. `listens` increments on a
successful start of playback (once per playback, not per retry).

## Fallback order

| Selected | Chain |
|---|---|
| A | file A, then file B, then Mode C, then none |
| B | file B, then file A, then Mode C, then none |
| C | Mode C, then file A, then file B, then none |

Per attempt: key missing in the index or HTTP 404, go to the next without retry; network error or 8 s timeout, one retry
after 500 ms, then next; decode error, next. After three consecutive failures of one mode a circuit breaker skips it
for five minutes in this session (so a dead network does not add 16 s to every sentence). Mode C is skipped at once
when the device has no German voice (`currentVoice()` is null). The player shows which source played ("Studio voice",
"Open-source voice", "Device voice") and an unobtrusive note when it is not the selected one. A fallback never
changes the stored setting. If the chain is exhausted the state is UI state 16 (retry, and a plain skip after three
failures).
