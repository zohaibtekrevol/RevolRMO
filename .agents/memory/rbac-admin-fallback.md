---
name: RBAC admin fallback (UI vs server)
description: Why client-side "can this user manage X" checks must add the legacy admin-role fallback that the server applies, or role-admins get locked out.
---

# RBAC: legacy admin fallback must be mirrored client-side

The server's `requirePermission(...)` middleware grants ALL permissions to users
whose legacy `users.role` is `"admin"` or `"administrator"` (the "legacy admin
fallback"), in addition to whatever `storage.getUserPermissions(userId)` returns.

But `GET /api/access/my-permissions` returns ONLY `getUserPermissions(userId)` —
it does NOT apply the admin-role fallback. So a user who is admin *by role* but
has no explicit permission rows gets an empty/partial permission list.

**Rule:** any frontend gate of the form
`canManage = permissions.includes("manage_X")` must also OR-in the role check:
`isAdminRole = user.role === "admin" || user.role === "administrator"`.
Otherwise role-admins are wrongly treated as non-managers and shown the
restricted UI even though every server write endpoint would accept them.

**Why:** the permission *data* model and the *effective* permission model differ;
the server reconciles them in middleware, the `/my-permissions` endpoint does not.

**How to apply:** when adding a new permission-gated screen, compute
`canManage` from BOTH the role fallback and the permission list, mirroring
`requirePermission`. Note `users.role` is typed narrowly (`"admin" | "pm"`) even
though `"administrator"` occurs at runtime — cast to string for the
`"administrator"` comparison.
