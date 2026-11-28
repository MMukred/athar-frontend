# Backend requests — ideas box & attendance confirmation

The frontend for both features is already live and **switches itself on** as soon as these
endpoints answer. Until then the menu items stay hidden, so nobody sees a broken screen.
All routes require a logged-in user (`Authorization: Bearer …`) and follow the existing
`{ error: { code, message } }` error shape.

---

## 1. Ideas & suggestions box (صندوق الأفكار)

Who sends: volunteers and committee leaders. Who reads: `super_admin`, `trusted_admin`.

### Table `suggestions`
| column | type | notes |
|---|---|---|
| id | uuid | |
| author_user_id | uuid → users | always stored, even when anonymous |
| volunteer_id | uuid → volunteers, nullable | author's volunteer record if linked |
| committee_id | uuid → committees, nullable | author's committee at the time |
| type | enum `idea` \| `note` \| `problem` | |
| title | text, nullable, ≤120 | |
| body | text, 5–2000 | |
| anonymous | boolean, default false | hide author from admins when true |
| status | enum `new` \| `reviewing` \| `done` \| `archived`, default `new` | |
| admin_reply | text, nullable, ≤2000 | shown to the sender |
| created_at / updated_at | timestamptz | |

### Endpoints
| method & path | who | body / query | response |
|---|---|---|---|
| `POST /api/suggestions` | any logged-in user | `{ type, title?, body, anonymous? }` | `201 { suggestion }` |
| `GET /api/suggestions/mine` | any logged-in user | — | `{ items: [suggestion] }` newest first |
| `GET /api/suggestions` | super/trusted admin | `?status=new&limit=200` | `{ items, total }` newest first |
| `PATCH /api/suggestions/:id` | super/trusted admin | `{ status?, adminReply? }` | `{ suggestion }` |

`suggestion` JSON:
```json
{
  "id": "…", "type": "idea", "title": "…", "body": "…", "anonymous": false,
  "status": "new", "adminReply": null, "createdAt": "…", "updatedAt": "…",
  "author":    { "id": "…", "fullName": "…", "fullNameAr": "…", "role": "volunteer" },
  "committee": { "nameAr": "…", "nameEn": "…" }
}
```
When `anonymous` is true, return `author: null` and `committee: null` to admins.
Add an audit-log entry on create and on PATCH, like other entities.

---

## 2. Attendance confirmation before a meeting (تأكيد الحضور)

Volunteers answer "سأحضر / أعتذر" **before** the meeting. After the meeting nothing changes:
the roster the leader saves stays the source of truth for attendance and auto-hours.

### Table `meeting_rsvps`
| column | type | notes |
|---|---|---|
| meeting_id | uuid → meetings | PK part |
| volunteer_id | uuid → volunteers | PK part |
| response | enum `coming` \| `not_coming` | |
| reason | text, nullable, ≤300 | |
| responded_at | timestamptz | |

### Endpoints
| method & path | who | body | response |
|---|---|---|---|
| `GET /api/portal/me` | volunteer | — | add `myRsvp: "coming" \| "not_coming" \| null` to **every** item in `meetings[]` |
| `POST /api/portal/meetings/:id/rsvp` | volunteer (must belong to the meeting's committee, or event open to all) | `{ response, reason? }` | `{ rsvp }`; upsert; reject with `409 MEETING_CLOSED` if the meeting is completed or already started |
| `GET /api/meetings/:id/rsvps` | admins + that committee's leader | — | `{ items: [{ volunteerId, response, reason, respondedAt, volunteer: { fullName, fullNameAr } }], summary: { coming, notComing, noResponse } }` |

The presence of the `myRsvp` key in `/portal/me` is what makes the buttons appear,
so send it as `null` (not omitted) when the volunteer hasn't answered.

---

## Still open from earlier
- Default password `Athar@123` for new accounts (users view) → generate a random one-time password.
- Store the full application-form answers on the volunteer (or a linked `applications` row) so the
  "طلبات التطوع" page can show them, and add a real "reject" status instead of archiving.
