const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  ExternalHyperlink, TableOfContents, UnderlineType
} = require('docx');
const fs = require('fs');

// ── Brand Palette ─────────────────────────────────────────────
const C = {
  obsidian:   '0A0E1A',
  gold:       'C8A96E',
  goldLight:  'E8D5A3',
  goldDark:   '9A7A45',
  sage:       '3D6B50',
  sageMid:    '5A8A6A',
  sageLight:  'D4E8DC',
  platinum:   'F0F1F3',
  steel:      'C4C7CC',
  charcoal:   '2C3142',
  warmGray:   '6B7280',
  white:      'FFFFFF',
  ruleGold:   'C8A96E',
  never:      'C0392B',
  neverBg:    'FDECEA',
  howBg:      'EAF4EF',
  whyBg:      'FDF6EC',
};

// ── Typography ────────────────────────────────────────────────
const F = { serif: 'Garamond', sans: 'Arial', mono: 'Courier New' };

// ── Helpers ───────────────────────────────────────────────────
const spacer = (pts = 6) => new Paragraph({
  children: [new TextRun('')],
  spacing: { before: pts * 20, after: pts * 20 },
});

const rule = (color = C.gold, width = 6) => new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: width, color, space: 1 } },
  spacing: { before: 0, after: 160 },
  children: [],
});

const ruleTop = (color = C.gold, width = 6) => new Paragraph({
  border: { top: { style: BorderStyle.SINGLE, size: width, color, space: 1 } },
  spacing: { before: 160, after: 0 },
  children: [],
});

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

const chapterNum = (n) => new Paragraph({
  alignment: AlignmentType.LEFT,
  spacing: { before: 0, after: 80 },
  children: [new TextRun({
    text: `CHAPTER ${n}`,
    font: F.sans, size: 18, color: C.gold, bold: true,
    characterSpacing: 200,
  })],
});

const chapterTitle = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 40, after: 200 },
  children: [new TextRun({ text, font: F.serif, size: 56, bold: true, color: C.obsidian })],
});

const chapterSubtitle = (text) => new Paragraph({
  spacing: { before: 0, after: 400 },
  children: [new TextRun({ text, font: F.sans, size: 22, color: C.warmGray, italics: true })],
});

const sectionTitle = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 400, after: 160 },
  children: [new TextRun({ text, font: F.sans, size: 28, bold: true, color: C.obsidian })],
});

const principleTitle = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  spacing: { before: 280, after: 120 },
  children: [new TextRun({ text, font: F.serif, size: 30, bold: true, color: C.charcoal })],
});

const bodyText = (text, opts = {}) => new Paragraph({
  alignment: AlignmentType.LEFT,
  spacing: { before: 80, after: 120, line: 360 },
  children: [new TextRun({
    text,
    font: F.sans,
    size: 22,
    color: C.charcoal,
    ...opts,
  })],
});

const labeledBlock = (label, text, bgColor, labelColor, labelPrefix = '') => {
  const border = { style: BorderStyle.SINGLE, size: 1, color: C.steel };
  const borders = { top: border, bottom: border, left: border, right: border };
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1440, 7920],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders,
            width: { size: 1440, type: WidthType.DXA },
            shading: { fill: labelColor, type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.TOP,
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({
                text: labelPrefix + label,
                font: F.sans, size: 18, bold: true, color: C.white,
              })],
            })],
          }),
          new TableCell({
            borders,
            width: { size: 7920, type: WidthType.DXA },
            shading: { fill: bgColor, type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 200, right: 160 },
            children: [new Paragraph({
              spacing: { line: 340 },
              children: [new TextRun({ text, font: F.sans, size: 22, color: C.charcoal })],
            })],
          }),
        ],
      }),
    ],
  });
};

const whyBlock = (text) => labeledBlock('WHY', text, C.whyBg, C.goldDark, '◆  ');
const howBlock = (text) => labeledBlock('HOW', text, C.howBg, C.sage, '▶  ');
const neverBlock = (text) => labeledBlock('NEVER', text, C.neverBg, C.never, '✕  ');

const quoteBlock = (quote, attribution = '') => {
  const border = { style: BorderStyle.SINGLE, size: 1, color: C.steel };
  const borders = { top: border, bottom: border, left: border, right: border };
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [480, 8880],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders,
            width: { size: 480, type: WidthType.DXA },
            shading: { fill: C.gold, type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
            children: [new Paragraph({ children: [] })],
          }),
          new TableCell({
            borders,
            width: { size: 8880, type: WidthType.DXA },
            shading: { fill: C.platinum, type: ShadingType.CLEAR },
            margins: { top: 200, bottom: 200, left: 280, right: 200 },
            children: [
              new Paragraph({
                children: [new TextRun({
                  text: `“${quote}”`,
                  font: F.serif, size: 26, color: C.obsidian, italics: true,
                })],
              }),
              ...(attribution ? [new Paragraph({
                spacing: { before: 100 },
                children: [new TextRun({
                  text: `— ${attribution}`,
                  font: F.sans, size: 18, color: C.warmGray,
                })],
              })] : []),
            ],
          }),
        ],
      }),
    ],
  });
};

const pillarsTable = (cols, rows) => {
  const colW = Math.floor(9360 / cols.length);
  const border = { style: BorderStyle.SINGLE, size: 1, color: C.steel };
  const borders = { top: border, bottom: border, left: border, right: border };
  const headerCells = cols.map(c => new TableCell({
    borders,
    width: { size: colW, type: WidthType.DXA },
    shading: { fill: C.obsidian, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: c, font: F.sans, size: 20, bold: true, color: C.gold })],
    })],
  }));
  const dataRows = rows.map((row, ri) => new TableRow({
    children: row.map((cell, ci) => new TableCell({
      borders,
      width: { size: colW, type: WidthType.DXA },
      shading: { fill: ri % 2 === 0 ? C.white : C.platinum, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      verticalAlign: VerticalAlign.TOP,
      children: [new Paragraph({
        spacing: { line: 320 },
        children: [new TextRun({ text: cell, font: F.sans, size: 20, color: C.charcoal })],
      })],
    })),
  }));
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: cols.map(() => colW),
    rows: [new TableRow({ children: headerCells }), ...dataRows],
  });
};

const bulletItem = (text, ref = 'bullets') => new Paragraph({
  numbering: { reference: ref, level: 0 },
  spacing: { before: 60, after: 60, line: 320 },
  children: [new TextRun({ text, font: F.sans, size: 22, color: C.charcoal })],
});

const highlight = (text, color = C.goldLight) => {
  const border = { style: BorderStyle.SINGLE, size: 1, color: C.steel };
  const borders = { top: border, bottom: border, left: border, right: border };
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({
      children: [new TableCell({
        borders,
        width: { size: 9360, type: WidthType.DXA },
        shading: { fill: color, type: ShadingType.CLEAR },
        margins: { top: 140, bottom: 140, left: 240, right: 240 },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text, font: F.serif, size: 28, bold: true, color: C.obsidian, italics: true })],
        })],
      })],
    })],
  });
};

// ── COVER PAGE ────────────────────────────────────────────────
const coverPage = [
  spacer(40),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: 'HAIROS', font: F.sans, size: 100, bold: true, color: C.obsidian, characterSpacing: 400 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text: '─────  ◆  ─────', font: F.sans, size: 24, color: C.gold })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: 'Experience Bible', font: F.serif, size: 72, italics: true, color: C.charcoal })],
  }),
  spacer(10),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: 'The Complete Design & Strategy Reference', font: F.sans, size: 24, color: C.warmGray, characterSpacing: 120 })],
  }),
  spacer(16),
  rule(C.gold, 12),
  spacer(8),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'FOR INTERNAL USE — DESIGN & DEVELOPMENT TEAMS', font: F.sans, size: 18, color: C.warmGray, characterSpacing: 100 })],
  }),
  spacer(4),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Version 1.0 — 2026', font: F.sans, size: 18, color: C.warmGray })],
  }),
  spacer(30),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 120 },
    children: [new TextRun({ text: 'MISSION STATEMENT', font: F.sans, size: 20, bold: true, color: C.gold, characterSpacing: 200 })],
  }),
  (() => {
    const border = { style: BorderStyle.SINGLE, size: 1, color: C.steel };
    const borders = { top: border, bottom: border, left: border, right: border };
    return new Table({
      width: { size: 7200, type: WidthType.DXA },
      columnWidths: [7200],
      rows: [new TableRow({
        children: [new TableCell({
          borders,
          width: { size: 7200, type: WidthType.DXA },
          shading: { fill: C.platinum, type: ShadingType.CLEAR },
          margins: { top: 280, bottom: 280, left: 360, right: 360 },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: 380 },
            children: [new TextRun({
              text: 'HairOS does not conduct consultations. It creates moments of profound self-understanding — where science becomes clarity, and clarity becomes the courage to act.',
              font: F.serif, size: 28, italics: true, color: C.obsidian,
            })],
          })],
        })],
      })],
    });
  })(),
  pageBreak(),
];

