# College ERP System: MVP Definition and Development Roadmap

## 1. MVP Philosophy

The goal of this Minimum Viable Product (MVP) is to build a "tracer bullet" that cuts vertically through the entire application stack. It proves the architecture works end-to-end and delivers a highly presentable, coherent experience suitable for a final-year project demonstration.

- **What makes a good ERP MVP:** It must feel like a complete, functioning system, even if the feature set is narrow. A user must be able to log in, perform their primary duty, and see the immediate impact of that duty on other users.
- **Why postpone features:** In a 1–3 week AI-assisted development timeline, scope creep is the biggest risk. Edge cases, complex automated workflows, and hardware integrations consume massive time but offer low visual impact during a demo.
- **Coherence over feature count:** Three flawlessly integrated modules (Attendance, Exams, Fees) that tell a complete story are infinitely more impressive than ten half-built, disconnected modules that throw errors during a presentation.

---

## 2. Core User Roles

To maintain an aggressive development timeline, we will strictly limit the MVP to three fundamental roles that represent the core institutional triad.

**MVP Roles:**
- **Admin:** The system operator. Responsibilities include onboarding users, configuring departments and courses, assigning faculty to subjects, and generating fee invoices.
- **Faculty:** The academic operator. Responsibilities are strictly limited to viewing their schedule, marking attendance for their assigned sessions, and uploading exam grades.
- **Student:** The consumer. Responsibilities include viewing their personal dashboard, checking attendance percentages, viewing published results, and checking fee dues.

*(Future Excluded Roles: HOD, Librarian, Finance Officer, Examination Controller, Parent, Placement Officer).*

---

## 3. MVP Modules

**MUST HAVE (The Core Engine):**
- **Authentication & RBAC:** Secure JWT login and role-based routing.
- **Core Academic Data:** Departments, Courses, Subjects, and User Profiles.
- **Attendance:** Simplified session marking (Present/Absent).
- **Examinations:** Raw grade entry and transcript viewing.
- **Fees:** Static invoice generation and manual "Mark as Paid" functionality.

**SHOULD HAVE (High Presentation Value):**
- **Dashboards:** Visual charts (e.g., total students, average attendance) for the Admin and Student landing pages.
- **Simplified Timetable:** A basic mapping of Faculty to Subjects/Batches without complex scheduling algorithms or conflict resolution.

**COULD HAVE (If time allows in week 3):**
- **Basic Notifications:** In-app alerts when a fee is generated or a grade is published.

**WON'T BUILD FOR MVP (Scope Exclusions):**
- **Library Management:** Too disconnected from the core academic flow.
- **Course Registration / Drop-Add:** We will assume Students are auto-enrolled in all subjects for their semester to save time.
- **Approval Workflows (Maker-Checker):** Too complex for MVP. Admins and Faculty will have direct, immediate write access.

---

## 4. MVP User Stories

**Admin:**
- *As an Admin, I must be able to log in securely.*
- *As an Admin, I must be able to create Student and Faculty profiles.*
- *As an Admin, I must be able to define Departments, Courses, and Subjects.*
- *As an Admin, I must be able to map a Faculty member to a Subject.*
- *As an Admin, I must be able to generate a semester fee invoice for a student and manually mark it as "Paid".*

**Faculty:**
- *As a Faculty member, I must be able to log in securely.*
- *As a Faculty member, I must be able to view my assigned subjects.*
- *As a Faculty member, I must be able to select a subject and mark daily attendance for enrolled students.*
- *As a Faculty member, I must be able to enter midterm and final marks for my subjects.*

**Student:**
- *As a Student, I must be able to log in securely.*
- *As a Student, I must be able to view my personal profile.*
- *As a Student, I must be able to view my real-time attendance percentage.*
- *As a Student, I must be able to view my published exam marks.*
- *As a Student, I must be able to view my pending fee invoices.*

---

## 5. Demo Scenario (The Golden Path)

This scenario is designed to flawlessly showcase the system's integration in under 5 minutes during a final presentation.

1. **The Setup (Admin):** The Admin logs in, opens the dashboard showing college metrics. They navigate to "Users", create a new Student profile (e.g., "John Doe"), and assign them to "B.Tech Computer Science - Semester 1". They then generate a standard Semester Fee invoice for John.
2. **The Class (Faculty):** The presenter logs out and logs in as a Faculty member. The Faculty opens their dashboard, navigates to today's "Data Structures" class, sees John Doe on the roster, and marks him "Present".
3. **The Exam (Faculty):** The Faculty navigates to the "Examinations" module, selects "Data Structures Midterm", and enters a grade of 85/100 for John Doe.
4. **The Consumption (Student):** The presenter logs in as John Doe. John sees his dashboard: 
   - A widget shows "Attendance: 100%". 
   - A widget shows "Pending Fees: $1500". 
   - A widget shows "Recent Grades: Data Structures - 85/100".
