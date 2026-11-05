# CollabCupid

_Post Ideas. Find Partners. Build for Fun._

A platform where students post project ideas, discover collaborators, form teams,
manage a per-project repository, and communicate in real time -- implementing all six
system features from the original SRS (user accounts, project discovery, collaborator
discovery, repository management, messaging & notifications, and recommendations).

**This build runs entirely on Firebase** -- React + TypeScript + Tailwind on the
frontend, talking directly to Cloud Firestore, Firebase Authentication, and Firebase
Storage. There is no backend server. See **[README-FIREBASE.md](README-FIREBASE.md)**
for the full architecture writeup, the Firestore schema, how to run it locally against
the free Firebase Emulator Suite (no Google account needed), how to set up a real
Firebase project from scratch, and how to deploy.

## Quick start (local, no Firebase account needed)

```bash
cd frontend
npm install
npm run emulators     # terminal 1 -- starts the local Firebase emulators
npm run dev           # terminal 2 -- starts the app at http://localhost:5173
```

Optionally seed some demo accounts and sample projects:

```bash
cd scripts && npm install && npm run seed
```

Everything else -- the Firestore schema, security rules and their documented trust
boundaries, how to create a real Firebase project and deploy to it, and what's in vs.
out of scope -- is in **[README-FIREBASE.md](README-FIREBASE.md)**.
