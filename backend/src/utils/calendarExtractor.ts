/**
 * Rule-based academic calendar event extractor.
 *
 * Supports JNTUH-style PDF text (DD-MM-YYYY date format, week-table layout)
 * with fallbacks for named-month formats.  All functions are pure — no I/O.
 */

import type { ParsedEventType, ParsedEventAudience } from '../types/parsedEvent';

// ── Public interface ───────────────────────────────────────────────────────────

export interface CandidateEvent {
  title: string;
  description: string | null;
  startDate: string;        // YYYY-MM-DD
  endDate: string | null;   // YYYY-MM-DD
  eventType: ParsedEventType;
  targetAudience: ParsedEventAudience;
  semester: number | null;
}

// ── Month name → number map ────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,   feb: 2, february: 2,  mar: 3, march: 3,
  apr: 4, april: 4,     may: 5,                jun: 6, june: 6,
  jul: 7, july: 7,      aug: 8, august: 8,     sep: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

// ── Date helpers ───────────────────────────────────────────────────────────────

function toISO(day: number, month: number, year: number): string | null {
  if (month < 1 || month > 12 || day < 1 || year < 2000 || year > 2100) return null;
  const d = new Date(year, month - 1, day);
  if (d.getDate() !== day || d.getMonth() !== month - 1) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const MONTH_WORD =
  'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|' +
  'jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

/**
 * Parses a single date token in any supported format to YYYY-MM-DD.
 * Returns null for unrecognised or out-of-range values.
 */
export function parseISODate(input: string): string | null {
  const s = input.trim();

  // DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY
  let m = /^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})$/.exec(s);
  if (m) return toISO(+m[1], +m[2], +m[3]);

  // DD Month YYYY  (e.g. "13 June 2026" / "13 Jun 2026")
  m = new RegExp(`^(\\d{1,2})\\s+(${MONTH_WORD}),?\\s+(\\d{4})$`, 'i').exec(s);
  if (m) {
    const mo = MONTH_MAP[m[2].toLowerCase()];
    if (mo) return toISO(+m[1], mo, +m[3]);
  }

  // Month DD YYYY / Month DD, YYYY  (e.g. "June 13, 2026")
  m = new RegExp(`^(${MONTH_WORD})\\s+(\\d{1,2}),?\\s+(\\d{4})$`, 'i').exec(s);
  if (m) {
    const mo = MONTH_MAP[m[1].toLowerCase()];
    if (mo) return toISO(+m[2], mo, +m[3]);
  }

  return null;
}

/**
 * Extracts all recognisable dates from a line of text.
 * Returns them as YYYY-MM-DD strings in left-to-right order, deduplicated.
 */
export function findDatesInLine(line: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  const add = (iso: string | null) => {
    if (iso && !seen.has(iso)) { seen.add(iso); found.push(iso); }
  };

  // DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY
  for (const m of line.matchAll(/\b(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})\b/g)) {
    add(toISO(+m[1], +m[2], +m[3]));
  }

  // DD Month YYYY
  for (const m of line.matchAll(
    new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_WORD}),?\\s+(\\d{4})\\b`, 'gi')
  )) {
    const mo = MONTH_MAP[m[2].toLowerCase()];
    if (mo) add(toISO(+m[1], mo, +m[3]));
  }

  // Month DD YYYY
  for (const m of line.matchAll(
    new RegExp(`\\b(${MONTH_WORD})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'gi')
  )) {
    const mo = MONTH_MAP[m[1].toLowerCase()];
    if (mo) add(toISO(+m[2], mo, +m[3]));
  }

  return found;
}

// ── Event type classification ──────────────────────────────────────────────────

