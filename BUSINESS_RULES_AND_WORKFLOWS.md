# College ERP System: Business Rules and Operational Workflows

## 1. Core Design Philosophy

The business rules and operational workflows of the College ERP are governed by the following institutional principles:

- **Data Integrity (The Single Source of Truth):** No operation can proceed if it creates conflicting states (e.g., a student cannot be simultaneously enrolled in two overlapping physical classes).
- **Auditability (Non-Repudiation):** Every critical operational change leaves an immutable, timestamped footprint identifying the actor. 
- **Approval-Based Changes (Maker-Checker):** Sensitive actions (like grade changes or fee waivers) cannot be unilaterally executed. They require an initiator (Maker) and a distinct authorized reviewer (Checker).
- **Historical Preservation (Soft Deletes):** Institutional memory is permanent. Operational entities (students, faculty, grades) are archived, not erased, to preserve historical continuity for accreditation and audits.
- **Policy-Driven Decisions:** The system restricts human error by strictly enforcing parameterized institutional rules (e.g., automatically blocking hall ticket generation for attendance defaulters) rather than relying on manual checks.

---

## 2. Student Academic Lifecycle

The core student journey follows a rigid, state-controlled progression.

**Standard Flow:**
`Applicant` → `Admitted` → `Fee Pending` → `Fee Cleared (or Installment Approved)` → `Course Registration` → `Active Student` → `Exam Eligible` → `Exam Completed` → `Graduated` → `Alumni`

**Exception Paths:**
- **Transfer (Lateral Entry):** Enters at `Admitted` but maps directly into a higher semester, triggering a one-time historical credit mapping workflow.
- **Transfer (Exit):** Transitions from `Active Student` to `Transferred Out`. Generates a Transfer Certificate and locks the profile permanently.
- **Dropout / Rustication:** Transitions to `Archived (Incomplete)`. Halts fee accrual and revokes all active system access.
- **Academic Detention:** `Active Student` fails to meet promotional criteria. Transitions to `Detained`. Required to repeat the academic year; halts progression to the next semester.
- **Backlogs (ATKT - Allowed To Keep Terms):** Student progresses to the next semester but carries `Failed` subjects. Triggers dual registration for current courses and backlog exams.

---

## 3. Faculty Lifecycle

**Standard Flow:**
`Joining (Onboarded)` → `Department Assignment` → `Course/Subject Assignment` → `Active Teaching` → `Archival (Resignation/Retirement)`

**Exception Paths & States:**
- **Leave of Absence:** Temporary suspension of teaching duties. Triggers an automatic conflict alert on the timetable for substitute planning.
- **Substitution:** A temporary workflow assigning an active subject session to a proxy faculty member while the primary owner is on leave. The substitute can mark attendance but cannot finalize grades.
- **Mid-Semester Resignation:** Triggers an immediate handover protocol. Subject ownership, pending assignments, and draft gradebooks are forcefully transferred to a new faculty member via HOD approval.
- **Archival:** Revokes login access but preserves the faculty name on all historical gradebooks and timetables for non-repudiation and audits.

---

## 4. Attendance Workflow

**Standard Flow:**
1. **Session Creation:** Timetable dictates the session; faculty initiates it.
2. **Attendance Marking:** Faculty marks presence/absence for the roster.
3. **Correction Window:** A strict grace period (e.g., 24 hours) where the faculty can freely correct mistakes.
4. **Locking:** Session auto-locks after the grace period.
5. **Eligibility Update:** Institutional batch process recalculates the student's cumulative attendance percentage.

**Exception Cases:**
- **Medical/Sports Leave:** Approved official leave does not mark the student as "Present" but reduces the total required sessions in the eligibility denominator, adjusting the percentage fairly.
- **Faculty Mistake (Post-Lock):** Requires an official `Attendance Correction` approval workflow involving the HOD.
- **Late Attendance:** Faculty can mark a student "Late," which counts towards a fractional absence based on institutional policy.
- **Lab Sessions (Batched):** Attendance is marked against specific student sub-batches rather than the entire class roster.

---

## 5. Course Registration Workflow

**Standard Flow:**
1. **Semester Opens:** Admin defines the registration window.
2. **Selection:** Student selects core and elective subjects.
3. **Prerequisite Validation:** System verifies the student has cleared required past subjects.
4. **Seat Validation:** For electives, system enforces hard capacity limits (first-come, first-served or merit-based).
5. **Registration / Draft:** Selections are temporarily held.
6. **Drop/Add Period:** Student can modify elective choices without penalty.
7. **Lock:** Registration is finalized. Generates the semester fee invoice.
8. **Backlog Registration:** Separate parallel workflow allowing students to register for supplementary exams of previously failed subjects.

---

## 6. Fee Workflow

**Standard Flow:**
`Invoice Generated` → `Notification Sent` → `Full Payment` → `Receipt Generated` → `Closure`

**Exception Paths:**
- **Partial Payment (Installments):** Student pays an approved fraction. State remains `Partial`. System tracks the next due date.
- **Scholarship/Waiver:** Authorized Admin applies a financial credit, proportionally reducing the invoice total.
- **Late Fee:** System automatically applies a configurable penalty charge once the due date is breached.
- **Refund / Adjustment:** Applied when a student drops a course or withdraws mid-semester. Generates a negative invoice balance to be credited or paid out.
- **Fee Dispute:** Halts late fee accrual while under administrative review.

---

## 7. Examination Workflow

