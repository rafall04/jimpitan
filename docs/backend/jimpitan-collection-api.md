<!--
Purpose: REST and OpenAPI notes for the Jimpitan collection workflow module.
Caller: Backend maintainers, frontend/mobile clients, and OpenAPI reviewers.
Deps: apps/api/src/modules/jimpitan, prisma/schema.prisma, docs/backend/backend-skeleton.md.
MainFuncs: Documents collection endpoints, mode-aware payload shapes, RBAC, validation, summaries, and finance hook boundaries.
SideEffects: None.
-->

# Jimpitan Collection API

## Scope
- Base path: `/api/v1/jimpitan/collections`.
- Auth: bearer token plus tenant context guards on every endpoint.
- RBAC: `collections.read`, `collections.create`, `collections.update_own`, `collections.submit_own`, `collections.validate`, and `collections.reject`.
- Modes: `PER_HOUSE` preserves the existing checklist workflow; `BULK_TOTAL` records only session totals; `HYBRID` is schema/API foundation only and is not exposed in the UI.
- Finance: validation emits hook events only. No transaction, journal, or ledger posting is implemented here.

## Workflow
1. `POST /` creates a `DRAFT` session with `officerMembershipId`, `collectionDate`, optional `collectionMode`, optional `totalAmount`, optional `areaId`, and optional note.
2. `POST /:collectionId/checklist/generate` prepares the mobile checklist and moves editable `PER_HOUSE` sessions to `IN_PROGRESS`.
3. `PUT /:collectionId/items/batch` upserts `PER_HOUSE` collection results by `(collectionId, houseId)`.
4. `PUT /:collectionId/bulk-total` stores `BULK_TOTAL` `totalAmount` plus optional note and moves editable sessions to `IN_PROGRESS`.
5. `PATCH /:collectionId/submit` branches validation by mode: `PER_HOUSE` requires items, while `BULK_TOTAL` requires a positive integer total.
6. `PATCH /:collectionId/validate` validates only `SUBMITTED` sessions and dispatches the finance-ready hook with mode and total metadata.
7. `PATCH /:collectionId/reject` rejects only `SUBMITTED` sessions.

## Mobile Payloads
- Checklist responses include `collection` plus route `houses`, each with `houseId`, `houseNumber`, `area`, `primaryResident`, and existing `item`.
- Batch item input accepts up to 500 items with `houseId`, optional `residentId`, string decimal `amount`, `status`, and optional note.
- Allowed item statuses are `PAID`, `UNPAID`, `HOUSE_EMPTY`, `TITIP_TETANGGA`, `MENUNGGAK`, and `DISPENSATION`.
- `GET /mobile/my` returns only sessions assigned to the current membership for officer clients.
- `BULK_TOTAL` input uses `totalAmount` as a positive integer rupiah string plus optional note; no per-house item payload is allowed.

## Summaries
- `GET /:collectionId/summary` returns `collectionMode`, `totalCollected`, `totalHouses`, `completedHouses`, `paidHouses`, `outstandingHouses`, and `perArea` progress.
- `GET /:collectionId/outstanding` returns paginated houses with no item or an item status other than `PAID` or `DISPENSATION`; `BULK_TOTAL` returns an empty result because it does not track per-house outstanding.

## Validation Rules
- All reads and writes are tenant-scoped by `actor.rtId`.
- Officer assignment requires an active same-tenant membership and active user.
- Area assignment requires a non-archived active same-tenant area.
- Checklist and item input exclude archived/inactive houses, archived areas, and archived/inactive residents.
- Active duplicate sessions for the same route/date are blocked by service validation and serializable repository rechecks.
- Validated sessions cannot be edited, cancelled, submitted, rejected, or item-updated.
- Lifecycle writes use conditional transactional updates to prevent stale concurrent state overwrites.
- `PER_HOUSE` mode remains the regression baseline. `BULK_TOTAL` cannot generate checklists or create items, requires positive integer `totalAmount` before submit/validate, and is posted to finance using the collection total. `HYBRID` remains reserved.

## OpenAPI Notes
- DTOs in `apps/api/src/modules/jimpitan/presentation/dto` carry Swagger decorators for request schemas.
- Controller methods in `jimpitan.controller.ts` carry `ApiTags`, `ApiBearerAuth`, and `ApiOperation` decorators.
- Future generated OpenAPI output should show the module under the `jimpitan` tag.
