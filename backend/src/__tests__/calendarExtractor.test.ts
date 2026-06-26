import {
  parseISODate,
  findDatesInLine,
  classifyEventType,
  classifyAudience,
  extractSemesterHint,
  stripDatesAndNoise,
  extractCandidateEvents,
} from '../utils/calendarExtractor';

// ── parseISODate ───────────────────────────────────────────────────────────────

describe('parseISODate', () => {
  it('parses DD-MM-YYYY (Indian format)', () => {
    expect(parseISODate('13-06-2026')).toBe('2026-06-13');
    expect(parseISODate('01-01-2026')).toBe('2026-01-01');
    expect(parseISODate('31-12-2026')).toBe('2026-12-31');
  });

  it('parses DD/MM/YYYY', () => {
    expect(parseISODate('15/08/2026')).toBe('2026-08-15');
  });

  it('parses DD.MM.YYYY', () => {
    expect(parseISODate('26.01.2026')).toBe('2026-01-26');
  });

  it('parses DD Month YYYY (full month name)', () => {
    expect(parseISODate('13 June 2026')).toBe('2026-06-13');
    expect(parseISODate('1 January 2026')).toBe('2026-01-01');
  });

  it('parses DD Mon YYYY (abbreviated month)', () => {
    expect(parseISODate('13 Jun 2026')).toBe('2026-06-13');
    expect(parseISODate('15 Aug 2026')).toBe('2026-08-15');
  });

  it('parses Month DD, YYYY', () => {
    expect(parseISODate('June 13, 2026')).toBe('2026-06-13');
    expect(parseISODate('December 31, 2026')).toBe('2026-12-31');
  });

  it('returns null for invalid dates', () => {
    expect(parseISODate('32-01-2026')).toBeNull(); // day > 31
    expect(parseISODate('29-02-2026')).toBeNull(); // 2026 is not a leap year
    expect(parseISODate('not-a-date')).toBeNull();
  });

  it('returns null for years out of range', () => {
    expect(parseISODate('01-01-1999')).toBeNull();
    expect(parseISODate('01-01-2101')).toBeNull();
  });
});

// ── findDatesInLine ────────────────────────────────────────────────────────────

describe('findDatesInLine', () => {
  it('extracts a single DD-MM-YYYY date', () => {
    expect(findDatesInLine('Class work starts on 13-06-2026')).toEqual(['2026-06-13']);
  });

  it('extracts a date range (start + end)', () => {
    const dates = findDatesInLine('1  13-06-2026  19-06-2026  Commencement of Class Work');
    expect(dates).toEqual(['2026-06-13', '2026-06-19']);
  });

  it('deduplicates the same date appearing twice', () => {
    const dates = findDatesInLine('Holiday on 15-08-2026 (15-08-2026)');
    expect(dates).toEqual(['2026-08-15']);
  });

  it('extracts named-month date', () => {
    expect(findDatesInLine('Classes start 13 June 2026 onwards')).toEqual(['2026-06-13']);
  });

  it('returns empty array for lines with no dates', () => {
    expect(findDatesInLine('Commencement of Class Work for all students')).toEqual([]);
    expect(findDatesInLine('Week No. From To Academic Events')).toEqual([]);
  });

  it('ignores partial or malformed date-like strings', () => {
    expect(findDatesInLine('Roll number: 21-CS-0987')).toEqual([]); // not a valid date
  });
});

// ── classifyEventType ──────────────────────────────────────────────────────────

