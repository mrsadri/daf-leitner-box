# Incomplete tasks — corrected status

The following **12 tasks remain incomplete overall**: **7, 8, 11, 13, 14, 16, 19, 20, 21, 22, 23 and 25**.

Earlier wording that the locally implementable backlog was finished was too broad. Implementation, local automated verification, full acceptance, and release are separate milestones. Passing local tests does not close an entire task. Checked subtasks retain their evidence; unchecked requirements remain open. Task 11 has passed its local checklist but still has the installed-schema audit gate.

| Task | Remaining requirement |
|---|---|
| 7 | Actual push-library/runtime and provider verification. Mocked request-boundary tests alone do not finish this task. |
| 8 | Complete token-expiry and lifecycle acceptance scenarios, including hosted authentication behavior. |
| 11 | Local clean/upgrade equivalence passes, but comparison with the installed hosted schema is still pending. |
| 13 | Representative staging benchmarks and full ranking-result comparisons. |
| 14 | End-to-end overlapping-worker, timeout and crash acceptance; ledger/helper tests already pass. |
| 16 | Independent session, catalog and lazy-chunk failure/recovery acceptance scenarios. |
| 19 | Complete the cards/stories/drills failure matrix and acceptance evidence; some storage/retry regressions already pass. |
| 20 | Complete navigation usability acceptance, including human review; automated small-screen/history checks pass. |
| 21 | Screen-reader review and full bilingual nested-dialog acceptance. |
| 22 | Actual deployed headers, OAuth/resources/push policy checks and CSP disposition. |
| 23 | Compatible reviewed dependency remediation; audit findings remain unresolved despite monitoring configuration. |
| 25 | Owner recovery targets, retention and measured staging restore rehearsal; cold-offline reopening remains an accepted deferral. |

Some remaining verification can still be developed locally (notably 7, 8, 14, 16, 19 and 21). It must not all be described as owner-only work. Hosted configuration, actual provider delivery, human assistive-technology review and restore rehearsal require their corresponding environment/operator. No production database access or deployment is authorized by this correction.

Task 10 is now verified in hosted GitHub CI: [run 44278415253](https://github.com/mrsadri/daf-leitner-box/actions/runs/44278415253) at `33f0583`. The owner chose local testing only for the database environment; no hosted Supabase or production checks are implied.
