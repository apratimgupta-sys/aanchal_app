# Agent-run browser suite

Plain-JavaScript checks that run through the Playwright plugin (no test runner needed). Each file is one `async (page) => {...}` that returns a pass/fail report. All entry writes are blocked by route interception, and the setup group runs against mocked responses, so nothing is saved.

Run order: `1-autha`, `1-authb`, `2-entry1` to `2-entry4`, `3-dashboarda`, `3-dashboardb`, `4-setup-mocked`, `5-i18n-responsive-a11y`.

Needs the dev server on `http://127.0.0.1:5173` (proxying to staging) and the sign-in credentials set on `globalThis.__creds` for the session (keys `anchal1`, `anchal6`, `commissioner`). Credentials are not stored in these files.

Each file is under the plugin's 60 s call limit. The older `1-auth`, `2-entry` and `3-dashboard` variants, if present, are superseded by the split files.