// ── TABLE OF CONTENTS ─────────────────────────────────────────
const tocPage = [
  spacer(10),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 0, after: 120 },
    children: [new TextRun({ text: 'Contents', font: F.serif, size: 52, bold: true, color: C.obsidian })],
  }),
  rule(C.gold, 8),
  spacer(4),
  new TableOfContents('', { hyperlink: true, headingStyleRange: '1-2', stylesWithLevels: [] }),
  pageBreak(),
];

// ── PREAMBLE ─────────────────────────────────────────────────
const preamble = [
  spacer(8),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 0, after: 160 },
    children: [new TextRun({ text: 'Preamble', font: F.serif, size: 52, bold: true, color: C.obsidian })],
  }),
  rule(C.gold, 8),
  spacer(6),
  bodyText('This document is the definitive creative and strategic reference for everyone who builds, designs, or deploys HairOS. It is not a spec sheet. It is not a style guide. It is a philosophy made actionable.'),
  spacer(4),
  bodyText('Every word here answers one question: What does it feel like to be a patient inside HairOS?'),
  spacer(4),
  bodyText('The answer must always be: like someone finally sees me, understands me, and has the precision tools to help me.'),
  spacer(6),
  quoteBlock(
    'People will forget what you said, people will forget what you did, but people will never forget how you made them feel.',
    'Maya Angelou'
  ),
  spacer(8),
  bodyText('HairOS operates inside the emotionally charged intersection of identity, appearance, confidence, and medicine. Patients arrive carrying years of anxiety, embarrassment, hope, and scepticism. Our platform must honour all of it — without medicating the experience into sterility or sensationalising it into theatre.'),
  spacer(4),
  bodyText('The principles in this Bible are not aesthetic preferences. They are the load-bearing walls of the entire patient relationship. Violate them, and trust collapses. Honour them, and you create something rare: a clinical experience that patients actually want to return to.'),
  pageBreak(),
];

// ── CH 1: BRAND PERSONALITY ───────────────────────────────────
const ch1 = [
  chapterNum(1),
  chapterTitle('Brand Personality'),
  chapterSubtitle('The character HairOS embodies in every pixel, word, and interaction'),
  rule(C.gold, 8),
  spacer(6),

  bodyText('Brand personality is not a logo. It is not a colour. It is the consistent character that patients experience across every touchpoint — from the waiting room screen to the final report. HairOS has a singular, non-negotiable personality: The Precise Empath.'),
  spacer(4),
  highlight('The Precise Empath: scientifically rigorous, humanly warm, quietly confident.'),
  spacer(6),

  sectionTitle('The Five Personality Pillars'),
  pillarsTable(
    ['Pillar', 'Description', 'Manifests As', 'Never Becomes'],
    [
      ['Precision', 'Every claim is accurate. Every number is earned. Every insight is specific to this patient.', 'Exact hair density counts, calibrated follicle maps, clinical terminology used correctly', 'Cold, robotic, jargon-heavy, alienating'],
      ['Empathy', 'We understand that hair loss is identity loss. We hold that knowledge with reverence.', 'Warm language, pacing that allows reflection, never rushing the emotional moment', 'Saccharine, over-reassuring, dismissive of real fear'],
      ['Authority', 'We are the most knowledgeable system in the room. We never need to prove it.', 'Calm certainty, evidence citations, doctor-aligned tone', 'Arrogant, condescending, jargon as gatekeeping'],
      ['Curiosity', 'We invite patients to discover themselves, not submit to diagnosis.', 'Questions framed as revelations, data as narrative, exploration as reward', 'Interrogation, form-filling, checkbox energy'],
      ['Optimism', 'We present reality with hope. Truth without despair. Fact with forward momentum.', 'Progress framing, solution-first revelation, next-step clarity', 'False promises, toxic positivity, minimising real concern'],
    ]
  ),
  spacer(8),

  sectionTitle('Voice & Tone Spectrum'),
  bodyText('HairOS speaks differently depending on the moment. The underlying personality never changes — only the register.'),
  spacer(4),
  pillarsTable(
    ['Moment', 'Register', 'Example Phrase'],
    [
      ['Welcome / Onboarding', 'Warm, curious, inviting', '"Every strand tells a story. Let’s read yours together."'],
      ['Data Collection', 'Focused, gentle, purposeful', '"A few precise measurements, and the picture begins to form."'],
      ['Analysis in Progress', 'Assured, calm, anticipatory', '"Our AI is building your unique follicle map. This takes about 40 seconds."'],
      ['Insight Delivery', 'Clear, honest, forward-facing', '"Your crown density is 42% below optimal — here’s exactly what that means for you."'],
      ['Treatment Presentation', 'Confident, evidence-led, hopeful', '"Clinical trials show an 87% improvement rate at 6 months for your profile."'],
      ['Closing / Next Steps', 'Decisive, encouraging, partnered', '"Your personalised plan is ready. Your clinician will walk you through each step."'],
    ]
  ),
  spacer(8),

  principleTitle('1.1 — The Personality must never fragment'),
  whyBlock('Patients unconsciously detect inconsistency. A warm welcome followed by cold clinical copy creates cognitive dissonance that erodes trust irreparably. The brain reads inconsistency as deception.'),
  spacer(3),
  howBlock('Audit every text string, every animation, every icon label against the Five Pillars. Run the "Precise Empath Test": read it aloud — does it sound like a brilliant, caring doctor speaking to a patient they respect? If not, rewrite it.'),
  spacer(3),
  neverBlock('Never let different teams own different sections of the experience in isolation. Never allow medical copywriters and UX writers to work without a shared voice document. Never approve content that passes clinical review but fails the empathy test.'),
  spacer(6),

  principleTitle('1.2 — Confidence without chest-thumping'),
  whyBlock('Premium brands do not shout their credentials. Patients in clinical settings are hyperaware of overstatement. Confidence that requires performance signals insecurity. True authority is quiet.'),
  spacer(3),
  howBlock('Let data speak. Replace superlatives with specifics. Instead of "world-leading AI" write "trained on 2.4 million follicle scans across 19 countries." Credential through evidence, not adjectives.'),
  spacer(3),
  neverBlock('Never use "world-class," "revolutionary," "cutting-edge," or "state-of-the-art" without a verifiable citation. Never compare to competitors inside the patient experience. Never use testimonial quotes without clinical context.'),
  pageBreak(),
];

