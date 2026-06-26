# College ERP System: System Model

# 1. System Overview

The College ERP is a centralized information management system designed to unify the academic and administrative operations of an educational institution. Philosophically, it acts as a single source of truth, moving the institution away from siloed spreadsheets and fragmented data stores. The model prioritizes clear data ownership, structured entity relationships, and rigid authorization boundaries to ensure data integrity across all academic lifecycles.

---

# 2. Primary Actors

The actors represent the physical users who interact with the system.

**MVP Actors:**
- **Admin:** The highest-level operational actor. Responsible for configuring the global structure (academic years, departments), provisioning users, and overseeing data integrity across all domains.
- **Faculty:** The academic actor. Responsible for delivering instruction, recording student participation (attendance), and evaluating academic performance (grades).
- **Student:** The consumer actor. Responsible for consuming academic content, tracking personal progress, managing financial dues, and participating in assessments.

**Future Actors:**
- **HOD (Head of Department):** Department-level overseer responsible for academic approvals, faculty assignments, and departmental performance.
- **Librarian:** Specialized actor managing physical and digital resource inventories.
- **Finance:** Specialized administrative actor handling complex accounting, payroll, and fee reconciliations.
- **Parent/Guardian:** Read-only observational actor monitoring a specific student's progress.
- **Placement Officer:** Administrative actor facilitating recruitment drives and industry interactions.

---

# 3. Core System Entities

Entities are the fundamental conceptual nouns of the system.

- **Student:** The core academic consumer entity containing personal and enrollment profiles.
- **Faculty:** The instructional entity containing professional profiles and specializations.
- **Department:** The organizational unit grouping faculty and academic programs.
- **Course (Program):** The overarching degree or program (e.g., B.Tech Computer Science).
- **Subject:** A specific topical unit of instruction taught within a semester.
- **Semester (Term):** A defined block of academic time grouping subjects and students.
- **Attendance:** A record denoting a student's presence or absence for a specific subject session.
- **Assignment:** A learning task issued by faculty and completed by students.
- **Examination:** A formal assessment event.
- **Marks (Grades):** The evaluated outcome of a student's performance in an assessment.
- **Fee:** A financial obligation tied to a student.
- **Timetable:** The structural mapping of time, space, faculty, and subjects.
- **Library Book:** A trackable physical or digital resource.
- **Notification:** A communication packet dispatched to an actor.

---

# 4. Entity Relationships

These define how the core entities conceptually link to one another.

- **Department → Faculty:** A department contains multiple faculty members.
- **Department → Students:** A department houses multiple enrolled students.
- **Course → Subjects:** A course is composed of a structured set of subjects over time.
- **Faculty → Subjects:** Faculty members are assigned to teach specific subjects.
- **Student → Courses:** A student is enrolled in a specific course/program.
- **Student → Subjects:** A student registers for a subset of subjects each semester.
- **Student → Attendance:** A student generates many attendance records over time.
- **Student → Marks:** A student earns multiple mark records across different subjects.
- **Student → Fees:** A student is linked to multiple fee obligations throughout their tenure.
- **Semester → Subjects:** A semester dictates which subjects are actively offered.
- **Timetable → Faculty, Subject, Semester:** The timetable orchestrates the intersection of who teaches what, and when.

---

# 5. Ownership Model

Ownership defines which actor holds the primary responsibility for the accuracy and lifecycle of specific data, distinct from who merely has access to view it.

**Students own:**
- Their personal contact profile (subject to verification).
- Their submitted assignment artifacts.
- Grievance or feedback submissions.

**Faculty own:**
- The syllabus content and assignment definitions for their subjects.
- The raw attendance entries for their assigned sessions.
- The initial grade evaluations for their students.

**Admins own:**
- Global institutional configurations (academic calendars).
- Departmental and Course structures.
- User accounts and role mappings.
- Finalized/Locked academic records (acting as custodians for the institution).

