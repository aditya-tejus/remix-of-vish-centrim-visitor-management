# "Internal server error" in the preview

## What I found

- The app itself is healthy: the latest build finished with no errors, and the app answers normally when loaded directly inside the workspace.
- The hosted backend (database and sign-in) is up and responding normally.
- There are no failed requests recorded from your last session — only harmless accessibility warnings.

This points to a temporary hiccup on the preview hosting layer rather than a fault in the app.

## Suggested next step

1. Refresh the preview once. In most cases the page loads normally again.
2. If it still shows the error, I will:
   - restart the preview server for this project;
   - re-check the hosted backend;
   - load the app end to end in an automated browser and capture the exact failing request so we can see whether anything in the app is involved.

## Nothing is being changed

No screens, data, settings or security rules are touched by this step — it is a check-and-recover action only.
