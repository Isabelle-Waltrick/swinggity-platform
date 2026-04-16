# CSRF Smoke Checklist

Use this after deploying or before committing a security change.

## Localhost

- Start the client on `http://localhost:5173` and the API on `http://localhost:5000`.
- Open the app, confirm `/api/csrf-token` responds with `success: true`.
- Log in successfully.
- Update a profile field and confirm it saves.
- Upload and remove an avatar.
- Create and delete a calendar event.
- Log out and confirm the session cookie and `csrf_secret` are cleared.

## Production

- Open the frontend from `https://swinggity.com`.
- Confirm `VITE_API_URL` points to `https://api.swinggity.com`.
- Confirm auth still works with cookies included.
- Repeat the same unsafe actions as localhost.
- Verify a request from an untrusted origin is rejected with `403`.
- Confirm logout clears both cookies in the browser.