describe('classifyEventType', () => {
  it('classifies Mid-Term Examination events', () => {
    expect(classifyEventType('I Mid Examinations for II & III Year')).toBe('Mid-Term Examination');
    expect(classifyEventType('II Mid Term Examinations')).toBe('Mid-Term Examination');
    expect(classifyEventType('Mid Exam week begins')).toBe('Mid-Term Examination');
  });

  it('classifies End Semester Examination events', () => {
    expect(classifyEventType('End Semester Examinations All Years')).toBe('End Semester Examination');
    expect(classifyEventType('Semester End Examinations')).toBe('End Semester Examination');
  });

  it('classifies Class Commencement events', () => {
    expect(classifyEventType('Commencement of Class Work for II Year B.Tech')).toBe('Class Commencement');
    expect(classifyEventType('Classes begin for I Year students')).toBe('Class Commencement');
  });

  it('classifies Holiday events', () => {
    expect(classifyEventType('Independence Day Holiday')).toBe('Holiday');
    expect(classifyEventType('Diwali Vacation')).toBe('Holiday');
    expect(classifyEventType('Pongal Holiday')).toBe('Holiday');
  });

  it('classifies Academic Activity events', () => {
    expect(classifyEventType('Student Registration / Enrollment')).toBe('Academic Activity');
    expect(classifyEventType('Industry Visit to Hyderabad')).toBe('Academic Activity');
  });

  it('classifies Supplementary Examination events', () => {
    expect(classifyEventType('Supplementary Examinations R20 Regulation')).toBe('Supplementary Examination');
  });

  it('returns Other for unrecognised text', () => {
    expect(classifyEventType('Routine schedule as per plan')).toBe('Other');
    expect(classifyEventType('Week 5 events')).toBe('Other');
  });
});

// ── classifyAudience ──────────────────────────────────────────────────────────

describe('classifyAudience', () => {
  it('identifies I Year events', () => {
    expect(classifyAudience('Commencement of classwork for I Year B.Tech')).toBe('I Year');
    expect(classifyAudience('I B.Tech Registration')).toBe('I Year');
  });

  it('identifies II Year events', () => {
    expect(classifyAudience('II Year B.Tech students report')).toBe('II Year');
  });

  it('identifies III Year events', () => {
    expect(classifyAudience('III Year mid exams begin')).toBe('III Year');
  });

  it('identifies IV Year events', () => {
    expect(classifyAudience('IV Year project presentations')).toBe('IV Year');
  });

  it('returns All when multiple year-groups are mentioned', () => {
    expect(classifyAudience('Commencement for II, III & IV Year B.Tech')).toBe('All');
  });

  it('identifies Faculty audience', () => {
    expect(classifyAudience('Faculty meeting for teaching staff')).toBe('Faculty');
  });

  it('identifies Students audience when no year specified', () => {
    expect(classifyAudience('All students must submit records')).toBe('Students');
  });

  it('returns All when no audience keyword found', () => {
    expect(classifyAudience('Holiday on account of Republic Day')).toBe('All');
  });
});

// ── extractSemesterHint ────────────────────────────────────────────────────────

describe('extractSemesterHint', () => {
  it('extracts semester number from Roman numeral', () => {
    expect(extractSemesterHint('I Semester examinations begin')).toBe(1);
    expect(extractSemesterHint('II Semester class work')).toBe(2);
  });

  it('extracts semester number from ordinal words', () => {
    expect(extractSemesterHint('First Semester results published')).toBe(1);
    expect(extractSemesterHint('Second semester reopening')).toBe(2);
  });

  it('extracts semester number from numeric ordinals', () => {
    expect(extractSemesterHint('1st semester registration')).toBe(1);
    expect(extractSemesterHint('3rd semester project submission')).toBe(3);
  });

  it('returns null when no semester mention found', () => {
    expect(extractSemesterHint('Commencement of classwork for II Year B.Tech')).toBeNull();
    expect(extractSemesterHint('Holiday on account of Pongal')).toBeNull();
  });
});

// ── stripDatesAndNoise ─────────────────────────────────────────────────────────

describe('stripDatesAndNoise', () => {
  it('strips DD-MM-YYYY dates and leaves event text', () => {
    const result = stripDatesAndNoise('1  13-06-2026  19-06-2026  Commencement of Class Work');
    expect(result).toContain('Commencement of Class Work');
    expect(result).not.toContain('13-06-2026');
    expect(result).not.toContain('19-06-2026');
  });

  it('removes leading row numbers', () => {
    expect(stripDatesAndNoise('16 27-09-2026 I Mid Examinations')).not.toMatch(/^\d+/);
  });

  it('removes Week N prefix', () => {
    const result = stripDatesAndNoise('Week 3 13-06-2026 Classwork starts');
    expect(result).not.toContain('Week 3');
    expect(result).toContain('Classwork starts');
  });

  it('collapses extra whitespace', () => {
    const result = stripDatesAndNoise('  I Mid   Examinations   ');
    expect(result).toBe('I Mid Examinations');
  });
});

