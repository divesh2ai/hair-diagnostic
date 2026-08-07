/**
 * protocolAdapter.ts
 *
 * Bridges the DrFACT clinical schema format (questionnaire.schema.json)
 * to the renderer-compatible Question[] format consumed by the runtime engines.
 *
 * Rules:
 *  - NEVER duplicates protocol definitions — always reads from masterProtocol
 *  - Preserves all scoring signals, clinical mappings, source references
 *  - Converts schema operators to runtime LogicCondition operators
 *  - Expands partial keyword skip conditions to exact option values
 *  - Derives mutualExclusivityGroups from schema mutual exclusion rules
 *  - Maps dynamicFilterRule → filterOptions for the optionFilterEngine
 */

import type {
  MasterProtocol,
  SchemaQuestion,
  SchemaSection,
  SchemaSkipCondition,
  SchemaVisibilityRule,
  SchemaDynamicFilterRule,
  SchemaMutualExclusivityRules,
  SchemaOption,
} from '@hairos/packages/ai-engine/questionnaire-engine/protocol/masterProtocol';

import type {
  Question,
  QuestionOption,
  LogicCondition,
  QuestionCategory,
  QuestionType,
} from '@/types/questionnaire';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION → CATEGORY MAPPING
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_TO_CATEGORY: Record<string, QuestionCategory> = {
  // Hair protocol
  S1_PATIENT_IDENTITY: 'about_you',
  S2_HAIR_LOSS_ASSESSMENT: 'hair_health',
  S3_SCALP_CONDITION: 'scalp_assessment',
  S4_MEDICAL_HISTORY: 'medical',
  S5_NUTRITION_AND_DIET: 'nutrition',
  S6_GRADE_AND_ADDITIONAL: 'hair_health',
  // Skin — acne branch
  SKN_S1_ABOUT_YOU: 'skin_about_you',
  SKN_S2_YOUR_ACNE: 'skin_acne_lesions',
  SKN_S3_TRIGGERS: 'skin_acne_triggers',
  SKN_S4_PREVIOUS_TREATMENT: 'skin_previous_treatment',
  SKN_S5_SAFETY_UPLOADS: 'skin_safety_uploads',
};

// ─────────────────────────────────────────────────────────────────────────────
// PARTIAL VALUE EXPANSION MAP
// Some skipLogic conditions use keyword fragments ("regrow", "greying") instead
// of the full option values. This map resolves them to exact option values so
// the contains operator works with exact array membership.
// ─────────────────────────────────────────────────────────────────────────────

const PARTIAL_VALUE_EXPANSIONS: Record<string, Record<string, string>> = {
  goal: {
    regrow: 'Hair fall is stopped but needs to regrow lost hair',
    greying: 'Early greying of hair',
    Greying: 'Early greying of hair',
    'Early greying': 'Early greying of hair',
  },
  immunity: {
    'Alopecia Areata': 'Alopecia Areata (circular patches)',
  },
};

function expandPartialValue(field: string, partial: string): string {
  return PARTIAL_VALUE_EXPANSIONS[field]?.[partial] ?? partial;
}

