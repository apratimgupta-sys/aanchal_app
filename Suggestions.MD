# Suggestions

1. Fix the missing favicon to remove the persistent `404`.
2. Avoid logging expected unauthenticated `/session` checks as console errors; handle `401` quietly during initial app bootstrap.
3. Replace the brief `Connecting` state with clearer loading and error states.
4. Add field-level validation before submission for negative and inconsistent values.
5. Add a confirmation dialog for zero-activity submissions.
6. Add automated Playwright regression tests for:
   - Local Vite → Render proxy
   - Commissioner and office login
   - Mutation persistence
   - Audit-history propagation
   - Logout/session expiry
   - Direct route refreshes
7. Add production monitoring for CORS failures, failed mutations, and session errors.
8. Use a separate test dataset or reset mechanism so repeated mutation testing does not continuously alter shared demo data.
9. Add export/download support for the commissioner dashboard and audit history.
10. Add an explicit deployment smoke test after every frontend or backend release.