---

# 6. Interaction Model

This describes the conceptual pathways actors take when engaging with the system.

**Student Interactions:**
- Consumes read-only dashboards (timetable, fee status, marks).
- Submits digital artifacts (assignments, feedback).
- Initiates requests (leave, certificates, fee payment confirmations).

**Faculty Interactions:**
- Generates transactional data in bulk (marking daily attendance, entering batch grades).
- Manages academic communication (publishing assignments, sending subject-specific alerts).
- Consumes cohort-level reports (subject attendance averages, class performance).

**Admin Interactions:**
- Configures foundational structures (creating a new semester, defining fee brackets).
- Mediates and approves (processing faculty grade correction requests, validating fee waivers).
- Extracts macro-level data (generating institutional performance reports, cross-department audits).

---

# 7. Module Dependencies

Conceptual dependencies indicate which domains must exist and function before another domain can operate.

- **Attendance** depends on the existence of a *Student*, a *Faculty* member, and a mapped *Subject*.
- **Examination** depends on the existence of a *Student*, a *Subject*, and a finalized *Semester* structure.
- **Fee Management** depends heavily on the *Student* entity and the current *Semester* or *Course* definition to determine obligation rules.
- **Timetable** serves as a central dependency hub, requiring *Department*, *Faculty*, *Course*, and *Subject* entities to be fully defined before scheduling can occur.
- **Marks** depend on the completion of an *Examination* or *Assignment* linked to a *Student*.

---

# 8. Authorization Boundaries

Authorization boundaries define the conceptual limits of action for different actor levels.

- **Who can create:**
  - Admins create foundational data (users, courses, fee structures).
  - Faculty create academic events (attendance sessions, assignment definitions).
  - Students create responses (submissions, grievance tickets).

- **Who can view:**
  - Students view their own localized data matrix.
  - Faculty view data scoped strictly to their assigned cohorts and subjects.
  - Admins view global, cross-departmental data aggregates.

- **Who can modify:**
  - Modification of operational data (attendance, grades) is restricted to the originating owner (Faculty) only while the data is in an active/draft state.
  - Once locked, modification requires escalation across a boundary.

- **Who can approve:**
  - Approvals always cross an authorization boundary upwards. Faculty approve student requests; Admins (or HODs) approve faculty requests.

---

# 9. System Boundaries

System boundaries separate what the ERP controls internally versus what it delegates to the outside world.

**Inside the ERP Boundary:**
- Academic records, user profiles, internal role definitions, attendance tracking, internal grade calculation, fee obligation generation.

**Outside the ERP Boundary (External Systems):**
- **Payment Gateways:** The ERP hands off the financial transaction and awaits a success/failure webhook; it does not process credit cards internally.
- **Biometric Devices:** The ERP consumes time-logs from external hardware; it does not manage fingerprint data.
- **Government/University Portals:** The ERP formats data for export; it does not directly manage external state accreditations.
- **Email Providers:** The ERP triggers email content payloads; an external SMTP/API service handles actual delivery.
- **SMS Providers:** Similar to email, SMS dispatch is delegated to a third-party gateway.

---

# 10. Future Expansion Points

The model is designed with attachment points to allow modular expansion without disrupting the core.

- **Hostel:** Connects conceptually to the *Student* and *Fee* entities for room allocation and billing.
- **Transport:** Connects to the *Student*, *Faculty*, and *Fee* entities for route mapping and subscription.
- **Placement:** Connects to the *Student* entity (for eligibility) and the *Department* entity (for recruitment drives).
- **Parent Portal:** Connects externally to the *Student* entity, functioning solely as a read-only viewer profile.
- **AI Features:** Operates as an external consumer of the ERP's historical *Attendance* and *Marks* data for predictive modeling.
- **Alumni:** An extension of the *Student* lifecycle state, allowing interaction with external networking modules while retaining historical academic identity.
