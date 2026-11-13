# Invitation Doctor identity guards

`acceptInvitation` now rejects a missing/inactive/deleted/suspended/archived clinic and an inactive/soft-deleted existing Doctor. It never reactivates a Doctor or clears its deletion timestamp.

All Doctor rows owning the verified caller UID through either identity column are read inside the existing serializable transaction. Any additional owner is an identity conflict, including a second owner after the intended Doctor in query results. Separate column-level UNIQUE indexes do not enforce this union-of-columns invariant.

An occupied canonical identity is never overwritten. A different legacy phone identity on the same Doctor is preserved and does not prevent filling an empty canonical slot or reusing the already-matching canonical UID. Other Doctor owners still cause refusal. `inactive_scope` returns 403 and an explanatory invite-page message; `identity_conflict` remains 409.

## Regression evidence

The tests-only commit `b2484dd9a936c5d5e05ff63506c52063e83e320d`, based on `5ffad3850aaa6c9520d707b9f6af6adeb44d2968`, adds the reproductions before the implementation fix. On the old implementation: **10 failed, 9 passed**. After the fix: **19 passed**.

The before failures include both disabled/deleted Doctor cases, all five clinic-liveness cases, an additional cross-column owner after the intended owner, and both separate-phone cases (empty and matching canonical identity). Reverse-order conflict and occupied-canonical refusal remain covered.

These execute the real acceptance function over an in-memory Prisma stub. They are unit/mocked evidence, not real PostgreSQL concurrency, Auth, or authenticated Google browser acceptance. Prepared seed/cleanup SQL remains unexecuted. Live acceptance and independent server Auth/DATABASE_URL/DIRECT_URL verification remain required before any fixture-write approval.