// ── CH 2: EMOTIONAL JOURNEY ────────────────────────────────────
const ch2 = [
  chapterNum(2),
  chapterTitle('Emotional Journey'),
  chapterSubtitle('Mapping the patient\'s inner arc from arrival to commitment'),
  rule(C.gold, 8),
  spacer(6),

  bodyText('A patient does not experience HairOS as a sequence of screens. They experience it as a sequence of feelings. Design the feelings first; the screens follow.'),
  spacer(4),
  bodyText('The emotional journey has seven distinct phases. Each phase has a dominant emotion, a patient need, and a design obligation. These must be understood before any screen is wireframed.'),
  spacer(6),

  sectionTitle('The Seven-Phase Journey'),
  pillarsTable(
    ['Phase', 'Patient Emotion', 'Patient Need', 'HairOS Obligation'],
    [
      ['1. Arrival', 'Anxiety + self-consciousness', 'To feel safe, not judged', 'Immediate warmth. The interface greets, does not assess.'],
      ['2. Invitation', 'Curiosity tempered by scepticism', 'To understand what this is and why it’s worth their time', 'Clear value proposition. No jargon. Emotional hook within 8 seconds.'],
      ['3. Engagement', 'Cautious participation', 'To feel that their specific situation is being heard', 'Personalisation signals. Every question must feel purposeful, not procedural.'],
      ['4. Revelation', 'Surprise + recognition', '"This is actually about me. They know things I didn’t know."', 'Deliver a genuine insight the patient had not previously understood about themselves.'],
      ['5. Understanding', 'Clarity + emotional processing', 'To sit with new information without being rushed', 'Pacing. Allow pauses. Never rush from insight to sales.'],
      ['6. Hope', 'Cautious optimism', 'To believe their situation can genuinely improve', 'Evidence-led possibility. Real outcomes, real timelines, real percentages.'],
      ['7. Decision', 'Motivated readiness', 'To take a clear, confident next step without pressure', 'One clear CTA. Decisive but never coercive. Always patient-framed.'],
    ]
  ),
  spacer(8),

  sectionTitle('Emotional Transitions — The Critical Moments'),
  bodyText('The journey between phases is where trust is won or lost. These transitions must be consciously designed.'),
  spacer(4),

  principleTitle('2.1 — The Anxiety-to-Safety Transition (Phase 1 → 2)'),
  whyBlock('The first 8 seconds of any clinical digital experience are the highest-stakes moment. Patients arrive carrying years of emotional weight around their hair loss. If the opening screen feels institutional, judgmental, or transactional, the emotional armour goes up and never comes down.'),
  spacer(3),
  howBlock('Open with beauty and warmth, not information. The first visual should be aspirational — rich, human, unhurried. The first words should be relational, not procedural. Use the patient’s name if known. Begin with acknowledgment, not instruction: "This is your moment to understand what’s really happening." Never begin with "Please fill in the following form."'),
  spacer(3),
  neverBlock('Never open with a login screen, a consent checkbox, or a list of questions. Never use clinical photography as a welcome image. Never begin with the clinic’s logo as the primary visual.'),
  spacer(6),

  principleTitle('2.2 — The Scepticism-to-Curiosity Transition (Phase 2 → 3)'),
  whyBlock('Modern patients are sophisticated media consumers. They have seen AI used to over-promise and under-deliver. Their default stance toward AI-powered diagnostics is measured scepticism. We must earn curiosity, not assume it.'),
  spacer(3),
  howBlock('Demonstrate capability before claiming it. Show a micro-preview of what the analysis produces — a sample follicle map, an anonymised density score, a brief animated glimpse of what the AI "sees." Let the patient touch something real before they invest trust. The experience of HairOS must be self-evidently impressive, not described as impressive.'),
  spacer(3),
  neverBlock('Never use the phrase "powered by AI" as a trust-builder without evidence of what that AI does. Never show stock photography of neural networks or servers. Never describe the system’s capabilities without showing them.'),
  spacer(6),

  principleTitle('2.3 — The Data-to-Revelation Transition (Phase 3 → 4)'),
  whyBlock('The moment a patient’s personalised insight appears is the emotional climax of the entire experience. It must be treated with the gravity and craft of a theatrical reveal. Done poorly, it feels like a spreadsheet. Done brilliantly, it feels like a diagnosis from the world’s best doctor.'),
  spacer(3),
  howBlock('Build anticipation during analysis. Use the processing time (real or padded to 30–60 seconds) to build narrative tension: "Mapping your follicle density across 47 scalp zones…" Reveal insights sequentially, not simultaneously. Lead with the most surprising or personally resonant finding. Frame every data point as a story: "Your hairline has receded 1.8mm in the last 12 months — a rate that responds exceptionally well to early intervention."'),
  spacer(3),
  neverBlock('Never show raw data tables as the primary output. Never reveal all findings simultaneously. Never frame the revelation as a score or grade — patients are not exam results.'),
  spacer(6),

  principleTitle('2.4 — The Understanding-to-Hope Transition (Phase 5 → 6)'),
  whyBlock('This is the most delicate transition in the entire journey. Patients have just received honest, sometimes sobering, information about their hair health. The move from "understanding the problem" to "believing in a solution" must feel earned, not manufactured. Rush it, and it reads as a sales technique. Honour it, and it becomes the moment the patient genuinely believes their situation can change.'),
  spacer(3),
  howBlock('Build a bridge of evidence. Between the diagnosis and the treatment, introduce clinical outcome data — real percentages, real timelines, real patient profiles similar to this patient. Use language like: "Patients with your exact follicle pattern who began treatment within 6 months showed a 74% reduction in shedding rate by month 9." This is not optimism. This is probability. And probability, presented clearly, is deeply comforting.'),
  spacer(3),
  neverBlock('Never use before/after photography during this transition — it reads as advertising at the wrong emotional moment. Never promise specific outcomes to individual patients. Never skip this transition phase and jump from diagnosis to price.'),
  pageBreak(),
];

// ── CH 3: VISUAL PRINCIPLES ───────────────────────────────────
const ch3 = [
  chapterNum(3),
  chapterTitle('Visual Principles'),
  chapterSubtitle('The aesthetic language that communicates precision, premium, and trust'),
  rule(C.gold, 8),
  spacer(6),

  bodyText('Visual design in HairOS is never decoration. Every visual decision is a trust decision. Every colour choice is a psychological choice. Every spacing decision is an emotional choice. The visual system must function at three simultaneous levels: it must be beautiful enough to signal premium quality, precise enough to signal clinical credibility, and warm enough to signal human care.'),
  spacer(4),
  quoteBlock('Design is not just what it looks like and feels like. Design is how it works.', 'Steve Jobs'),
  spacer(6),

  sectionTitle('The HairOS Colour System'),
  pillarsTable(
    ['Token', 'Hex', 'Role', 'Psychological Signal'],
    [
      ['Obsidian', '#0A0E1A', 'Primary depth / backgrounds / authority text', 'Depth, seriousness, luxury, trust'],
      ['Gold', '#C8A96E', 'Primary accent / highlight / premium marker', 'Premium quality, warmth, earned expertise'],
      ['Sage', '#3D6B50', 'Trust / nature / clinical hope', 'Organic health, growth, medical credibility'],
      ['Platinum', '#F0F1F3', 'Surface / breathing space / clinical clarity', 'Clean, precise, unhurried, professional'],
      ['Charcoal', '#2C3142', 'Body text / secondary information', 'Readable authority, calm confidence'],
      ['Warm Gray', '#6B7280', 'Supporting text / captions / metadata', 'Secondary, non-alarming, supportive'],
      ['Clinical White', '#FFFFFF', 'Data displays / result cards / imagery ground', 'Clarity, medical precision, truth-telling'],
    ]
  ),
  spacer(8),

  principleTitle('3.1 — Depth over flatness'),
  whyBlock('Flat design, while clean, communicates nothing about quality. Premium clinical experiences require visual depth — not through skeuomorphism, but through layering, shadow, and material suggestion. Depth signals that something substantial exists behind the interface. It creates the unconscious perception of a system with more inside it than you can see.'),
  spacer(3),
  howBlock('Use a three-layer depth system: (1) Background layer — dark Obsidian surfaces suggesting depth and importance; (2) Surface layer — Platinum and white cards elevated slightly off the background; (3) Interactive layer — gold-accented elements that rise to meet the patient’s touch. Apply subtle shadow (not drop-shadow, but ambient shadow) to surface cards. Use gentle gradients, not flat fills, on primary surfaces.'),
  spacer(3),
  neverBlock('Never use flat single-colour backgrounds for the entire screen. Never use pure black (#000000) or pure white (#FFFFFF) as primary surfaces — use Obsidian and Platinum. Never use drop shadows that look decorative rather than structural.'),
  spacer(6),

  principleTitle('3.2 — Typography as architecture'),
  whyBlock('Typography in HairOS is not text styling. It is the primary structural system of the visual language. The hierarchy of type communicates the hierarchy of information — what matters, what supports, what is secondary. Patients read typographic hierarchy even when they don’t read the words.'),
  spacer(3),
  howBlock('Use a two-family system: Garamond (or equivalent premium serif) for all patient-facing emotional content — headlines, insights, revelations, the words that carry meaning; Arial or equivalent clean sans-serif for all informational content — data labels, navigation, technical terms, UI elements. The serif/sans division is not aesthetic; it is semantic. Serif = human and meaningful. Sans = precise and informational. Maintain a minimum 4-step type scale with genuine contrast between levels.'),
  spacer(3),
  neverBlock('Never use more than two type families. Never use condensed or decorative fonts. Never set body copy below 16px (on screen) or 22pt (in documents). Never use all-caps for body content — only for labels and meta-information. Never use light weight type on dark backgrounds.'),
  spacer(6),

  principleTitle('3.3 — Whitespace as a premium signal'),
  whyBlock('Every premium brand in the world uses more whitespace than its cheaper competitors. Whitespace is not empty space — it is the visual breathing room that allows individual elements to carry weight and importance. Crowded interfaces feel anxious. Spacious interfaces feel confident. Confidence is what patients need to see.'),
  spacer(3),
  howBlock('Apply an 8px base grid. Content blocks should have a minimum 48px vertical separation. Major sections should have 80–120px separation. Data visualisations should float within generous padding that prevents them feeling claustrophobic. The rule: if it feels like there’s too much space, add more.'),
  spacer(3),
  neverBlock('Never crowd information because there is "a lot to show." Paginate, sequence, or accordion instead. Never justify text — it creates uneven rivers of whitespace. Never let content touch screen edges without minimum 24px margin.'),
  spacer(6),

  principleTitle('3.4 — Imagery must earn its place'),
  whyBlock('Stock photography destroys premium brand perception instantly. In a clinical setting, inappropriate imagery actively damages trust. Every image in HairOS must be either (a) clinical/scientific data visualisation, (b) authentically photographed patient environments, or (c) abstract scientific imagery with genuine relevance. Never decorative. Never generic.'),
  spacer(3),
  howBlock('Commission a dedicated image library of: close-up follicle imagery under controlled clinical lighting, scalp cross-section illustrations with medical accuracy, abstract macro photography of biological structures that suggest hair without being literal, clinic environment photography that communicates premium and calm. Never use general wellness stock photography.'),
  spacer(3),
  neverBlock('Never use before/after photography within the diagnostic experience (reserve for treatment consultation only, with patient consent). Never use models whose hair looks aspirationally perfect — this alienates patients in distress. Never use generic "doctor with patient" stock imagery.'),
  pageBreak(),
];

