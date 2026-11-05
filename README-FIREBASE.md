# CollabCupid on Firebase

This is the fully serverless rebuild of CollabCupid: there is **no backend server at
all**. The React frontend talks directly to **Cloud Firestore** (NoSQL database),
**Firebase Authentication**, and **Firebase Storage** using the Firebase client SDK.
Real-time chat, typing indicators, presence, and notifications run on Firestore's
native `onSnapshot` listeners instead of Socket.IO. Everything is designed to run on
Firebase's free **Spark** plan -- no Cloud Functions are used anywhere, which also
means a few writes that would normally be relayed through a trusted backend are made
directly from the acting user's own client instead. Every one of those spots is called
out with a `TRUST BOUNDARY` comment in `firestore.rules` / `storage.rules` -- read that
section below before deploying this somewhere that isn't a small trusted community
(a class, a club, a hackathon).

## What changed from the original build

The original delivered build used FastAPI + SQLAlchemy + Socket.IO with local-disk
file storage, matching the SRS's reference architecture. This version replaces all of
that with Firebase/Firestore per your request, and also adds two Home page UI changes:
collaborator profiles are now listed alongside projects, with an **All / Projects /
Profiles** filter button above the listings. The `backend/` folder is gone -- there is
nothing left to run except the frontend.

| Old (FastAPI) | New (Firebase) |
|---|---|
| PostgreSQL / SQLite via SQLAlchemy | Cloud Firestore (NoSQL documents) |
| JWT auth, `passlib`/`bcrypt` | Firebase Authentication (email/password) |
| Socket.IO realtime server | Firestore `onSnapshot` listeners |
| Local disk file storage | Firebase Storage |
| REST API (`backend/app/routers/*`) | Direct Firestore/Storage calls from `frontend/src/lib/firestoreApi.ts` |

## Project layout

```
firebase.json              Hosting + emulator + rules/indexes config
firestore.rules            Firestore security rules (read this!)
firestore.indexes.json     Composite indexes the app's queries need
storage.rules               Firebase Storage security rules
scripts/seed-emulator.mjs  Optional: seeds demo accounts + sample projects (emulator only)
frontend/                  The React app -- this is the entire application now
```

## Firestore schema

```
users/{uid}                          -- profile, skills, interests, presence
projects/{projectId}                 -- title, description, owner*, memberIds[]
  projects/{projectId}/positions/{positionId}
  projects/{projectId}/repoFiles/{fileId}
    projects/{projectId}/repoFiles/{fileId}/versions/{versionId}
collaborationRequests/{requestId}    -- join requests + invitations
conversations/{conversationId}       -- direct DMs + per-project group chat
  conversations/{conversationId}/messages/{messageId}
notifications/{notificationId}
```

Full field-level shapes are in `frontend/src/types/index.ts`. A few schema notes worth
knowing if you extend this:

- **Denormalization everywhere.** Firestore has no joins, so things like the owner's
  name/photo are copied onto each project document, and `memberIds` is a plain array
  on the project doc kept in sync by `createProject` / `finalizeAcceptance` /
  `removeCollaborator` in `firestoreApi.ts`. This is also what `firestore.rules` and
  `storage.rules` check to decide who can touch a project's repository.
- **Client-side search.** Firestore has no full-text search and limited compound
  queries, so `searchProjects` / `searchCollaborators` fetch a bounded candidate set
  (all open projects, all users) and filter in JavaScript. Fine at student-project
  scale; a larger deployment would want Algolia/Typesense fed by Firestore triggers.
- **Recommendations** are a simple skill/interest word-overlap score computed
  client-side (`overlapScore` in `firestoreApi.ts`) -- no ML, matching the SRS's intent
  without needing a backend to run a model.

## Running it locally against the Firebase Emulator Suite

You don't need a real Firebase project to develop or try this out. The Firebase Local
Emulator Suite runs Auth, Firestore, Storage, and Hosting entirely on your machine.

**One-time setup:**

```bash
cd frontend
npm install              # also installs the firebase-tools CLI locally
```

**Every time you want to run it:**

```bash
# Terminal 1, from the repo root (or `npm run emulators` from frontend/)
firebase emulators:start --project demo-collabcupid

# Terminal 2
cd frontend
npm run dev
```

Open `http://localhost:5173`. The app is already configured (see
`frontend/.env.development`) to talk to the emulators instead of a real project, using
a `demo-` prefixed project ID, which needs no Google login and never touches real
Firebase at all. The Emulator UI is at `http://localhost:4000` -- it's the easiest way
to inspect Firestore documents, see Auth users, and read emails the Auth emulator
"sent" (e.g. password reset links) while developing.

**Optional: seed demo data.** With the emulators running:

```bash
cd scripts
npm install
npm run seed
```

This creates four demo accounts (password `Passw0rd!` for all): `johanna@college.edu`,
`aiden@university.edu`, `maria@techinstitute.edu`, `raj@college.edu`, plus two sample
projects with a team member and a pending join request, so there's something to look
at immediately. It's safe to re-run (skips anything that already exists), and it only
ever talks to the emulators.

