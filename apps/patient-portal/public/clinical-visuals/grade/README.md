# Hair Loss Grade Image Assets

These per-stage tile assets are referenced by the `grade` question in
`src/packages/ai-engine/questionnaire-engine/schema/questionnaire.schema.json`.

The runtime renders them via `OptionCardV2.illustration` (object-contain, no
crop, soft gradient backdrop) — each option in the grade question carries an
`illustration: { url, alt }` field that points to a file below.

## What ships today

Photographic Norwood / Ludwig chart crops are checked in as `.jpg` for all
18 stages. To swap any stage, drop a same-named file over it and (if the
extension changes) update the matching `illustration.url` in
`questionnaire.schema.json`.

## File map

### Norwood scale (males) — `norwood/`

Crop each stage from the Norwood reference chart, square-ish aspect (e.g.
512×512 or 4:3 landscape — `OptionCardV2` will render at `aspect-[4/3]` with
`object-cover`):

| File              | Stage              | Bucket  |
| ----------------- | ------------------ | ------- |
| `i.jpg`           | Norwood I          | Grade 1 |
| `ii.jpg`          | Norwood II         | Grade 1 |
| `iia.jpg`         | Norwood IIa        | Grade 2 |
| `iii.jpg`         | Norwood III        | Grade 2 |
| `iii_vertex.jpg`  | Norwood III vertex | Grade 2 |
| `iiia.jpg`        | Norwood IIIa       | Grade 2 |
| `iv.jpg`          | Norwood IV         | Grade 3 |
| `iva.jpg`         | Norwood IVa        | Grade 3 |
| `v.jpg`           | Norwood V          | Grade 4 |
| `va.jpg`          | Norwood Va         | Grade 4 |
| `vi.jpg`          | Norwood VI         | Grade 5 |
| `vii.jpg`         | Norwood VII        | Grade 5 |

### Ludwig scale (females / other) — `ludwig/`

| File         | Stage           | Bucket  |
| ------------ | --------------- | ------- |
| `grade1.jpg` | Ludwig Grade 1  | Grade 1 |
| `grade2.jpg` | Ludwig Grade 2  | Grade 2 |
| `iii.jpg`    | Ludwig III      | Grade 3 |
| `i1.jpg`     | Ludwig I-1      | Grade 3 |
| `ii1.jpg`    | Ludwig II-1     | Grade 4 |
| `iii1.jpg`   | Ludwig III-1    | Grade 5 |

## Bucket → scoring rule

The legacy scoring engine reads `ans.grade` and checks for `Grade 1..5`
substrings (see `src/packages/ai-engine/clinical-engine/signals.ts`). Each
option's `value` retains its `Grade N — …` prefix, so the Norwood/Ludwig
labels do not change scoring behaviour — they only change the picker UX.

`isGrade45` (Grade 4 or 5) triggers the AGA absolute lock at age ≥ 20
(AGA_MALE_45 / AGA_FEMALE_45 with MPHL Pro / FPHL Pro products).