// ── CH 4: UX PRINCIPLES ────────────────────────────────────────
const ch4 = [
  chapterNum(4),
  chapterTitle('UX Principles'),
  chapterSubtitle('The structural logic that makes the experience effortless and trustworthy'),
  rule(C.gold, 8),
  spacer(6),

  bodyText('UX in HairOS is not interaction design. It is experience architecture — the invisible structure that determines whether a patient feels guided or lost, respected or processed, curious or bored. Good UX is the absence of friction. Great UX is the presence of delight.'),
  spacer(6),

  principleTitle('4.1 — One thought per screen'),
  whyBlock('Cognitive load is the enemy of emotional engagement. When a patient is processing new, emotionally charged information about their hair health, every additional piece of information competes for their attention and diminishes the impact of the primary message. The human brain processes one significant idea at a time. Work with that, not against it.'),
  spacer(3),
  howBlock('Enforce a strict one-primary-message rule per screen. Every screen has exactly one dominant element (text, data visualisation, or image) that carries the primary message. Supporting information exists in a clearly subordinate visual layer. Navigation and controls should be invisible until needed. Use progressive disclosure — the patient earns more information by engaging with what is already present.'),
  spacer(3),
  neverBlock('Never show two data visualisations on the same screen simultaneously. Never place a call-to-action on a screen where the primary purpose is information delivery. Never use a carousel to present multiple insights — patients skip carousels. Never allow the interface to show more than three text blocks without a visual break.'),
  spacer(6),

  principleTitle('4.2 — The guided journey, not the open interface'),
  whyBlock('Clinical experiences require directed flow. Unlike consumer apps where exploration is valued, a diagnostic experience requires clarity of path. Patients should never have to decide what to do next. Uncertainty about the next step converts directly into anxiety — and anxiety is the emotion that most commonly causes patients to disengage.'),
  spacer(3),
  howBlock('Design a single linear path with no optional dead-ends. Every screen has one next action. Never present a menu of options as a primary navigation mode during the diagnostic journey. If branching is medically required (different questions for different conditions), make branching invisible to the patient. Present always as "your personalised next question," never as "choose your path."'),
  spacer(3),
  neverBlock('Never use tabbed navigation during the diagnostic flow. Never use a back button as a primary navigation element during the journey — it suggests going backward. Never show a progress tracker with specific numbered steps (it makes the experience feel like a form). If progress must be shown, use an abstract, ambient indicator.'),
  spacer(6),

  principleTitle('4.3 — Error states as care, not failure'),
  whyBlock('In consumer apps, error states are engineering problems. In clinical emotional experiences, error states are trust moments. A patient who sees an error message — even for a trivial camera permission issue — experiences a rupture in the sense of expert guidance. Every error must be designed as carefully as every success state.'),
  spacer(3),
  howBlock('Never use the word "error." Use "we need a moment more" or "let’s try that again together." Every failure state has: (a) an explanation in plain, warm language; (b) a single clear recovery action; (c) an optional alternative path. Camera failure: "For the most accurate reading, could you move to a space with even, natural light?" Not: "Camera permission denied." All error states maintain the visual quality of the rest of the experience.'),
  spacer(3),
  neverBlock('Never show system-level error codes or technical messages. Never use red as the primary colour of an error state — it triggers medical alarm in a clinical context. Never blame the patient for an error (e.g., "invalid input"). Never use a generic "something went wrong" message.'),
  spacer(6),

  principleTitle('4.4 — Accessibility is a clinical obligation'),
  whyBlock('Hair loss is disproportionately distressing for patients with pre-existing anxiety, depression, and body dysmorphic tendencies. These patients are also more likely to experience cognitive load more acutely. Accessibility in HairOS is not a compliance checkbox — it is a direct expression of the clinical ethics of patient care.'),
  spacer(3),
  howBlock('Minimum WCAG AA compliance for all text. Minimum 4.5:1 contrast ratio for all body text. Minimum 3:1 for large text and UI components. All interactive elements must be reachable and operable by touch (minimum 44x44px targets). Never rely on colour alone to communicate meaning. Support device-level accessibility settings (reduced motion, larger text, high contrast). Text alternatives for all non-decorative imagery.'),
  spacer(3),
  neverBlock('Never consider accessibility a second phase or post-launch initiative. Never design for a specific user type (e.g., "young, healthy adults") — the patient population is diverse in age, vision, and cognitive state. Never use animated elements without providing reduced-motion alternatives.'),
  pageBreak(),
];