5. **The Conclusion:** The system successfully demonstrated user creation, financial obligation, academic participation, and evaluation in one coherent loop.

---

## 6. Feature Dependencies

Features must be built in this strict sequential order to prevent development bottlenecks.

1. **Authentication:** (Blocks everything)
2. **Core Data (Departments, Courses, Subjects):** (Blocks Users)
3. **Users (Admin, Faculty, Student):** (Blocks all transactional data)
4. **Faculty-Subject Mapping:** (Blocks Timetable and Attendance)
5. **Attendance:** (Independent transactional flow)
6. **Examinations:** (Independent transactional flow)
7. **Fees:** (Independent transactional flow)
8. **Dashboards:** (Depends on all above to populate charts)

---

## 7. Development Phases

**Phase 1: Foundation (Days 1-3)**
- Setup React, Node.js, Express, PostgreSQL.
- Implement JWT Auth and basic RBAC middleware.
- Build basic CRUD APIs and UI for Departments, Courses, and Subjects.

**Phase 2: User Provisioning (Days 4-5)**
- Build APIs and UI for creating Admins, Faculty, and Students.
- Implement auto-enrollment: Students are automatically tied to the subjects of their assigned Course/Semester.

**Phase 3: The Academic Loop (Days 6-9)**
- Build UI for Faculty to view assigned subjects.
- Build Attendance marking interface and backend aggregation logic.
- Build Examination grading interface.

**Phase 4: The Financial Loop (Days 10-11)**
- Build Fee invoice generation.
- Build Admin capability to manually transition invoices from "Pending" to "Paid".

**Phase 5: Dashboards & Consumption (Days 12-14)**
- Build the Student Dashboard (read-only views of Attendance, Marks, Fees).
- Build Admin and Faculty analytical dashboards (simple charts using a library like Recharts or Chart.js).

**Phase 6: Polish & Testing (Days 15-21)**
- UI/UX polish (colors, typography, loading states).
- Seed the database with realistic dummy data for the demo.
- Rehearse the Golden Path demo and fix any breaking bugs.

---

## 8. Success Criteria

The MVP is considered 100% successful and ready for grading if:
- Secure JWT login works across three distinct roles.
- The Admin can successfully provision a student from scratch.
- Faculty can submit an attendance record and a grade without crashing.
- A student can log in and instantly see the data entered by the Admin and Faculty.
- The "Golden Path" Demo Scenario can be executed live without a single unhandled error or database fault.
- The UI looks professional, cohesive, and modern.

---

## 9. Explicit Non-Goals

To guarantee delivery, the following are intentionally excluded from the MVP:

- **Payment Gateway Integration:** We will not integrate Stripe/Razorpay. The Admin will simply click "Mark as Paid". Real money integrations require extensive webhook testing.
- **Complex Course Registration:** No drop/add periods or elective capacity algorithms.
- **Timetable Conflict Resolution:** The system will assume the Admin schedules correctly; we won't build algorithmic conflict detection.
- **Library, Hostel, Transport, Placements:** These are isolated domains that do not contribute to the core academic loop.
- **Biometric Hardware:** We will rely strictly on manual UI inputs for attendance.
- **Email/SMS Integrations:** No third-party SMTP/Twilio integrations to avoid API key setups and sandbox limits during a live demo.
- **Maker-Checker Workflows:** Faculty grades will be instantly published, skipping the HOD approval workflow to save development time.

---

## 10. Future Roadmap

Because the system is built on a robust relational PostgreSQL schema with isolated modules:
- **Payment Gateways** can easily be added later by swapping the Admin's manual "Mark as Paid" button with a webhook listener that updates the exact same Fee state.
- **Maker-Checker Workflows** can be introduced by simply changing the initial Grade status from "Published" to "Draft" and adding an HOD review screen.
- **Library and Hostel modules** can be built as entirely new React routes and Express microservices that safely reference the existing Student foreign keys.
- **Hardware Integration** can be achieved by allowing a Python script on a biometric scanner to hit the exact same `/api/attendance` endpoint that the React frontend uses.