**Standard Flow:**
1. **Registration:** Student opts into the exam cycle.
2. **Eligibility Check:** System validates No Dues (Fees) and Minimum Attendance.
3. **Hall Ticket:** System generates the secure admission document.
4. **Exam Conducted:** Physical event occurs.
5. **Evaluation:** Faculty inputs raw marks into a draft state.
6. **Moderation/Review:** HOD or Controller of Exams reviews grade distributions.
7. **Publication:** Embargo lifts; grades become visible to students.

**Exception Paths:**
- **Malpractice / Disciplinary:** Student is flagged during the exam. Grades are locked as `Nullified/Zero` pending disciplinary committee review.
- **Revaluation:** Student challenges a grade, pays a fee, and the paper is masked and reassigned for blind grading.
- **Supplementary:** Student registers for a dedicated retake exam cycle for failed subjects.
- **Grace Marks:** System automatically applies policy-driven grace marks if a student is failing by a marginal, predefined threshold.

---

## 8. Library Workflow

**Standard Flow:**
`Issue (Checkout)` → `Renew (Optional)` → `Return` → `Closure`

**Exception Paths:**
- **Late Fine:** System accrues daily fines post due-date. Fine becomes a mandatory fee obligation linked to the student.
- **Lost Book:** Transitions book status to `Lost`. Generates a replacement cost invoice against the student.
- **Clearance (No Dues):** Student cannot graduate or obtain a transfer certificate if any book remains issued or a fine remains unpaid.

---

## 9. Approval Workflows

The ERP relies on a strict Maker-Checker pattern to prevent unilateral sensitive changes.

**General Approval Pattern:**
1. **Initiator (Maker):** Submits request with justification.
2. **Pending Queue:** Request is locked and visible to authorized reviewers.
3. **Reviewer (Checker):** Approves, Rejects (with comments), or Escalates. The Checker can NEVER be the Maker.

**Specific Workflows:**
- **Attendance Correction:** Maker: Faculty → Checker: HOD.
- **Grade Change (Post-Publication):** Maker: Faculty → Checker: Examination Controller.
- **Fee Waiver / Scholarship:** Maker: Admission Office → Checker: Finance Admin.
- **Leave Request:** Maker: Faculty/Student → Checker: HOD.
- **Certificate Request (Transcripts):** Maker: Student → Checker: Admin/Registrar.

---

## 10. Institutional Policies

System behavior is governed by configurable parameters, not hardcoded logic.

- **Attendance Policy:** e.g., "75% minimum required for hall ticket generation."
- **Exam Eligibility:** e.g., "Must have zero pending academic fees and meet attendance thresholds."
- **Fee Policy:** e.g., "Late fee of $10 per day applied 7 days after invoice due date."
- **Library Policy:** e.g., "Students max 3 books for 14 days; Faculty max 10 books for 30 days."
- **Course Registration Policy:** e.g., "Maximum of 24 credits per semester, including backlogs."
- **Graduation Policy:** e.g., "Must clear all core subjects, complete 120 total credits, and obtain 'No Dues' from Library, Finance, and Hostel."
- **Revaluation Policy:** e.g., "Final grade takes the higher of the original or reevaluated mark; maximum one revaluation per subject."

---

## 11. System Invariants

These are absolute truths the ERP must fiercely protect to maintain institutional integrity.

- **Attendance Bounds:** An attendance record can mathematically never be less than 0% or greater than 100%.
- **Mark Limits:** Awarded marks can never exceed the defined maximum marks for an assessment.
- **Financial Bounds:** A student cannot pay more than the total outstanding invoice amount (overpayments must be explicitly converted to advance credit).
- **Eligibility Lock:** A hall ticket can NEVER be generated if the student state is not explicitly `Exam Eligible`.
- **Double Registration:** A student cannot be actively registered for the same subject twice in the same semester.
- **Temporal Conflict:** A faculty member or student cannot be scheduled in two different physical locations at the exact same time.
- **Embargo Enforcement:** Draft grades can never be viewed by a student prior to the official publication timestamp.
- **Maker-Checker Separation:** The user ID of the person approving a request can never equal the user ID of the person who initiated it.

---

## 12. Exception Handling

How the institution manages unpredictable realities:

- **Faculty Resignation (Mid-Term):** The timetable and gradebook enter a `Frozen` state until an Admin maps a replacement faculty member, at which point ownership transfers.
- **Course Cancellation:** If an elective falls below minimum enrollment, the system automatically drops registered students, issues notifications, and opens an emergency drop/add window.
- **Semester Extension:** Admins can globally shift the academic calendar (e.g., due to natural disasters), recalculating all assignment due dates, fee deadlines, and exam schedules proportionally.
- **Academic Appeals / Court Orders:** Allows Super Admins to perform an "Override" action, bypassing standard policies (e.g., forcing hall ticket generation for a detained student). Overrides trigger highest-severity audit alerts.
- **Disputed Transactions:** Failed payment gateway webhooks transition the invoice to a `Disputed` state, preventing late fees or academic penalties until manually reconciled by Finance.

---

## 13. Future Compatibility

Operational workflows are designed to accommodate seamless future integrations:

- **Hostel & Transport:** The `No Dues` graduation policy and `Fee Workflow` already support abstract invoice generation. Future modules will simply inject new invoice types into existing student ledgers.
- **Placement:** The `Exam Eligible` and `Graduation` lifecycle states will act as prerequisite gates for placement drive registration.
- **Parent Portal:** Since data ownership relies on read-only viewing boundaries, parents can simply be mapped to a student's ID without altering any core workflow logic.
- **AI / Predictive Analytics:** All transactional workflows (attendance marking, grading) are append-only and historically preserved, ensuring perfectly clean, chronological datasets for future machine learning models.
- **Alumni Integration:** The transition to the `Alumni` state locks operational data but keeps the profile active, ready for future integration with fundraising or networking modules.