// ── CH 5: MOTION PRINCIPLES ───────────────────────────────────
const ch5 = [
  chapterNum(5),
  chapterTitle('Motion Principles'),
  chapterSubtitle('How HairOS moves: the kinetic language of precision, intelligence, and life'),
  rule(C.gold, 8),
  spacer(6),

  bodyText('Motion is not decoration. In HairOS, every animation carries meaning. Every transition communicates something about the system\'s intelligence, the data\'s precision, or the patient\'s journey. Motion that exists for its own sake actively damages the premium perception we are building.'),
  spacer(4),
  quoteBlock('Motion is the emotional language of digital. It tells the patient: this system is alive, it is paying attention, and it is working specifically for you.'),
  spacer(6),

  sectionTitle('Motion Vocabulary'),
  pillarsTable(
    ['Motion Type', 'Purpose', 'Duration', 'Easing'],
    [
      ['Reveal', 'Bringing new information into focus', '400–600ms', 'Ease-out cubic'],
      ['Transition', 'Moving between screens or states', '300–450ms', 'Ease-in-out cubic'],
      ['Processing', 'Communicating active computation', 'Looping, ambient', 'Linear or sine'],
      ['Emphasis', 'Drawing attention to a key insight', '200–300ms', 'Spring (slight overshoot)'],
      ['Exit', 'Removing content with grace', '250–350ms', 'Ease-in cubic'],
      ['Data Build', 'Constructing visualisations in real time', '800ms–1.8s', 'Ease-out, staggered'],
      ['Micro-feedback', 'Confirming patient interaction', '80–150ms', 'Ease-out'],
    ]
  ),
  spacer(8),

  principleTitle('5.1 — Every animation must have a semantic reason'),
  whyBlock('The human visual system is exquisitely sensitive to motion. Unnecessary motion consumes attention that should be directed at content. In a clinical setting, gratuitous animation reads as frivolous — the visual equivalent of a nervous habit. It undermines the perception of calm authority.'),
  spacer(3),
  howBlock('Before any animation is approved, the designer must answer: "What does this motion communicate?" Valid answers include: "It shows the AI is actively processing this patient\'s data," "It reveals information progressively to allow emotional processing," "It confirms the patient’s action was received." Invalid answers: "It looks impressive," "It fills the loading time," "It makes the screen feel more alive."'),
  spacer(3),
  neverBlock('Never use particle effects, confetti, or celebration animations in a diagnostic context. Never use bouncing, wobbling, or cartoonish motion physics — all motion should feel weighted and precise. Never loop animations indefinitely on screens where the patient is reading or processing information.'),
  spacer(6),

  principleTitle('5.2 — The Analysis Ritual'),
  whyBlock('The moment when HairOS processes a patient’s images and data is the most important motion sequence in the entire product. Patients who wait without visual feedback feel uncertain and disengaged. The processing animation is not a loading screen — it is a performance of intelligence. It must communicate that something genuinely complex and specific is happening.'),
  spacer(3),
  howBlock('Design a multi-phase processing sequence lasting 45–90 seconds (pad with real analysis if needed). Phase 1 (0–15s): Follicle pattern mapping — show a scanline moving across the scalp image, detecting and marking individual follicles with precision. Phase 2 (15–40s): Density analysis — overlay a heat-mapped grid that fills in progressively, with specific zone percentages appearing as each zone completes. Phase 3 (40–65s): Pattern classification — show the patient’s pattern being matched against a classification system with subtle connecting lines. Phase 4 (65s+): Profile assembly — results begin to crystallise from fragmented data into a coherent card layout, one insight at a time.'),
  spacer(3),
  neverBlock('Never show a generic spinner or progress bar as the primary analysis indicator. Never show fake operations (e.g., "Checking 2,400,000 records") that are clearly performative without substance. Never complete analysis in under 15 seconds even if technically possible — speed without visible process implies shallowness.'),
  spacer(6),

  principleTitle('5.3 — Insight Reveal as cinematic moment'),
  whyBlock('When a patient’s results appear, this is the emotional climax of their entire experience. The motion design of this moment must treat that weight seriously. A fade-in is not sufficient. An instant appearance is clinical to the point of coldness. The reveal must feel like something important is being uncovered — not displayed.'),
  spacer(3),
  howBlock('Use a structured sequential reveal: (1) The scalp map appears with a slow, ambient bloom from the centre outward over 1.2 seconds; (2) The primary insight — the single most important finding — fades in alone, given 2–3 seconds of visual solitude; (3) Supporting data points build in from the left with a gentle stagger, 200ms between each; (4) The treatment opportunity section rises from below the fold after a 1-second pause following the data reveal. Total reveal sequence: 8–12 seconds. Never rushed.'),
  spacer(3),
  neverBlock('Never reveal all results simultaneously. Never use a page-load pattern (everything appears at once as the screen loads). Never animate results in a way that draws attention away from the content and toward the motion itself.'),
  pageBreak(),
];

// ── CH 6: INTERACTION PRINCIPLES ──────────────────────────────
const ch6 = [
  chapterNum(6),
  chapterTitle('Interaction Principles'),
  chapterSubtitle('How patients touch, hear, and communicate with HairOS'),
  rule(C.gold, 8),
  spacer(6),

  bodyText('Every interaction — every tap, every swipe, every response to a question — is a moment of patient agency. The design of these interactions determines whether the patient feels in control of their experience or processed by it. Control breeds confidence. Confidence breeds trust. Trust produces commitment.'),
  spacer(6),

  principleTitle('6.1 — Interaction as dialogue, not form-filling'),
  whyBlock('Medical questionnaires are among the most psychologically aversive experiences in healthcare. They communicate: "You are a data source. Fill in these fields." HairOS must communicate the opposite: "You are a person. Tell us about yourself." The architecture of interaction is the architecture of respect.'),
  spacer(3),
  howBlock('Replace form fields with conversational prompts. Each question appears alone, preceded by an acknowledgment of the previous answer: "Interesting — that helps us understand your pattern better. Now, when did you first notice…" Questions should feel like a brilliant clinician asking them, not a system collecting them. Use natural language answer formats (slider for intensity, visual selection for pattern recognition, voice for narrative responses) rather than text fields wherever possible.'),
  spacer(3),
  neverBlock('Never show more than one question at a time. Never use multi-select checkbox matrices. Never use technical medical language in patient-facing questions without a plain-language explanation. Never require text input when a visual, slider, or voice alternative exists.'),
  spacer(6),

  principleTitle('6.2 — Touch targets designed for emotional states'),
  whyBlock('Patients interacting with HairOS are often in an elevated emotional state. Fine motor control is reduced when the sympathetic nervous system is active (anxiety, self-consciousness). Interaction design must accommodate this. Tap targets that require precision from a calm engineer will be missed by an anxious patient.'),
  spacer(3),
  howBlock('All interactive targets: minimum 56x56px (12px above WCAG minimums). Generous spacing between adjacent interactive elements: minimum 16px. Primary actions should span the full interactive width of the screen, requiring no precision. Avoid placing primary actions in corners or at screen edges. All slider interactions should work with the entire thumb width, not just the handle.'),
  spacer(3),
  neverBlock('Never use precise swipe gestures as primary interactions. Never use small tap targets for high-consequence actions (confirming a treatment plan, moving to next step). Never place a destructive action (go back, start over) adjacent to a constructive one (continue, confirm).'),
  spacer(6),

  principleTitle('6.3 — Camera interaction as ritual, not instruction'),
  whyBlock('For most patients, allowing HairOS to photograph their scalp is the most vulnerable moment in the experience. Exposing the very thing they feel most self-conscious about — to a machine — requires a specific emotional design. If the camera interaction feels technical, procedural, or clinical without warmth, a significant proportion of patients will abandon at this point.'),
  spacer(3),
  howBlock('Reframe the camera as a precision instrument, not a camera. The copy should say: "HairOS will now take a high-resolution follicle reading of three scalp zones." Not: "Please take a photo of your scalp." Provide a live guide overlay that is aspirational — show the follicle density visualisation forming in real time as the patient positions the device, so the act of imaging feels like creation rather than exposure. Coach with warmth: "Perfect. Hold just there — the detail is exceptional."'),
  spacer(3),
  neverBlock('Never say "take a selfie" or use any consumer photography language. Never use a standard camera interface — build a fully branded imaging environment. Never show the raw image back to the patient without first applying the analytical overlay — raw scalp images can be distressing. Never request camera access without first explaining what will be captured and why.'),
  spacer(6),

  principleTitle('6.4 — Voice interaction as optional depth layer'),
  whyBlock('A subset of patients — particularly those who are older, less comfortable with touch interfaces, or who have strong narrative communication styles — will engage far more authentically through voice than through tapping or typing. Offering voice as an interaction modality communicates that HairOS is designed for humans, not users.'),
  spacer(3),
  howBlock('Offer voice as an alternative to text/tap at every open-ended question. Voice responses should be transcribed and displayed back to the patient for confirmation before being stored. The voice interface should use a high-quality TTS voice for any spoken prompts — never synthetic-sounding. Voice is supplementary, not required. The full experience must be completable without voice.'),
  spacer(3),
  neverBlock('Never make voice the default or only modality. Never use voice prompts that interrupt a patient who is reading. Never display raw transcription errors without a correction opportunity. Never use robotic TTS voice — it shatters the premium perception.'),
  pageBreak(),
];

