# College ERP System

A modern full-stack **College ERP (Enterprise Resource Planning)** platform designed to streamline academic and administrative workflows for students, faculty, and administrators.

This system centralizes attendance, academics, examinations, fee management, and student opportunities into a single scalable platform.

---

## Overview

Managing academic operations manually can be inefficient and time-consuming.

This ERP system digitizes and automates core college workflows such as:

* Student management
* Attendance tracking
* Academic progress monitoring
* Examination schedules
* Fee tracking
* Notifications
* Timetable management

The project is built with a modern SaaS-style dashboard to provide an intuitive and efficient user experience.

---

## Features

### Student Module

* Student dashboard
* Attendance tracking
* Academic performance monitoring
* Timetable access
* Assignment tracking
* Fee status monitoring
* Notifications and announcements

### Faculty Module

* Manage student attendance
* Upload marks
* Create assignments
* View class performance
* Schedule exams

### Admin Module

* Manage students and faculty
* Department management
* Fee records
* Academic schedules
* Examination control
* System-wide announcements

---

## Dashboard Features

* Interactive attendance analytics
* CGPA trend visualization
* Upcoming deadlines
* Calendar-based timetable
* Opportunity feed
* Task management
* Notification timeline
* Theme support (Dark / Light Mode)

---

## Tech Stack

### Frontend

* Next.js
* TypeScript
* Tailwind CSS
* React

### Backend

* Node.js
* Express.js
* TypeScript

### Database

* PostgreSQL

### Authentication

* JWT Authentication
* Role-based access control

---

## Project Structure

```text id="l8v9ds"
college-erp/
├── frontend/      # Next.js frontend
├── backend/       # Node.js backend
├── database/      # PostgreSQL configurations
```

---

## Installation

Clone the repository:

```bash id="x8d2wy"
git clone <your-repo-url>
cd college-erp
```

Install frontend dependencies:

```bash id="v5k9rc"
cd frontend
npm install
```

Install backend dependencies:

```bash id="f2m7na"
cd ../backend
npm install
```

Setup environment variables:

Backend:

```env id="k4t8vz"
PORT=3001
DATABASE_URL=your_database_url
JWT_ACCESS_SECRET=your_secret
JWT_REFRESH_SECRET=your_secret
```

Frontend:

```env id="c6q3ep"
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api
```

Run backend:

```bash id="w7r2mx"
npm run dev
```

Run frontend:

```bash id="d3n8lv"
npm run dev
```

---

## Future Improvements

* AI-based performance analytics
* Smart timetable optimization
* Parent portal
* Placement tracking
* Hostel management
* Transport management
* AI chatbot assistant

---

## Use Cases

* Colleges
* Universities
* Educational institutions
* Academic administration systems

---

## Author

**Bhuvanesh T**

B.Tech AIML | Full Stack Developer | AI Enthusiast

---

## License

This project is developed for educational and institutional use.