> **A note on testing in this environment:** this build was verified with a full
> TypeScript compile (`tsc -b`) and a production `vite build`, both clean, plus a
> careful manual trace of every Firestore write in `firestoreApi.ts` against
> `firestore.rules` to confirm each one is actually permitted (documented as the
> `TRUST BOUNDARY` comments in that file). I was not able to run the Firestore/Storage
> emulators live myself here -- they need to download their Java emulator binaries
> from `storage.googleapis.com` on first run, and this sandbox's network policy blocks
> that host. Your own machine won't have that restriction, so please do run through
> the emulator flow above (and the seed script) once before deploying -- if anything
> doesn't line up, the rules file is the first place to look, and I'm glad to help fix
> it from an error message.

## Setting up a real Firebase project

You said you don't have a Firebase project yet, so here's the exact path through the
console. Everything below is on Firebase's free **Spark** plan -- no credit card or
Blaze upgrade needed for anything this app uses.

1. **Create the project.** Go to <https://console.firebase.google.com>, click **Add
   project**, give it a name (e.g. "CollabCupid"), and click through the wizard
   (Google Analytics is optional -- you can disable it). Click **Create project**.

2. **Enable Authentication.** In the left sidebar: **Build > Authentication > Get
   started**. Under the **Sign-in method** tab, click **Email/Password**, toggle it
   **Enable**, and click **Save**.

3. **Enable Firestore.** **Build > Firestore Database > Create database**. Pick a
   location close to your users (you can't change this later) and start in
   **production mode** (our `firestore.rules` will be deployed over this -- see
   below). Click **Create**.

4. **Enable Storage.** **Build > Storage > Get started**. Pick the same location you
   used for Firestore, start in production mode, click **Done**.

5. **Register a web app.** Click the gear icon next to **Project Overview** >
   **Project settings**. Under the **General** tab, scroll to **Your apps**, click the
   **</>** (web) icon, give it a nickname (e.g. "CollabCupid Web"), and click **Register
   app**. Firebase shows you a `firebaseConfig` object -- copy those six values
   (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`,
   `appId`).

6. **Fill in your environment file.** Copy `frontend/.env.production.example` to
   `frontend/.env.production.local` and paste in the six values from step 5, with
   `VITE_USE_FIREBASE_EMULATOR=false`.

7. **Point the Firebase CLI at your project.** From the repo root:

   ```bash
   npx firebase login            # opens a browser to sign into your Google account
   npx firebase use --add        # pick your new project, give it an alias like "default"
   ```

   This writes your real project ID into `.firebaserc`, replacing the
   `YOUR-FIREBASE-PROJECT-ID` placeholder.

8. **Deploy the security rules and indexes** (do this before anyone uses the real
   project -- it starts with no rules deployed, which denies everything by default):

   ```bash
   npx firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

## Deploying

```bash
cd frontend
npm run build                 # outputs frontend/dist
cd ..
npx firebase deploy --only hosting,firestore:rules,firestore:indexes,storage
```

Firebase Hosting gives you a URL like `https://your-project-id.web.app` -- that's it,
the whole app is live. There's nothing else to host or run; there's no server.

To redeploy after a code change, just repeat the `npm run build` + `firebase deploy`
steps.

## Security model & trust boundaries (read this before deploying for real)

`firestore.rules` and `storage.rules` enforce:

- Anyone can browse projects and collaborator profiles (even signed out), matching the
  original app's public browsing.
- Only you can edit your own profile.
- Only a project's owner can edit or delete it.
- Only a project's owner + accepted collaborators can read/write its repository files.
- A collaboration request can only be read or acted on by the two people it's between,
  and only while it's still pending.
- Chat messages and conversations are restricted to their members.
- Notifications can only ever be read, marked-read, or cleared by the person they
  belong to.

Because there's no backend to relay cross-user side effects, a few specific writes
are necessarily made by one user's client on another user's behalf -- e.g. creating a
notification in someone else's inbox when you message them or request to join their
project, or a newly-accepted collaborator adding themselves to a project's group chat
and team list. Each of these is a narrow, specific permission (not "anyone can write
anything") and is marked with a `TRUST BOUNDARY` comment right where it's allowed in
`firestore.rules`. This is a reasonable tradeoff for a small trusted community (a
class, a club) built with zero backend infrastructure; if you ever deploy this more
broadly, the fix is to move exactly those writes into a small number of Cloud
Functions (which do require the Blaze plan, but Blaze still has a generous free tier)
so they're verified server-side instead of trusted from the client.

## Known limitations (same spirit as the original README)

No Cloud Functions anywhere, by design (see above) -- this is the one architectural
choice made for you rather than asked about, to keep the whole app on the free plan.
Search is client-side filtering rather than a real search index (fine at this scale).
Recommendations are word-overlap scoring, not ML. Payment processing, a public
forum/feed, git-style branching/merging of repository files, and voice/video chat
remain out of scope per the SRS's own constraints section, same as the original build.