// ── CH 7: CLINICAL TRUST PRINCIPLES ───────────────────────────
const ch7 = [
  chapterNum(7),
  chapterTitle('Clinical Trust Principles'),
  chapterSubtitle('The foundations of medical credibility in a digital experience'),
  rule(C.gold, 8),
  spacer(6),

  bodyText('Trust in a clinical context is categorically different from trust in a consumer context. Consumers trust brands. Patients trust systems that demonstrate competence, transparency, and ethical grounding. Clinical trust takes longer to build, is more fragile, and once broken, is almost impossible to rebuild. Every design decision in HairOS is a trust decision.'),
  spacer(4),
  quoteBlock('A patient who trusts is a patient who listens. A patient who listens is a patient who acts. A patient who acts is a patient who heals.'),
  spacer(6),

  principleTitle('7.1 — Transparency over impression management'),
  whyBlock('Patients in 2026 are acutely sensitive to systems that appear to be managing their perception rather than communicating honestly. AI systems in particular are under enormous public scrutiny. HairOS must over-index on transparency to counteract the inherent skepticism that any AI diagnostic system faces.'),
  spacer(3),
  howBlock('Every AI finding must include a confidence indicator displayed clearly and explained in plain language: "This finding has a 94% confidence rating based on analysis of 2.4M comparable follicle profiles. The remaining 6% uncertainty relates to image angle variation." Disclose what the AI cannot assess: "Hormonal factors require blood panel confirmation." Never present AI findings as definitive clinical diagnosis. Always present as: "HairOS has identified… Your clinician will confirm."'),
  spacer(3),
  neverBlock('Never hide uncertainty. Never round up confidence percentages. Never present AI analysis as equivalent to clinical examination. Never use the word "diagnosis" in patient-facing content — use "assessment," "finding," or "profile." Never omit the clinician’s role in confirming HairOS findings.'),
  spacer(6),

  principleTitle('7.2 — Evidence must be specific, not claimed'),
  whyBlock('Vague claims of evidence ("clinically proven," "scientifically validated") are actively trust-negative in 2026. Patients have been burned by these phrases in consumer wellness. In a clinical context, they are worse than useless — they signal that no specific evidence exists. Specific evidence, presented clearly, is one of the most powerful trust-building tools available.'),
  spacer(3),
  howBlock('Every efficacy claim must include: (1) the specific study or dataset it references; (2) the sample size; (3) the outcome measured; (4) the timeframe; (5) the patient profile. Example: "87% of patients with Stage II androgenic alopecia and your follicle density profile showed measurable density improvement at 6 months in our 2024 multi-clinic trial (n=342)." This is not marketing copy. This is the language of earned trust.'),
  spacer(3),
  neverBlock('Never use unattributed statistics. Never claim percentages without specifying what was measured. Never use meta-analyses as if they were direct clinical trials. Never reference studies older than 10 years as primary evidence. Never allow marketing to soften or round off clinical statistics.'),
  spacer(6),

  principleTitle('7.3 — The clinician is always present'),
  whyBlock('HairOS operates within a clinical environment where a human clinician is the responsible party for patient care. Any design that positions HairOS as replacing the clinician rather than empowering them creates both ethical risk and legal exposure. More critically, it is psychologically counterproductive: patients trust humans. The presence of a named, credentialed clinician who will review HairOS findings dramatically increases patient confidence in those findings.'),
  spacer(3),
  howBlock('At minimum three touchpoints in the patient experience must make the clinician’s role explicit: (1) During onboarding: "Today’s assessment is prepared for review by [Clinician Name], your specialist." (2) During insight delivery: "These findings will be presented to your clinician, who will discuss them with you today." (3) At completion: "Your full report has been sent to [Clinician Name] ahead of your consultation." The clinician’s profile (photo, credentials) should appear in the experience as a grounding element.'),
  spacer(3),
  neverBlock('Never position HairOS as the primary diagnostic authority. Never omit clinician context from the results presentation. Never allow the patient to complete the HairOS experience without a clear next-step to human clinical interaction. Never design the experience as if the patient is only interacting with AI.'),
  spacer(6),

  principleTitle('7.4 — Data privacy as visible commitment'),
  whyBlock('Scalp imagery, personal health data, and treatment preferences are among the most sensitive data a patient can share. In a post-GDPR, post-surveillance-capitalism world, patients are acutely aware of how their data might be used. Data privacy cannot be buried in a terms-and-conditions screen — it must be a visible, expressed commitment at every data collection point.'),
  spacer(3),
  howBlock('At every point where data is collected, display a brief, plain-language statement of how that specific data is used, stored, and protected. Example (at image capture): "Your scalp images are processed locally on this device and used only for your personal assessment. They are never stored externally without your explicit consent." Privacy disclosures should feel like reassurance from a trusted provider, not legal disclaimers from a corporation.'),
  spacer(3),
  neverBlock('Never use legal disclaimer language in patient-facing privacy communications. Never bundle data consent into a general terms-of-service acceptance. Never collect data that is not directly necessary for the diagnostic assessment. Never share patient data with third parties without multi-step explicit consent.'),
  pageBreak(),
];

// ── CH 8: CONVERSION PRINCIPLES ───────────────────────────────
const ch8 = [
  chapterNum(8),
  chapterTitle('Conversion Principles'),
  chapterSubtitle('The ethical architecture of patient commitment'),
  rule(C.gold, 8),
  spacer(6),

  bodyText('Conversion in HairOS is not a sales metric. It is the moment when a patient decides to begin their treatment journey. That decision should be the natural, inevitable conclusion of a well-designed experience — not the product of pressure, urgency manipulation, or dark patterns. A patient who chooses treatment because they genuinely understand their situation and the available solutions will be a better clinical outcome than one who was pressured into it.'),
  spacer(4),
  highlight('The conversion rate we optimize for is informed commitment, not impulse response.'),
  spacer(6),

  principleTitle('8.1 — Momentum over interruption'),
  whyBlock('The most effective conversion architecture builds unbroken forward momentum. Every moment of interruption — every request to pause and decide, every point where the patient must actively choose to continue rather than being carried forward — creates an opportunity for disengagement. The journey should feel like a current, not a set of gates.'),
  spacer(3),
  howBlock('Design the experience so that moving forward is always the path of least resistance. The default state of every screen is: continue. Stopping requires active decision. Use "continue" micro-commits throughout the journey to build behavioral momentum. By the time the treatment option is presented, the patient has already committed to moving forward multiple times. The treatment option is simply the next natural step in a journey they are already on.'),
  spacer(3),
  neverBlock('Never interrupt the diagnostic flow to present pricing. Never introduce a treatment option before the diagnostic revelation is emotionally complete. Never place a pause or "would you like to continue?" prompt during the analysis phase. Never use countdown timers or "limited availability" prompts during treatment presentation.'),
  spacer(6),

  principleTitle('8.2 — The single moment of commitment'),
  whyBlock('Research in behavioral economics consistently shows that commitment requests succeed when: they follow a moment of heightened understanding, they offer a single, clear option (not a choice between multiple options), and they frame the decision as beginning something rather than purchasing something. The architecture of the commitment moment in HairOS must apply all three principles simultaneously.'),
  spacer(3),
  howBlock('After the full diagnostic revelation and treatment presentation, the commitment screen should contain exactly one primary action: "Begin My Treatment Plan." Not "Choose a Package." Not "Select Your Option." Not "Buy Now." The button exists within a screen that reinforces the diagnosis-to-solution narrative, with the primary insight and the primary outcome side-by-side. The clinician’s image and name are present. The pricing, if shown, is contextualised within the outcome: "Your 12-month programme: £X — the cost of a single hair transplant, with measurable results from month 3."'),
  spacer(3),
  neverBlock('Never present a pricing table on the commitment screen. Never offer more than one primary action. Never use language that frames the decision as financial ("purchase," "buy," "payment"). Never show a competitor comparison on the commitment screen. Never use urgent language ("Act now," "Limited time") — it converts anxious patients into regretful customers.'),
  spacer(6),

  principleTitle('8.3 — Non-commitment is never failure'),
  whyBlock('A patient who does not commit to treatment today is not a lost conversion — they are a future relationship. How HairOS handles a patient’s decision not to proceed immediately determines whether that patient returns, refers others, and eventually does commit. The exit experience is as important as the conversion experience.'),
  spacer(3),
  howBlock('Design a graceful, dignified path for patients who do not commit. The exit should: thank the patient genuinely for their time, provide a copy of their personal report to take away, offer an explicit invitation to return with no pressure ("Your assessment is saved and will remain current for 90 days"), and ensure the clinician is aware of the outcome so they can follow up appropriately.'),
  spacer(3),
  neverBlock('Never use a dark pattern exit flow (e.g., "Are you sure you want to give up on your hair?"). Never remove access to the patient’s own report as a conversion incentive. Never send automated follow-up emails without explicit consent. Never design the exit experience as a consolation prize — it should feel as premium as the rest of the journey.'),
  pageBreak(),
];

