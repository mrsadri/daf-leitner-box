# Account-bound drill startup — additive rollout

This follow-up is prepared on `codex/backlog-acceptance`; it is not applied to production.

Apply `20261118112413_scoped_drill_start.sql` through the approved database workflow before deploying this candidate frontend. The client now calls `start_scoped_adjective_run(p_expected_user)`; if it is unavailable, startup falls back to unranked practice. The existing `start_verified_adjective_run()` remains available for older clients.

The new SECURITY INVOKER wrapper checks `p_expected_user` against `auth.uid()` before calling the existing server-issued challenge function. A request prepared under account A cannot consume account B's daily run quota after an authentication switch. Identity still comes from the signed session, never from the supplied parameter. Anonymous callers and null/mismatched expected IDs are rejected with SQLSTATE 42501. No learner rows are migrated and no scoring/timing rules change.

Verification: `supabase/tests/scoped_drill.test.sql` checks ownership, rejected-start quota preservation, issued-question count and anonymous denial. Client tests assert the expected account is supplied. The normal isolated/native SQL suites, migration replay, clean/upgrade equivalence and Database type checks include this function.

Rollback: an older frontend can continue using the existing endpoint. Keep the additive wrapper while rolling back UI code; no destructive database rollback is needed. Hosted execution and release of this new candidate require their own authorization; the earlier PR #32 override was limited to that release.