// ── extractCandidateEvents ────────────────────────────────────────────────────

describe('extractCandidateEvents', () => {
  const SAMPLE_CALENDAR = `
JAWAHARLAL NEHRU TECHNOLOGICAL UNIVERSITY HYDERABAD
ACADEMIC CALENDAR 2026-27

Week No.  From          To            Academic Events
1         13-06-2026    19-06-2026    Commencement of Class Work for II, III & IV Year B.Tech.
2         20-06-2026    26-06-2026    Continuation of class work
3         27-06-2026    03-07-2026    Commencement of Class Work for I Year B.Tech. (Regular)
8         01-08-2026    07-08-2026    I Mid Term Examinations for III & IV Year
9         15-08-2026    21-08-2026    Independence Day Holiday (15-08-2026)
16        26-09-2026    02-10-2026    I Mid Examinations for I & II Year B.Tech.
28        19-12-2026    25-12-2026    End Semester Examinations - All Years
  `.trim();

  it('extracts events from a realistic JNTUH calendar sample', () => {
    const events = extractCandidateEvents(SAMPLE_CALENDAR);
    expect(events.length).toBeGreaterThan(0);
  });

  it('extracts start_date in YYYY-MM-DD format', () => {
    const events = extractCandidateEvents(SAMPLE_CALENDAR);
    events.forEach((e) => {
      expect(e.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('extracts end_date when a date range is present', () => {
    const events = extractCandidateEvents(SAMPLE_CALENDAR);
    const firstEvent = events.find((e) => e.startDate === '2026-06-13');
    expect(firstEvent).toBeDefined();
    expect(firstEvent?.endDate).toBe('2026-06-19');
  });

  it('classifies Class Commencement events correctly', () => {
    const events = extractCandidateEvents(SAMPLE_CALENDAR);
    const commencement = events.find((e) => e.eventType === 'Class Commencement');
    expect(commencement).toBeDefined();
  });

  it('classifies Mid-Term Examination events correctly', () => {
    const events = extractCandidateEvents(SAMPLE_CALENDAR);
    const midterm = events.find((e) => e.eventType === 'Mid-Term Examination');
    expect(midterm).toBeDefined();
  });

  it('classifies Holiday events correctly', () => {
    const events = extractCandidateEvents(SAMPLE_CALENDAR);
    const holiday = events.find((e) => e.eventType === 'Holiday');
    expect(holiday).toBeDefined();
    expect(holiday?.startDate).toBe('2026-08-15');
  });

  it('classifies End Semester Examination events correctly', () => {
    const events = extractCandidateEvents(SAMPLE_CALENDAR);
    const endSem = events.find((e) => e.eventType === 'End Semester Examination');
    expect(endSem).toBeDefined();
  });

  it('identifies I Year audience correctly', () => {
    const events = extractCandidateEvents(SAMPLE_CALENDAR);
    const iYear = events.find((e) => e.targetAudience === 'I Year');
    expect(iYear).toBeDefined();
  });

  it('returns All audience when multiple year-groups are mentioned', () => {
    const events = extractCandidateEvents(SAMPLE_CALENDAR);
    const multiYear = events.find((e) => e.startDate === '2026-06-13');
    expect(multiYear?.targetAudience).toBe('All');
  });

  it('does not duplicate events with the same date and title', () => {
    const repeated = `13-06-2026  19-06-2026  Commencement of Class Work
13-06-2026  19-06-2026  Commencement of Class Work`;
    const events = extractCandidateEvents(repeated);
    const count = events.filter(
      (e) => e.startDate === '2026-06-13' && e.title.startsWith('Commencement')
    ).length;
    expect(count).toBe(1);
  });

  it('returns empty array when text contains no dates', () => {
    const events = extractCandidateEvents('No dates here. Just some text about the university.');
    expect(events).toHaveLength(0);
  });

  it('skips column header lines', () => {
    const headerOnly = 'Week No.  From  To  Academic Events';
    const events = extractCandidateEvents(headerOnly);
    expect(events).toHaveLength(0);
  });

  it('sets description to null for freshly extracted events', () => {
    const events = extractCandidateEvents(SAMPLE_CALENDAR);
    events.forEach((e) => expect(e.description).toBeNull());
  });
});