function expandPartialValues(field: string, partials: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const p of partials) {
    const expanded = expandPartialValue(field, p);
    if (!seen.has(expanded)) {
      seen.add(expanded);
      result.push(expanded);
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATOR MAPPING
// ─────────────────────────────────────────────────────────────────────────────

type RuntimeOperator = LogicCondition['operator'];

function mapOperator(schemaOp: string, invert: boolean): RuntimeOperator {
  const direct: Record<string, RuntimeOperator> = {
    equals: 'equals',
    notEquals: 'not_equals',
    includes: 'contains',
    includesAny: 'contains',
    notIncludes: 'not_contains',
    lessThan: 'less_than',
    greaterThan: 'greater_than',
  };
  const inverted: Record<string, RuntimeOperator> = {
    equals: 'not_equals',
    notEquals: 'equals',
    includes: 'not_contains',
    includesAny: 'not_contains',
    notIncludes: 'contains',
    // Note: numeric inversion requires offsetting the value by 1 (integer
    // ages only). Handled in invertNumericCondition() below — these entries
    // exist for completeness but the value-shift is applied separately.
    lessThan: 'greater_than',
    greaterThan: 'less_than',
  };
  return (invert ? inverted[schemaOp] : direct[schemaOp]) ?? (invert ? 'not_equals' : 'equals');
}

// ─────────────────────────────────────────────────────────────────────────────
// CONDITION CONVERTERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a schema skip condition to one or more runtime LogicConditions.
 * includesAny with multiple values expands into multiple OR conditions.
 */
function convertSkipCondition(
  cond: SchemaSkipCondition,
  invert: boolean = false
): LogicCondition[] {
  const { dependsOn, operator, value } = cond;

  if (operator === 'includesAny' && Array.isArray(value)) {
    const expanded = expandPartialValues(dependsOn, value as string[]);
    const op = mapOperator(operator, invert);
    return expanded.map(v => ({ field: dependsOn, operator: op, value: v }));
  }

  // Single value
  const scalarValue = Array.isArray(value) ? value[0] : value;
  const expanded = expandPartialValue(dependsOn, scalarValue);
  const op = mapOperator(operator, invert);
  return [{ field: dependsOn, operator: op, value: expanded }];
}

/**
 * Convert a schema visibilityRule to a skipIf condition (inverted semantics).
 * "show if X equals Female" → "skip if X not_equals Female"
 */
function convertVisibilityRule(rule: SchemaVisibilityRule): LogicCondition {
  const conds = convertSkipCondition(
    { dependsOn: rule.dependsOn, operator: rule.operator, value: rule.value },
    true // invert: visibility → skip
  );
  return conds[0]; // visibility rules are always single-value
}

// ─────────────────────────────────────────────────────────────────────────────
// SKIP CONDITIONS BUILDER
// Merges skipLogic items and visibility rules into a deduplicated skipIf array.
// ─────────────────────────────────────────────────────────────────────────────

function buildSkipConditions(q: SchemaQuestion): LogicCondition[] {
  const conditions: LogicCondition[] = [];
  const seen = new Set<string>();

  function addCondition(c: LogicCondition) {
    const key = `${c.field}:${c.operator}:${JSON.stringify(c.value)}`;
    if (!seen.has(key)) {
      seen.add(key);
      conditions.push(c);
    }
  }

  // From skipLogic items
  for (const item of q.skipLogic ?? []) {
    for (const c of convertSkipCondition(item.if)) {
      addCondition(c);
    }
  }

  // From visibilityRules (inverted)
  for (const rule of q.visibilityRules ?? []) {
    addCondition(convertVisibilityRule(rule));
  }

  return conditions;
}

// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC FILTER RULE → filterOptions
// ─────────────────────────────────────────────────────────────────────────────

function parseConditionToLogic(condition: string): LogicCondition[] {
  // "parseInt(ans.age) >= 30"  →  age > 29
  if (/age.*>=\s*30/.test(condition)) {
    return [{ field: 'age', operator: 'greater_than', value: 29 }];
  }
  // "ans.sex !== 'Female'"  →  sex not_equals Female
  if (/sex\s*!==\s*['"]Female['"]/.test(condition)) {
    return [{ field: 'sex', operator: 'not_equals', value: 'Female' }];
  }
  // "ans.age < N || ans.age > M"  →  age outside range [N, M] (OR semantics)
  // Used by the Heavy bleeding periods option to hide outside the active
  // reproductive window. visibilityEngine ORs multiple conditions in 'any'
  // mode, so returning both bounds produces the desired hide-if-outside-range.
  const ageRange = condition.match(/ans\.age\s*<\s*(\d+)\s*\|\|\s*ans\.age\s*>\s*(\d+)/);
  if (ageRange) {
    const low = Number(ageRange[1]);
    const high = Number(ageRange[2]);
    return [
      { field: 'age', operator: 'less_than', value: low },
      { field: 'age', operator: 'greater_than', value: high },
    ];
  }
  return [];
}

function buildFilterOptions(
  q: SchemaQuestion
): Question['filterOptions'] {
  const result: NonNullable<Question['filterOptions']> = [];

  // ── Question-level dynamicFilterRule ──────────────────────────────────────
  const rule: SchemaDynamicFilterRule | undefined = q.dynamicFilterRule;
  if (rule) {
    const hideIf = parseConditionToLogic(rule.condition);
    if (hideIf.length) {
      if (rule.removedOptions?.length) {
        for (const optId of rule.removedOptions) {
          result.push({ optionId: optId, hideIf });
        }
      } else if (rule.filteredOptions?.length) {
        // Only the listed options are KEPT; all others are hidden when met
        const kept = new Set(rule.filteredOptions);
        for (const opt of q.options) {
          if (!kept.has(opt.value)) {
            result.push({ optionId: opt.value, hideIf });
          }
        }
      }
    }
  }

  // ── Option-level visibleOnlyIf (sex-gated Norwood vs Ludwig, etc.) ────────
  // Inverted to hideIf and merged with any question-level entries above.
  for (const opt of q.options ?? []) {
    if (opt.visibleOnlyIf) {
      result.push({
        optionId: opt.value,
        hideIf: visibleOnlyIfToHideIf(opt.visibleOnlyIf),
      });
    }
  }

  return result.length > 0 ? result : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTUAL EXCLUSIVITY GROUPS
// Converts pairwise deselect rules into groups of mutually exclusive option IDs.
// ─────────────────────────────────────────────────────────────────────────────

function buildMutualExclusivityGroups(
  rules: SchemaMutualExclusivityRules | undefined
): string[][] | undefined {
  if (!rules?.rules?.length) return undefined;

  // Merge pairwise rules into disjoint groups
  const groups: Set<string>[] = [];

  for (const rule of rules.rules) {
    const { selecting, deselects } = rule;
    let merged: Set<string> | undefined;

    for (const group of groups) {
      if (group.has(selecting) || group.has(deselects)) {
        if (!merged) {
          merged = group;
        } else {
          // Merge two groups
          for (const item of group) merged.add(item);
          groups.splice(groups.indexOf(group), 1);
        }
      }
    }

    if (merged) {
      merged.add(selecting);
      merged.add(deselects);
    } else {
      groups.push(new Set([selecting, deselects]));
    }
  }

  return groups.map(g => Array.from(g));
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTION ADAPTER
// ─────────────────────────────────────────────────────────────────────────────

function adaptOption(o: SchemaOption): QuestionOption {
  return {
    id: o.value,         // value IS the option ID in the real protocol
    label: o.label,
    icon: o.icon ?? undefined,
    image: o.image,
    illustration: o.illustration,
    clinicalTags: o.clinicalTags?.length ? o.clinicalTags : undefined,
    followUpQuestionId: o.followUpQuestions?.[0] ?? undefined,
    // description: not present in schema options; omit
  };
}

// Convert an option-level visibleOnlyIf into a hideIf LogicCondition[].
// "show if sex equals Male" → "hide if sex not_equals Male"
//
// AND-semantics on the show side becomes OR-semantics on the hide side,
// which is what the visibility engine expects (it evaluates hideIf in 'any'
// mode). So [ruleA, ruleB] in visibleOnlyIf produces [invert(ruleA),
// invert(ruleB)] in hideIf — the option is hidden if either show-condition
// fails.
function visibleOnlyIfToHideIf(
  rule: NonNullable<SchemaOption['visibleOnlyIf']>
): LogicCondition[] {
  const rules = Array.isArray(rule) ? rule : [rule];
  return rules.map(invertVisibilityRule);
}

function invertVisibilityRule(
  r: { dependsOn: string; operator: string; value: string | number }
): LogicCondition {
  // Numeric inversions: integer fields (age) use a value offset so the
  // comparison expresses the inverted bound exactly.
  //   show if age < 45  →  hide if age >  44  (i.e. age >= 45)
  //   show if age > 30  →  hide if age <  31  (i.e. age <= 30)
  if (r.operator === 'lessThan' && typeof r.value === 'number') {
    return { field: r.dependsOn, operator: 'greater_than', value: r.value - 1 };
  }
  if (r.operator === 'greaterThan' && typeof r.value === 'number') {
    return { field: r.dependsOn, operator: 'less_than', value: r.value + 1 };
  }
  return {
    field: r.dependsOn,
    operator: mapOperator(r.operator, true),
    value: r.value,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPE MAPPING
// ─────────────────────────────────────────────────────────────────────────────

function adaptType(schemaType: string): QuestionType {
  const map: Record<string, QuestionType> = {
    text: 'text',
    number: 'number',
    textarea: 'textarea',
    single_select: 'single_select',
    multi_select: 'multi_select',
    image_select: 'image_select',
    image_upload: 'image_upload',
    scale: 'scale',
  };
  return map[schemaType] ?? 'single_select';
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION ADAPTER
// ─────────────────────────────────────────────────────────────────────────────

function adaptQuestion(q: SchemaQuestion, section: SchemaSection): Question {
  const skipIf = buildSkipConditions(q);
  const filterOptions = buildFilterOptions(q);
  const mutualExclusivityGroups = buildMutualExclusivityGroups(q.mutualExclusivityRules);
  const mutualExclusivityToast = q.mutualExclusivityRules?.toastMessage;
  const showIf =
    q.visibilityRules?.length === 1 && q.visibilityRules[0]?.operator === 'equals'
      ? {
          questionId: q.visibilityRules[0].dependsOn,
          value: q.visibilityRules[0].value as string | string[],
        }
      : undefined;

  // Clinical mapping: use all scoring signals as protocolHints
  const clinicalMapping: Question['clinicalMapping'] = q.scoringSignals?.length
    ? {
        signal: q.scoringSignals[0]?.signal,
        protocolHints: q.scoringSignals.map(s => s.signal),
      }
    : undefined;

  // Validation — propagate all schema validation fields the renderer uses.
  const validation: Question['validation'] = q.validation
    ? {
        min: q.validation.min,
        max: q.validation.max,
        minLength: (q.validation as { minLength?: number }).minLength,
        maxLength: (q.validation as { maxLength?: number }).maxLength,
        pattern: (q.validation as { pattern?: string }).pattern,
        placeholder: (q.validation as { placeholder?: string }).placeholder,
        errorMessage: q.validation.hint,
      }
    : undefined;

  // UI format hint — drives field-specific input handling in the renderer.
  const uiFormat: Question['uiFormat'] = (() => {
    const fmt = (q.uiMetadata as { format?: string } | undefined)?.format;
    if (fmt === 'name' || fmt === 'number' || fmt === 'text') return fmt;
    return undefined;
  })();

  const options = q.options?.length ? q.options.map(adaptOption) : undefined;

  return {
    id: q.id,
    category: SECTION_TO_CATEGORY[section.sectionId] ?? 'about_you',
    sectionId: section.sectionId,
    sectionTitle: section.title,
    sectionDescription: section.description,
    type: adaptType(q.type),
    title: q.label,
    subtitle: q.subtitle ?? undefined,
    helperText: q.validation?.hint ?? undefined,
    required: q.required,
    options,
    validation,
    uiFormat,
    skipIf: skipIf.length ? skipIf : undefined,
    showIf,
    filterOptions,
    mutualExclusivityGroups,
    mutualExclusivityToast,
    clinicalMapping,
    uiLayout: q.uiMetadata?.layout,
    sourceRef: q.sourceCodeReference,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ADAPTER ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

export function adaptProtocol(protocol: MasterProtocol): Question[] {
  const questions: Question[] = [];

  for (const section of protocol.sections) {
    for (const q of section.questions) {
      questions.push(adaptQuestion(q, section));
    }
  }

  return questions;
}

export function getSectionMap(protocol: MasterProtocol): Map<string, SchemaSection> {
  const map = new Map<string, SchemaSection>();
  for (const section of protocol.sections) {
    map.set(section.sectionId, section);
  }
  return map;
}
