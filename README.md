# UIUC Pickup Scheduler Mini Program

Native WeChat Mini Program frontend for the scheduler backend.

## Stack

- Native Mini Program: WXML / WXSS / JS / JSON
- UI components: Vant Weapp
- Backend API: RESTful (`/api/v1`)

## Implemented Core Modules

- Global request wrapper with JWT injection and error interception (`utils/request.js`)
- Role-aware app state (`app.js` -> `globalData.userInfo`)
- Reusable admin shift card component (`components/shift-card`)
- Admin dashboard page (`pages/admin/dashboard`) with pending pool assignment
- Student request page (`pages/student/request`) with status tracking

## Routes

Tab pages:
- `pages/home/index`
- `pages/admin/dashboard/index`
- `pages/profile/index`

Other pages:
- `pages/student/request/index`
- `pages/login/index`

## Setup

1. Open this folder in WeChat DevTools.
2. Run `npm install` in this directory.
3. Copy `project.config.example.json` to local `project.config.json`, then fill your own WeChat `appid`.
4. In DevTools, run `Tools -> Build NPM`.
5. Ensure backend is reachable at `http://localhost:8080/api/v1` (or set custom baseURL in storage key `baseURL`).

## API Mapping

- `POST /auth/login`
- `POST /auth/bind-phone`
- `GET /admin/shifts/dashboard`
- `GET /admin/requests/pending`
- `POST /admin/shifts/:id/assign-student`
- `POST /admin/shifts/:id/remove-student`
- `POST /admin/shifts/:id/publish`
- `POST /student/requests`
- `GET /student/requests/my`
- `PUT /student/requests/:id`