const EVENT_TYPE_RULES: Array<[ParsedEventType, RegExp]> = [
  ['Mid-Term Examination',      /\b(i{1,2}[\s-]*mid|mid[\s-]*(term|exam|test|examinations?))\b/i],
  ['End Semester Examination',  /\b(end[\s-]*semester|semester[\s-]*end|end[\s-]*exam(?:ination)?s?)\b/i],
  ['Lab Examination',           /\b(lab[\s-]*(exam|test|examinations?)|practical[\s-]*exam)\b/i],
  ['Internal Assessment',       /\b(internal[\s-]*(assessment|marks|evaluation|grading))\b/i],
  ['Supplementary Examination', /\b(supplementary|supply[\s-]*exam|backlog|advanced[\s-]*supple?)\b/i],
  ['Holiday',                   /\b(holiday|vacation|break|recess|pongal|diwali|holi|eid|christmas|independence[\s-]*day|republic[\s-]*day|ugadi|dasara|vinayaka|navratri|ramzan|muharram|id[\s-]*ul)\b/i],
  ['Class Commencement',        /\b(commencement|class[\s-]*work|classwork|classes[\s-]*(begin|start|commence)|reopening|instruction[\s-]*(begins?|starts?))\b/i],
  ['Academic Activity',         /\b(project|seminar|workshop|sports|cultural|registration|enrollment|fee[\s-]*payment|mentor(?:ing)?|tutorial|industry[\s-]*visit|industrial[\s-]*visit|verification|counselling)\b/i],
];

/**
 * Returns the best-matching event type for the given text.
 * Applies rules in priority order; returns 'Other' when nothing matches.
 */
export function classifyEventType(text: string): ParsedEventType {
  for (const [type, pattern] of EVENT_TYPE_RULES) {
    if (pattern.test(text)) return type;
  }
  return 'Other';
}

// ── Audience classification ────────────────────────────────────────────────────

const AUDIENCE_RULES: Array<[ParsedEventAudience, RegExp]> = [
  ['I Year',   /\b(i[\s-]year|1st[\s-]year|first[\s-]year|i[\s-]b\.?tech|i[\s-]b\.?e\.?)\b/i],
  ['II Year',  /\b(ii[\s-]year|2nd[\s-]year|second[\s-]year|ii[\s-]b\.?tech|ii[\s-]b\.?e\.?)\b/i],
  ['III Year', /\b(iii[\s-]year|3rd[\s-]year|third[\s-]year|iii[\s-]b\.?tech|iii[\s-]b\.?e\.?)\b/i],
  ['IV Year',  /\b(iv[\s-]year|4th[\s-]year|fourth[\s-]year|iv[\s-]b\.?tech|iv[\s-]b\.?e\.?)\b/i],
  ['Faculty',  /\b(faculty|teaching[\s-]*staff|staff[\s-]*members?)\b/i],
  ['Students', /\bstudents?\b/i],
];

// Detects abbreviated multi-year patterns like "II, III & IV Year" or "I, II Year"
// where several Roman numerals are comma/& separated before a single shared "Year" token.
const MULTI_YEAR_ABBREV = /\b(?:i{1,3}|iv)(?:\s*[,&]\s*(?:i{1,3}|iv))+\s+year\b/i;

/**
 * Infers the target audience from event text.
 * When multiple year-groups are mentioned (e.g., "II, III & IV Year"), returns 'All'.
 */
export function classifyAudience(text: string): ParsedEventAudience {
  // Fast-path: abbreviated multi-year pattern ("II, III & IV Year") → All
  if (MULTI_YEAR_ABBREV.test(text)) return 'All';

  const yearMatches: ParsedEventAudience[] = [];
  let hasFaculty = false;
  let hasStudents = false;

  for (const [audience, pattern] of AUDIENCE_RULES) {
    if (!pattern.test(text)) continue;
    if (audience.endsWith('Year')) yearMatches.push(audience);
    else if (audience === 'Faculty') hasFaculty = true;
    else if (audience === 'Students') hasStudents = true;
  }

  if (yearMatches.length === 1) return yearMatches[0];
  if (yearMatches.length > 1)   return 'All';
  if (hasFaculty)               return 'Faculty';
  if (hasStudents)              return 'Students';
  return 'All';
}

// ── Semester hint extraction ───────────────────────────────────────────────────

const SEMESTER_ORDINAL: Record<string, number> = {
  i: 1, '1st': 1, first: 1,
  ii: 2, '2nd': 2, second: 2,
  iii: 3, '3rd': 3, third: 3,
  iv: 4, '4th': 4, fourth: 4,
  v: 5, '5th': 5, fifth: 5,
  vi: 6, '6th': 6, sixth: 6,
  vii: 7, '7th': 7, seventh: 7,
  viii: 8, '8th': 8, eighth: 8,
};

