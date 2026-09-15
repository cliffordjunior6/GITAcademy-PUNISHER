# GITAcademy Frontend

A complete, working demo frontend for an online learning platform with a static HTML/CSS/JS architecture. The project has been repaired to preserve the design while making the main journeys functional in a browser without a full Laravel runtime. It is ready for final-year presentation and demo use.

## ✅ Current status

- Working local demo auth flow for student, instructor, and admin roles
- Missing pages repaired and redirect links restored
- Ghanaian cedi pricing used across the core demo flow
- Course listing and checkout pages remain visually consistent with the original design
- The app is intentionally front-end driven for demonstration and can later be wired to a real backend API

---

## 🚀 Quick Start

Open `index.html` in a browser to start from the project control hub.

Use these demo accounts:

| Role | Email | Password | Notes |
|---|---|---|---|
| Student | `justiceelorm@example.com` | `password` | Redirects to `dashboard.html` |
| Instructor | `atosiaw@example.com` | `password` | Redirects to `instructor-dashboard.html` |
| Admin | `cliffordjunior@GITAcademy.com` | `admin123` | Requires admin code: `ADMIN2024` |

> Authentication is handled with a local demo fallback so the project works immediately even without a live Laravel backend.

---

## 🔁 Important billing note

All user-facing pricing in the project is now presented in Ghanaian cedis using the `₵` symbol and `GHS` currency context where needed.

---

## 📁 Project structure

The project remains a front-end LMS with HTML, CSS, JavaScript, and JSON data files. Core modules include:

- `login.html` and `register.html` for demo auth flows
- `dashboard.html` for the student dashboard
- `course-list.html` and `course-details.html` for browsing and enrollment
- `cart.html` and `checkout.html` for the purchasing flow
- `instructor-dashboard.html` and `admin-dashboard.html` for role-based demo dashboards
- `utils.js` for shared formatting, pricing, and local demo persistence

---

## 🧪 Demo flow

1. Open `index.html`
2. Go to `login.html`
3. Sign in with a role-specific demo account
4. Explore course listings, checkout, and role dashboards
5. Use `ADMIN2024` for the admin access code

---

## ⚠️ Known limitation

This version is designed for local demonstration and presentation. It intentionally uses browser storage instead of a live backend to keep the project functional without rebuilding the entire system from scratch.
