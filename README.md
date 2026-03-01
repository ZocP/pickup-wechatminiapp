# UIUC Pickup Scheduler Mini Program

Native WeChat Mini Program frontend for the scheduler backend.

## Stack

- Native Mini Program: WXML / WXSS / JS / JSON
- UI components: Vant Weapp
- Backend API: RESTful (`/api/v1`)

## Implemented Core Modules

- Global request wrapper with JWT injection and error interception (`utils/request.js`)
- Role-aware app state (`app.js` -> `globalData.userInfo`)
- Reusable admin shift card component (`components/shift-card`) with boarding status display
- Admin dashboard page (`pages/admin/dashboard`) with pending pool assignment
- Student request page (`pages/student/request`) with status tracking
- Driver page (`pages/driver/index`) with shift management and QR code boarding verification
- Admin shift detail page (`pages/admin/shift-detail`) with boarding statistics

## Routes

Tab pages:
- `pages/home/index`
- `pages/admin/dashboard/index`
- `pages/profile/index`

Other pages:
- `pages/student/request/index`
- `pages/login/index`
- `pages/driver/index` - Driver shift management and boarding
- `pages/admin/shift-detail/index` - Detailed shift management with boarding stats

## Setup

1. Open this folder in WeChat DevTools.
2. Run `npm install` in this directory.
3. Copy `project.config.example.json` to local `project.config.json`, then fill your own WeChat `appid`.
4. In DevTools, run `Tools -> Build NPM`.
5. Ensure backend is reachable at `http://localhost:8080/api/v1` (or set custom baseURL in storage key `baseURL`).

## API Mapping

### Authentication
- `POST /auth/login`
- `POST /auth/bind-phone`

### Admin Endpoints
- `GET /admin/shifts/dashboard`
- `GET /admin/requests/pending`
- `POST /admin/shifts/:id/assign-student`
- `POST /admin/shifts/:id/remove-student`
- `POST /admin/shifts/:id/publish`
- `GET /admin/drivers`
- `POST /admin/drivers`
- `PUT /admin/drivers/:id`
- `GET /admin/users`
- `POST /admin/users/:id/set-staff`
- `POST /admin/users/:id/unset-staff`

### Student Endpoints
- `POST /student/requests`
- `GET /student/requests/my`
- `PUT /student/requests/:id`
- `GET /student/requests/:id/boarding-token`

### Driver Endpoints
- `GET /driver/shifts` - Get driver's assigned shifts
- `GET /driver/shifts/:id` - Get shift details
- `GET /driver/shifts/:id/passengers` - Get passengers for a shift
- `POST /driver/boarding/verify` - Verify boarding via QR code

### Staff Visibility
Admin and staff users can view boarding status in:
- Shift cards on dashboard (shows boarded/unboarded counts)
- Shift detail page (displays boarding statistics)
- Driver page provides real-time boarding verification via QR code scanning