/**
 * Extracts an explicit semester number (1–8) if the text mentions it directly.
 * Returns null when the semester cannot be determined unambiguously.
 */
export function extractSemesterHint(text: string): number | null {
  const m = /\b(i{1,3}|iv|v?i{0,3}|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)\s+semester\b/i.exec(text);
  if (!m) return null;
  return SEMESTER_ORDINAL[m[1].toLowerCase()] ?? null;
}

// ── Text cleaning ──────────────────────────────────────────────────────────────

/**
 * Removes date tokens, row/week prefixes, and date-range connectors from a
 * line so only the meaningful event text remains.
 */
export function stripDatesAndNoise(line: string): string {
  let s = line;

  // Remove DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY
  s = s.replace(/\b\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{4}\b/g, ' ');

  // Remove DD Month YYYY
  s = s.replace(
    new RegExp(`\\b\\d{1,2}\\s+(?:${MONTH_WORD}),?\\s+\\d{4}\\b`, 'gi'),
    ' '
  );

  // Remove Month DD YYYY
  s = s.replace(
    new RegExp(`\\b(?:${MONTH_WORD})\\s+\\d{1,2},?\\s+\\d{4}\\b`, 'gi'),
    ' '
  );

  // Remove leading row numbers ("1.", "2)", "16 ")
  s = s.replace(/^\d+\s*[.):]?\s+/, '');

  // Remove leading "Week N" / "Week No. N" prefixes
  s = s.replace(/^week\s*(?:no\.?)?\s*\d+\s*/i, '');

  // Collapse whitespace
  return s.replace(/\s+/g, ' ').trim();
}

// ── Skip detection ─────────────────────────────────────────────────────────────

// Column headers and separator lines found in JNTUH academic calendar tables
const HEADER_PATTERN = /^(from|to|date[s]?|week(?:\s*no\.?)?|s\.?no\.?|month(?:\s*&?\s*year)?|academic\s+events?|activities|event|period|sl\.?\s*no\.?)$/i;
const SEPARATOR_PATTERN = /^[-=*#_\s|]+$/;

function isNoise(text: string): boolean {
  return HEADER_PATTERN.test(text.trim()) || SEPARATOR_PATTERN.test(text.trim());
}

// ── Main extraction ────────────────────────────────────────────────────────────

const MIN_TITLE_LEN = 5;
const MAX_TITLE_LEN = 450;

/**
 * Extracts candidate academic calendar events from raw PDF text.
 *
 * Algorithm:
 *  1. Split into lines; skip blank lines and separator/header lines.
 *  2. For each line containing at least one recognisable date:
 *     a. Accumulate up to two continuation lines (lines without dates).
 *     b. First date  → start_date.
 *        Second date → end_date (only if it is ≥ start_date).
 *     c. Strip dates + noise to get the event title.
 *     d. Classify event type and target audience.
 *     e. Attempt to extract a semester number hint.
 *  3. Deduplicate by (start_date, normalised title prefix).
 */
export function extractCandidateEvents(text: string): CandidateEvent[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const events: CandidateEvent[] = [];
  const seen = new Set<string>();

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const dates = findDatesInLine(line);

    if (dates.length === 0) { i++; continue; }

    // Accumulate continuation text (max 2 lines, no dates)
    let rawText = line;
    let j = i + 1;
    while (j < lines.length && j <= i + 2) {
      const next = lines[j];
      if (!next || findDatesInLine(next).length > 0) break;
      if (next.length >= 3) rawText += ' ' + next;
      j++;
    }

    const title = stripDatesAndNoise(rawText).slice(0, MAX_TITLE_LEN);

    if (title.length < MIN_TITLE_LEN || isNoise(title)) { i++; continue; }

    const startDate = dates[0];
    const endDate   = dates.length >= 2 && dates[1] >= startDate ? dates[1] : null;

    const dedupeKey = `${startDate}|${title.toLowerCase().slice(0, 60)}`;
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      events.push({
        title,
        description:    null,
        startDate,
        endDate,
        eventType:      classifyEventType(title),
        targetAudience: classifyAudience(title),
        semester:       extractSemesterHint(title),
      });
    }

    i = j;
  }

  return events;
}
