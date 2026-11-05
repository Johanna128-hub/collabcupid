# CollabCupid — Tech Stack Explainer (for project review)

## 1. Architecture in one sentence

CollabCupid is a **fully client-side ("serverless") web app**: the React frontend talks directly to Firebase's managed services (Firestore, Auth, Storage) using Firebase's client SDK, with no custom backend server and no Cloud Functions. All business rules that would normally live in a backend — "can this user see this document," "can this user write to someone else's inbox" — are instead enforced declaratively through **Firestore Security Rules**, which run on Google's servers and are the actual gatekeeper for every read/write the app makes. This keeps the whole project on Firebase's free Spark plan while still being genuinely secure, not just "secure because the UI doesn't show the button."

If asked *"where's your backend?"* in review: there isn't one in the traditional Express/Django sense — Firebase **is** the backend (managed database + auth + file storage + hosting), and the security model lives in rules files instead of server code.

## 2. Frontend stack

| Layer | Technology | Why it's here |
|---|---|---|
| UI library | **React 19** | Component-based UI, the de facto standard for this kind of SPA |
| Language | **TypeScript** | Static typing across components, Firestore data shapes, and API functions — catches whole classes of bugs (wrong field names, null handling) at compile time rather than at runtime |
| Build tool | **Vite 8** | Fast dev server with hot module reload, and a production bundler (`vite build`) that outputs the static files Firebase Hosting serves |
| Routing | **React Router v7** | Client-side routing for a single-page app — `/my-projects`, `/projects/:id`, `/users/:id`, etc., all without full page reloads |
| Styling | **Tailwind CSS v4** | Utility-first CSS; the whole visual theme (colors, gradients) is defined once as design tokens and reused everywhere instead of hand-written CSS files per component |
| Icons | **lucide-react** | Consistent icon set used throughout the nav, buttons, and cards |
| Animation | **Framer Motion** | Used for UI transitions/micro-interactions |
| Code editor | **Monaco Editor** (`@monaco-editor/react`) | The exact editor engine that powers VS Code — embedded in the Repository page so collaborators can view and edit code files in-browser, with syntax highlighting |

**State management**: no Redux/Zustand/etc. — state is handled with React's built-in **Context API**. Two contexts drive the whole app:
- `AuthContext` — the current signed-in user, login/register/logout, and a lightweight "online" heartbeat.
- `NotificationContext` — live notification list and unread count, fed by a Firestore real-time listener.

This is a deliberate scope decision: the app's shared state is small and well-bounded (auth + notifications), so Context is simpler than pulling in an external state library.

## 3. Backend-as-a-service: Firebase

| Firebase product | What it stores / does |
|---|---|
| **Firestore** | The primary database — a NoSQL, document-oriented store. Collections: `users`, `projects` (with a `positions` subcollection per project), `collaborationRequests`, `conversations` (with a `messages` subcollection), and `notifications`. |
| **Firebase Authentication** | Email/password accounts, session/token management, password reset flow. |
| **Firebase Storage** | The actual bytes of uploaded repository files (code, images, docs). Firestore only stores the *metadata* about a file (path, size, version number, who uploaded it) — the file content itself lives in Storage, referenced by a storage path. |
| **Firebase Hosting** | Serves the built static site (the `frontend/dist` output from `vite build`) as a global CDN-backed SPA, with a rewrite rule sending every route to `index.html` so client-side routing works. |
| **Firestore Security Rules** (`firestore.rules`) | The real authorization layer — declarative rules evaluated server-side on every single read/write, independent of what the UI tries to do. |
| **Firestore Indexes** (`firestore.indexes.json`) | Composite indexes that let Firestore efficiently serve multi-field queries (e.g. "requests for this project, with this status, sorted by date") — Firestore requires an explicit index for any query combining multiple filters/sorts beyond the simplest case. |

### Why Firestore instead of a traditional SQL database
Firestore is a document database: each record (a project, a user, a message) is a self-contained JSON-like document rather than a row that needs joins. The app leans on **denormalization** deliberately — e.g., a project document stores the owner's name and profile picture directly, rather than requiring a join to the `users` collection on every read. This trades a small amount of data duplication for much cheaper reads, which is the standard Firestore design pattern (joins are expensive/awkward in a document database, redundant reads are not).

## 4. Real-time features

Chat messages, typing indicators, and notifications all use Firestore's **`onSnapshot` listener** — instead of polling an API, the client subscribes to a query and Firestore pushes updates live over a persistent connection the moment the underlying data changes. This replaces what would traditionally be a Socket.IO/WebSocket layer on a custom backend, without having to run or scale any real-time server yourself.

## 5. Security model (the part worth explaining carefully in review)

Firestore Security Rules are evaluated **per request, on Google's servers**, not in the browser — so even though there's no backend, a malicious client can't bypass the rules by editing JavaScript, because the rules aren't JavaScript; they're a separate declarative policy the database itself enforces.

Two patterns worth knowing cold for Q&A:

- **TRUST BOUNDARY comments**: in a handful of specific, narrow cases (e.g., "add yourself to a project's group chat once your join request is accepted"), the rules deliberately allow a client to perform an action on another user's behalf, because there's no backend to relay it through. These are intentionally scoped as narrowly as possible (e.g., "you may only add *your own* uid to this list") and documented inline in `firestore.rules` as a conscious tradeoff, not an oversight.
- **List-query provability**: this is a genuinely subtle Firestore behavior worth mentioning if asked about debugging — when a client runs a *query* (not a single-document read), Firestore must be able to prove, from the query's own filter conditions alone, that every possible result satisfies the security rule, without looking at the actual data. A rule like `allow read if A == me OR B == me` can fail a query that filters only on `B`, even though every real matching document is actually fine — because Firestore can't statically prove the *other* half of the OR. This came up directly while debugging the app and was fixed by splitting such rules into multiple simpler `allow` statements and making sure queries filter on a field the rule can trace directly.

## 6. Build & tooling

- **TypeScript project references** (`tsc -b`) compile and type-check the project before every build.
- **Vite** bundles for production (`vite build`), producing the static `frontend/dist` folder.
- **oxlint** — a fast Rust-based linter — catches unused imports/variables and common mistakes.
- **npm scripts**: `dev` (local dev server), `build` (typecheck + bundle), `lint`, `preview` (serve the production build locally), `emulators` (run Firebase's local emulator suite for offline testing).

## 7. Deployment

```
npm run build                 # typecheck + bundle the React app into frontend/dist
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

`firebase.json` wires this together: it points Hosting at `frontend/dist`, and tells the Firebase CLI where to find the security rules and index definitions. There is no server to deploy — "deploying the backend" *is* pushing updated rules/indexes to Firestore.

## 8. One-paragraph summary (if you only memorize one thing)

*"CollabCupid is a React + TypeScript single-page app built with Vite and styled with Tailwind, running entirely on Firebase: Firestore for the database, Firebase Auth for accounts, Firebase Storage for uploaded files, and Firebase Hosting to serve it — with no custom backend server. Authorization is enforced by Firestore Security Rules instead of server-side code, real-time features (chat, notifications) use Firestore's live listeners instead of WebSockets, and the in-browser code editor is powered by Monaco, the same engine behind VS Code."*