// ── CH 9: PATIENT PSYCHOLOGY ─────────────────────────────────
const ch9 = [
  chapterNum(9),
  chapterTitle('Patient Psychology Principles'),
  chapterSubtitle('Understanding the inner world of every patient HairOS serves'),
  rule(C.gold, 8),
  spacer(6),

  bodyText('You cannot design a great experience for someone you do not understand. The HairOS design team must have a deep, research-backed understanding of the psychological reality of hair loss patients. Not as a demographic. As human beings navigating one of the most psychologically complex experiences in cosmetic healthcare.'),
  spacer(6),

  sectionTitle('Who Is This Patient?'),
  pillarsTable(
    ['Dimension', 'Research Finding', 'Design Implication'],
    [
      ['Identity Impact', '60% of hair loss patients report that hair loss has impacted their self-identity significantly (Springer, 2022)', 'This is identity-level work, not cosmetic. Every touchpoint must communicate that HairOS understands this.'],
      ['Delay Pattern', 'Average time between first noticing hair loss and seeking treatment: 3.2 years (AHRS, 2023)', 'Patients arrive having suffered in silence. Acknowledging this delay validates their experience.'],
      ['Emotion Profile', 'Primary emotions: shame (74%), anxiety (68%), grief (51%), anger (34%) (ISHRS, 2022)', 'The sequence matters. Address shame first, anxiety second, grief third. Never lead with problem-solving.'],
      ['Information Style', '78% of patients have researched their condition extensively before attending a clinic', 'Do not over-explain basics. Do not patronise. Assume sophisticated prior knowledge.'],
      ['Trust Barriers', 'Top trust barriers: perceived overselling (67%), fear of side effects (58%), disbelief in efficacy (52%)', 'Lead with evidence, not promise. Address side effects proactively, not defensively.'],
      ['Gender Difference', 'Women report significantly higher psychosocial impact than men despite lower clinical severity', 'Gender-responsive design: do not assume male-default patient experience.'],
    ]
  ),
  spacer(8),

  principleTitle('9.1 — Shame is the first emotion to address'),
  whyBlock('Shame is the dominant emotion that prevents patients from seeking help, from engaging authentically with assessment tools, and from committing to treatment. Shame thrives in silence and secrecy. A system that treats hair loss as a problem to be solved without first acknowledging the shame dimension will alienate a majority of its patients before they complete the first screen.'),
  spacer(3),
  howBlock('Address shame indirectly but powerfully at the opening of the experience. Not by naming it, but by normalising it: "Hair health is one of the most misunderstood areas of medicine. Most people experience changes long before they understand what’s happening — and even longer before they find the right support." This statement does several things simultaneously: it validates the patient’s delay, it positions the medical system (not the patient) as having failed to provide information, and it frames HairOS as the correction to that system failure.'),
  spacer(3),
  neverBlock('Never use language that implies the patient should have acted sooner. Never frame severity as the patient’s fault. Never show imagery of extensive hair loss as a fear-based motivator. Never use the word "cure" — it implies the patient is sick. Never refer to hair loss as "a problem you should have dealt with."'),
  spacer(6),

  principleTitle('9.2 — Grief must be given space'),
  whyBlock('For many patients, the diagnostic revelation in HairOS is the first time they have seen scientific confirmation of something they have feared and sensed for years. This can trigger a genuine grief response. A design that rushes past this moment to get to the treatment pitch has committed a profound empathy failure. Grief requires space. Space is a design decision.'),
  spacer(3),
  howBlock('After the primary diagnostic revelation, design in a mandatory pause of 3–5 seconds before any new information appears. No button, no prompt, no call-to-action — just the finding, held on screen with gentle, ambient motion. Then: "Take a moment with this. When you’re ready, we’ll explain exactly what this means and what your options are." This tiny intervention has an outsized effect on patient emotional readiness for the information that follows.'),
  spacer(3),
  neverBlock('Never proceed automatically from a significant finding to a treatment option. Never show pricing immediately after delivering a significant diagnosis. Never use celebratory language after a difficult finding ("Great news about your treatment options!"). Never ignore the emotional weight of what the patient has just learned.'),
  spacer(6),

  principleTitle('9.3 — Hope through specificity, not optimism'),
  whyBlock('Generic optimism ("many patients see great results!") is actively counterproductive with this patient group. They have been burned by over-optimistic claims from supplements, shampoos, and lifestyle blogs. Generic hope is indistinguishable from false hope to a patient with sophisticated prior experience of the category. Specific hope — grounded in data that is demonstrably about them specifically — is the only hope worth offering.'),
  spacer(3),
  howBlock('Personalise every outcome statement to the patient’s specific profile: "Patients with your follicle density reading, your documented shedding pattern, and your stage of progression who began [treatment protocol] within 90 days showed an average density improvement of 34% at 12 months." The specificity ("your follicle density reading," "your documented shedding pattern") is what converts scepticism into genuine hope. General statistics create disbelief. Specific, profile-matched statistics create belief.'),
  spacer(3),
  neverBlock('Never use outcome data that is not applicable to this patient’s specific profile. Never present best-case outcomes as typical outcomes. Never use statistical data without specifying the study population. Never show testimonials without clinical context. Never promise a specific outcome to an individual patient.'),
  spacer(6),

  principleTitle('9.4 — Control is the antidote to clinical anxiety'),
  whyBlock('Clinical anxiety — the heightened state of stress that most patients experience in any healthcare context — is driven primarily by lack of control. Patients who feel that things are being done to them, rather than done with them, experience significantly higher anxiety levels and significantly lower trust in the clinical system. Every interaction in HairOS is an opportunity to return agency to the patient.'),
  spacer(3),
  howBlock('At each stage of the experience, give the patient explicit control: the ability to pause, the ability to ask questions (via the clinician messaging function), the ability to revisit their own data, and the ability to exit gracefully at any point. Always explain what is about to happen before it happens. Frame every step as an invitation, not an instruction. Use "You’ll see…" not "We will show you…" The patient is the subject of their own experience.'),
  spacer(3),
  neverBlock('Never lock the patient into a mandatory sequence with no exit. Never collect data without explaining why. Never advance the experience automatically without patient-initiated action. Never design a "no going back" moment without explicit patient acknowledgment.'),
  pageBreak(),
];

// ── CH 10: CLINIC DEPLOYMENT ──────────────────────────────────
const ch10 = [
  chapterNum(10),
  chapterTitle('Clinic Deployment Principles'),
  chapterSubtitle('How HairOS lives in the physical world of premium hair clinics'),
  rule(C.gold, 8),
  spacer(6),

  bodyText('HairOS does not exist in a vacuum. It exists in a physical clinic, surrounded by human beings, environmental design, sensory inputs, and institutional culture. A world-class digital experience deployed into a poorly designed clinical environment will underperform. The clinic space is part of the product. The deployment strategy is part of the design.'),
  spacer(6),

  sectionTitle('The Physical-Digital Integration Matrix'),
  pillarsTable(
    ['Touchpoint', 'Physical Element', 'Digital Element', 'Integration Principle'],
    [
      ['Arrival', 'Reception desk, ambient music, scent, lighting', 'Welcome screen personalised to appointment', 'The screen’s tone must match the room’s tone exactly'],
      ['Waiting', 'Seating area, educational ambient display', 'Ambient HairOS visualisation loop (non-diagnostic)', 'Build curiosity before the experience begins'],
      ['Consultation Room', 'Dedicated tablet or screen, adjustable lighting, private space', 'Full HairOS diagnostic experience', 'Room conditions must be optimised for camera capture'],
      ['Post-Consultation', 'Report printout or digital send, take-home materials', 'Secure report link sent to patient device', 'The report must feel as premium as the experience'],
      ['Follow-up', 'Clinician call or message', 'In-app progress tracking (if on treatment)', 'Human follow-up is never replaced by automated messaging'],
    ]
  ),
  spacer(8),

  principleTitle('10.1 — The room is a design element'),
  whyBlock('Research in environmental psychology demonstrates that the physical environment in which a digital experience occurs directly affects how that experience is perceived. A premium digital experience in a generic, fluorescent-lit room loses 30–40% of its premium perception. The clinic space is not separate from HairOS — it is the frame that determines how HairOS is perceived.'),
  spacer(3),
  howBlock('Provide clinic partners with a Room Readiness Checklist as a condition of deployment: (1) Lighting: warm, dimmable, non-fluorescent; minimum 2700K colour temperature; (2) Seating: patient faces the screen at eye level, no neck strain; (3) Privacy: the consultation room must be genuinely private — no glass walls, no audible conversations from adjacent spaces; (4) Ambient sound: either silence or very low instrumental music at maximum 35dB; (5) Temperature: 19–21°C; (6) Screen: minimum 12.9" tablet or dedicated 24" monitor at 4K resolution; (7) Connectivity: dedicated Wi-Fi circuit, never shared with clinic general access.'),
  spacer(3),
  neverBlock('Never deploy HairOS in an open-plan or shared space. Never allow HairOS to run on a screen with reflective glare. Never deploy on a device with battery concerns — always mains-powered during sessions. Never deploy without verifying that camera capture quality meets the minimum resolution standard for follicle analysis.'),
  spacer(6),

  principleTitle('10.2 — Staff are the experience'),
  whyBlock('The most sophisticated digital experience can be demolished by a single staff interaction. A receptionist who describes HairOS as "just a quick scan" before the patient enters the room has framed the experience as trivial. A clinician who glances at the report and moves on has communicated that HairOS findings are unimportant. Every member of staff who touches the patient journey is a co-author of the HairOS experience.'),
  spacer(3),
  howBlock('Mandatory staff training before clinic deployment covers: (1) How to introduce HairOS — specific language script provided; (2) How to respond to patient questions about the AI — transparency script provided; (3) How to read and discuss the HairOS report in consultation — clinician reference guide provided; (4) What language to avoid — specific words/phrases on the prohibited list. Training must be refreshed at minimum every 6 months and whenever a major update to HairOS is deployed.'),
  spacer(3),
  neverBlock('Never deploy HairOS without completing staff training. Never allow staff to describe HairOS as "a questionnaire" or "an app." Never allow a clinician to dismiss or substantially overrule HairOS findings without explanation — it signals to the patient that the entire experience was performative. Never allow sales staff (not clinicians) to conduct the HairOS session.'),
  spacer(6),

  principleTitle('10.3 — The Ambient Display loop'),
  whyBlock('Patients spend an average of 12 minutes in a clinic waiting area before their appointment. This time is currently wasted in most clinics. A thoughtfully designed ambient display — not advertising, not a slideshow — can begin the curiosity and trust-building process before the patient has even entered the consultation room. Pre-conditioning the patient emotionally increases HairOS engagement metrics by a measurable degree.'),
  spacer(3),
  howBlock('Design a looping ambient display (45–90 second loop) for waiting area screens that shows: abstract follicle density visualisations in motion, fragments of anonymised data patterns without patient identification, brief scientific facts about hair biology presented as elegant typographic cards, and the HairOS brand identity wordmark as a grounding element. The display should feel like science visualisation art, not advertising. No calls to action. No pricing. No "before and after." Pure curiosity provocation.'),
  spacer(3),
  neverBlock('Never show patient images (even anonymised) in a shared waiting area. Never run the diagnostic experience in an ambient display context. Never show pricing or promotional content on the ambient display. Never allow the ambient display to loop faster than 45 seconds — fast loops feel cheap.'),
  spacer(6),

  principleTitle('10.4 — Clinic partner selection as quality control'),
  whyBlock('HairOS is a premium product. Its perception is permanently tied to the clinics in which it is deployed. A single poor-quality clinic deployment that generates negative patient word-of-mouth — "the AI thing at that clinic" — damages the brand equity that every high-quality clinic deployment has built. Selective deployment is not exclusivity for its own sake — it is quality protection.'),
  spacer(3),
  howBlock('Establish and enforce a Clinic Partner Standard that includes: minimum CQC rating (or equivalent regulatory standard), minimum consultation room privacy specification, minimum staff-to-patient ratio, clinician credential requirements, mandatory training completion certification before activation, and a quarterly experience audit. Remove clinic access if standards fall below minimum. The HairOS network is only as strong as its weakest clinic.'),
  spacer(3),
  neverBlock('Never deploy for volume over quality. Never activate a clinic until all training is certified as complete. Never allow a clinic to modify or skip any part of the HairOS patient journey. Never allow a clinic to use HairOS data for purposes beyond the agreed patient care scope.'),
  pageBreak(),
];

// ── CLOSING ───────────────────────────────────────────────────
const closing = [
  spacer(8),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 0, after: 160 },
    children: [new TextRun({ text: 'Closing Principles', font: F.serif, size: 52, bold: true, color: C.obsidian })],
  }),
  rule(C.gold, 8),
  spacer(6),
  bodyText('This Bible is not a constraint. It is a liberation. When every designer, engineer, writer, and clinician in the HairOS ecosystem shares the same foundational understanding of what this experience must achieve and why, the creative space within that understanding is vast.'),
  spacer(4),
  bodyText('The principles here are not rules to be followed mechanically. They are the distilled wisdom of what a vulnerable, intelligent, hopeful patient needs from a clinical AI system. Use them with that understanding, and the work you create will transcend what any single principle could prescribe.'),
  spacer(6),
  highlight('Build for the patient who is afraid to be here. Design for the moment they realise they were right to come.'),
  spacer(8),
  rule(C.gold, 4),
  spacer(4),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'HairOS Experience Bible — Version 1.0', font: F.sans, size: 18, color: C.warmGray })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40 },
    children: [new TextRun({ text: 'Classification: Internal Design & Development Reference', font: F.sans, size: 18, color: C.warmGray })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40 },
    children: [new TextRun({ text: '© 2026 HairOS. All rights reserved.', font: F.sans, size: 18, color: C.warmGray })],
  }),
];

// ── DOCUMENT ASSEMBLY ─────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  styles: {
    default: {
      document: { run: { font: F.sans, size: 22, color: C.charcoal } },
    },
    paragraphStyles: [
      {
        id: 'Heading1',
        name: 'Heading 1',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { size: 56, bold: true, font: F.serif, color: C.obsidian },
        paragraph: {
          spacing: { before: 40, after: 200 },
          outlineLevel: 0,
        },
      },
      {
        id: 'Heading2',
        name: 'Heading 2',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { size: 28, bold: true, font: F.sans, color: C.obsidian },
        paragraph: {
          spacing: { before: 400, after: 160 },
          outlineLevel: 1,
        },
      },
      {
        id: 'Heading3',
        name: 'Heading 3',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { size: 30, bold: true, font: F.serif, color: C.charcoal },
        paragraph: {
          spacing: { before: 280, after: 120 },
          outlineLevel: 2,
        },
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'HairOS Experience Bible', font: F.sans, size: 18, color: C.warmGray }),
                new TextRun({ text: '\t', font: F.sans }),
                new TextRun({ text: 'CONFIDENTIAL — INTERNAL', font: F.sans, size: 18, color: C.steel }),
              ],
              tabStops: [{ type: 'right', position: 9360 }],
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.gold, space: 1 } },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: '© 2026 HairOS', font: F.sans, size: 16, color: C.steel }),
                new TextRun({ text: '\t', font: F.sans }),
                new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], font: F.sans, size: 16, color: C.warmGray }),
              ],
              tabStops: [{ type: 'right', position: 9360 }],
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.gold, space: 1 } },
            }),
          ],
        }),
      },
      children: [
        ...coverPage,
        ...tocPage,
        ...preamble,
        ...ch1,
        ...ch2,
        ...ch3,
        ...ch4,
        ...ch5,
        ...ch6,
        ...ch7,
        ...ch8,
        ...ch9,
        ...ch10,
        ...closing,
      ],
    },
  ],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('HairOS_Experience_Bible.docx', buf);
  console.log('Done: HairOS_Experience_Bible.docx');
}).catch(err => {
  console.error(err);
  process.exit(1);
});
