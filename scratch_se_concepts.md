# CollabCupid — Software Engineering Concepts Explainer (for project review)

This covers the "why," not just the "what," behind the methodology, modeling, and estimation chapters of your report — so you can answer a follow-up question confidently instead of just reading the slide.

---

## 1. Why the Agile (Scrum) model was chosen

**The general idea**: Agile development breaks a project into short, repeatable cycles ("sprints," usually 1–4 weeks) instead of trying to nail down every requirement up front and build the whole system in one long pass (that's the older **Waterfall model** — requirements → design → implementation → testing → deployment, each phase finished before the next starts, with no going back). At the end of every sprint you have a working, demoable slice of the product, you get feedback, and you adjust the next sprint based on it. **Scrum** is the specific, most widely used flavor of Agile: it adds concrete roles (Product Owner, Scrum Master, Dev Team), a prioritized backlog, sprint planning, and a sprint review/retrospective at the end of each cycle.

**Why Waterfall would have been the wrong fit here, specifically**: Waterfall assumes you understand the requirements completely before writing code. For a six-module system being built by a two-person student team, across one semester, with no prior production version to copy — that assumption doesn't hold. If you got the collaboration-request workflow or recommendation logic "wrong" in a Waterfall design phase, you wouldn't find out until integration testing, months later, when it's expensive to fix.

**Why Agile/Scrum specifically fit CollabCupid** (this is the actual reasoning in your SDLC slide — know each bullet, not just the list):

- **Incremental, module-wise delivery**: the six modules (Account Management, Project Management, Discovery, Collaboration Requests, Repository, Messaging/Notifications) map naturally onto a sprint-by-sprint backlog — each one could be built, demoed, and considered "done" somewhat independently.
- **Evolving requirements**: things like the recommendation scoring logic, the exact collaboration-request state machine, and real-time notification behavior weren't fully specified up front — they were refined as you saw them working (or not working) in practice. Agile is built for exactly that; Waterfall punishes it.
- **Continuous stakeholder feedback**: your faculty guide and peer reviewers effectively played the Product Owner role, reviewing a working increment at the end of each sprint rather than only at a single final demo.
- **Faster risk mitigation**: a concrete example you can cite if asked — the duplicate collaboration-request bug was caught and fixed within the same sprint it was introduced in, not discovered during a late-stage test phase.
- **Fit with the tech stack**: because Firestore is a NoSQL document database organized into independent collections (see §3), each module's data model and screens could genuinely be built and iterated on in isolation, without the tightly-coupled schema migrations a relational database + Waterfall combination tends to produce.
- **Fit with a fixed academic timeline**: short 1–2 week sprints gave you a way to track real progress against hard semester deadlines, while still leaving room to re-prioritize scope if something was taking longer than expected.

**If asked "how is this different from just doing things in order anyway"**: the key distinguishing feature of Scrum isn't "we did things in stages" — it's that each stage produced a *working, reviewable increment* with a feedback loop closing *before* the next stage started, and that scope could be *re-negotiated* sprint to sprint rather than being frozen at the start.

---

## 2. The UML diagrams — what each one is for

UML (Unified Modeling Language) is a standard notation for describing a software system's structure and behavior visually, so design can be reviewed and communicated without reading code. Your report uses eight diagrams, split across two categories:

**Structural diagrams** (what the system *is made of*):
- **Class Diagram** — the system's core data/object types and their relationships. Yours centers on `ProjectOwner`, `Project`, `CollaborationRequest`, and `Collaborator`, with their key attributes and operations (`createProject`, `requestToJoinProject`, etc.). This is the closest UML equivalent to "here's your data model," though note it's a conceptual OO view — the actual implementation is Firestore documents, not classes (see §3).
- **Component Diagram** — how the system is divided into larger deployable/replaceable units (e.g., the frontend app, Firebase Auth, Firestore, Storage) and how they depend on each other.
- **Deployment Diagram** — the physical/infrastructure view: which pieces of software run on which nodes (the user's browser, Firebase's hosting/backend infrastructure) and how they're connected over a network.
- **Entity-Relationship (ER) Diagram** — strictly a database-modeling diagram, not core UML, but included here for the same reason: it shows entities (`PROJECT_OWNER`, `PROJECT`, `PROJECT_MEMBER`, `COLLABORATOR`, `COLLABORATION_REQUEST`) and their cardinality (1-to-many, etc.) — e.g., one `PROJECT_OWNER` owns many `PROJECT`s, one `PROJECT` has many `PROJECT_MEMBER`s.

**Behavioral diagrams** (what the system *does*):
- **Use Case Diagram** — the system's functionality from an actor's point of view: what can a Project Owner do, what can a Collaborator do, at a glance, without any implementation detail.
- **Activity Diagram** — a flowchart-style view of a *process*, with branches and parallel paths. Yours covers Registration & Login, and Project Discovery & Collaboration Request — useful for showing decision points (e.g., "is the email already registered?").
- **Sequence Diagram** — shows a *specific interaction* as a time-ordered sequence of messages between objects/actors (e.g., Collaborator → Frontend → Firestore → Project Owner's notification). This is the diagram to reach for if asked "walk me through what happens when X" — it literally shows the call order.
- **Statechart Diagram** — models the *lifecycle of a single entity* as a finite set of states and the transitions between them. Yours models the Collaboration Request lifecycle (pending → accepted/rejected), across the four participants (Project Owner, System, Real-time Services, Collaborator). This is the right diagram to point to if asked "what are all the possible states of a request, and what moves it between them."

**If asked "why these eight and not more/fewer"**: together they cover all three standard UML perspectives — structural (Class, Component, Deployment, ER), behavioral/process (Use Case, Activity), and behavioral/interaction-or-lifecycle (Sequence, Statechart) — which is the conventional minimum spread for an academic SRS/design document; you're not missing a major category.

---

## 3. Database structure

CollabCupid uses **Cloud Firestore**, a **NoSQL document database** — conceptually different from the relational (SQL) databases you've likely used in coursework, and worth being able to explain the contrast clearly:

| Relational (SQL) | Firestore (NoSQL document) |
|---|---|
| Data lives in tables with a fixed schema (rows/columns) | Data lives in **collections** of **documents** — each document is a flexible, JSON-like object |
| Related data is split across tables and joined at query time (`JOIN`) | Related data is often **denormalized** — duplicated into the document that needs it, specifically to avoid needing a join |
| A schema change requires a migration | Documents in the same collection don't have to share an identical shape |
| Access control is usually enforced by backend application code | Access control is enforced by **Firestore Security Rules**, evaluated server-side on every request — there's no backend server in this app at all (see the Tech Stack doc) |

**CollabCupid's actual collections**:
- `users` — one document per account (profile, skills, interests).
- `projects` — one document per project, with a `positions` **subcollection** (the open roles on that project) and `repoFiles` → `versions` subcollections (repository file metadata).
- `collaborationRequests` — one document per join request or invitation, referencing a project and a user.
- `conversations` — one per chat (direct or per-project group), with a `messages` subcollection.
- `notifications` — one per notification event.

**Why denormalization, specifically, and why it's not "bad design"**: a project document stores the owner's name and profile picture *directly on the project*, rather than only storing the owner's ID and looking their name up separately every time a project card is displayed. In a relational database this would usually be considered redundant data that risks going stale. In Firestore it's the recommended pattern, because: (1) Firestore has no server-side `JOIN` — fetching "the owner's name for 20 projects" without denormalization would mean 20 separate reads; (2) reads are billed per-document, so avoiding extra reads has a real cost benefit; (3) the tradeoff (the copied name can go stale if the owner later renames themselves) is explicitly accepted in the design as reasonable for this scale. The project's `memberIds` array is the other key denormalized field — it's kept in sync whenever a request is accepted or a collaborator is removed, specifically so Security Rules can check "is this user allowed to see this repository" with a single cheap lookup instead of a query.

**If asked "why not use a SQL database"**: Firestore was chosen because it pairs with Firebase Authentication, Storage, Hosting, and Security Rules as one managed platform with zero backend server to write or host — which is precisely what made the no-custom-backend, two-person, one-semester approach feasible (see the Tech Stack doc for the full argument).

---

## 4. The COCOMO model

**COCOMO** (Constructive Cost Model, Boehm 1981) is a formula-based way to estimate software development **effort** (in person-months), **time** (in months), and **team size**, from an estimate of the project's size in **KLOC** (thousands of lines of code).

**Basic COCOMO formulas** (the ones your report uses):

$$E = a \times (KLOC)^b \qquad T = c \times (E)^d$$

where `a`, `b`, `c`, `d` are constants that depend on which of three **project categories** you classify the work as — this is the part most likely to get a follow-up question, so know it cold (see §5 below for the "why Organic" justification specifically).

**Your actual numbers, and what each one means:**
- **Size estimate: ≈6 KLOC** — reasoned from the six functional modules and the React/Firebase stack (not line-counted after the fact; COCOMO is meant to be used as a planning estimate before/during development).
- **Effort, E = 2.4 × (6)^1.05 ≈ 15.75 person-months** — the total amount of work, expressed as "how many months would this take one person working alone."
- **Development Time, T = 2.5 × (15.75)^0.38 ≈ 7.13 months** — the *calendar* time the model predicts, which is shorter than the effort figure because work is assumed to be spread across more than one person.
- **Average Staffing, P = E / T ≈ 2.2 people** — effort divided by time gives you back the implied team size — a sanity check that the estimate is internally consistent with reality (you had a 2-person team).
- **Productivity = KLOC / E ≈ 0.38 KLOC per person-month** — a standard way to express how much output each person-month of effort produced.

**The evaluation your report draws, which you should be able to explain in your own words**: CollabCupid actually shipped on the 3-month Gantt schedule, not the ≈7-month COCOMO estimate. That's not a contradiction — it's explained by two real factors: the actual work was more *intensive/compressed* than COCOMO's average assumptions (COCOMO is calibrated on a broad historical dataset, not your specific sprint cadence), and a meaningful chunk of effort that COCOMO's constants implicitly assume (building auth, building a database layer, building a UI component system from scratch) was instead absorbed by **managed platform services** — Firebase Auth/Storage/Firestore and existing UI libraries meant you weren't writing that code yourselves. This is a genuinely good point to make if asked "why did the estimate not match reality" — it shows you understand COCOMO's assumptions rather than just plugging numbers into a formula.

---

## 5. Why this project is classified as "Organic"

COCOMO's three project categories, and the actual criteria for each (this is the part worth memorizing, since "why Organic and not one of the others" is a very natural review question):

| Category | Team size & experience | Requirements | Typical example |
|---|---|---|---|
| **Organic** | Small, team is familiar with the problem domain | Flexible, can evolve | A small business data-processing or academic web app |
| **Semi-detached** | Medium team, mixed experience levels | A mix of rigid and flexible requirements | A utility program, a compiler, a database management system |
| **Embedded** | Must operate within tight constraints (hardware, regulations, very complex interfacing) | Rigid, often safety/mission-critical | Real-time flight control software, embedded firmware |

**Why CollabCupid specifically fits Organic, point by point:**
- **Small, familiar-enough team**: two developers, which is squarely in Organic's expected range (Organic projects are typically ≤ ~50 KLOC with small teams — CollabCupid's ≈6 KLOC is well inside that).
- **Well-understood application domain**: it's a CRUD-plus-auth-plus-chat web application — user accounts, listings, requests, messaging — a very well-trodden category of software, not a novel or specialized problem space requiring new theory or unfamiliar algorithms.
- **Requirements refined iteratively rather than fixed up front**: directly matches Organic's "flexible requirements" criterion, and is the same underlying reason Agile/Scrum (§1) was the right process choice — the two decisions reinforce each other, which is worth pointing out if asked how your methodology choices relate to each other.
- **No tight embedded/hardware/regulatory constraints, no large unfamiliar integration surface**: rules out both Semi-detached and Embedded.

**If asked "could this be Semi-detached instead"**: a defensible position, but the deciding factor is team familiarity with the *kind* of system being built (standard web app patterns) even if some specific tools (Firestore, real-time listeners) were new to the team — Organic classification is about domain familiarity, not tool familiarity. Know that distinction; it's the likely follow-up.

---

## 6. Function Point Analysis (FPA)

**The general idea**: where COCOMO estimates size from lines of code, **Function Point Analysis** estimates size from a system's *functionality as the user experiences it* — counting things like inputs, outputs, and stored data groupings — which has the advantage of being countable from requirements/design, before a single line of code exists, and independent of which programming language you'll use (a point worth making if asked "why use two different estimation methods instead of just one").

**IFPUG's five function types, and what each one means in plain terms:**
- **External Input (EI)** — a user-supplied input that adds/changes data (e.g., submitting the registration form, creating a project).
- **External Output (EO)** — data the system derives/presents, typically involving some processing (e.g., a notification message).
- **External Inquiry (EQ)** — a request that retrieves data without deriving/transforming it (e.g., a search).
- **Internal Logical File (ILF)** — a logical group of data maintained *within* the system (in CollabCupid's case, this maps to Firestore collections like `users`, `projects`, `collaborationRequests`).
- **External Interface File (EIF)** — a logical group of data referenced by the system but maintained by *another* system (an external service's data your app reads but doesn't own).

**Your actual numbers:**

| Function Type | Count | Subtotal |
|---|---|---|
| External Input (EI) | 10 | 40 |
| External Output (EO) | 4 | 20 |
| External Inquiry (EQ) | 6 | 24 |
| Internal Logical File (ILF) | 7 | 52.5 |
| External Interface File (EIF) | 2 | 15 |

Each count is multiplied by a standard IFPUG complexity weight (which is why, e.g., 7 ILFs contribute 52.5 rather than a round multiple of 7 — ILFs/EIFs typically carry higher per-item weight than EIs/EOs/EQs, reflecting that "a whole stored data group" is inherently more complex than "one input field"). Summing the subtotals gives **Unadjusted Function Points, UFP ≈ 168** (your report rounds up slightly to account for composite screens that span more than one function type).

**Value Adjustment Factor (VAF) ≈ 1.07** — a multiplier (typically 0.65–1.35) that adjusts for overall system complexity factors like real-time processing, performance requirements, and reusability. Your 1.07 reflects *moderate* complexity — specifically called out as coming from the real-time chat/notification behavior over Firestore listeners, and the system needing to work across multiple sites/devices.

**Adjusted Function Points: FP = UFP × VAF ≈ 168 × 1.07 ≈ 180.**

**The cross-validation step — this is the most important thing to be able to explain**: Function Points can be converted to an *implied* lines-of-code estimate using a standard industry ratio (≈30–35 LOC per FP for a typical high-level language). At that ratio, 180 FP implies ≈5,940 LOC — which lines up closely with the ≈6,000 LOC (6 KLOC) used independently for the COCOMO estimate in §4. **The point of doing both FPA and COCOMO isn't redundancy — it's that two independently-derived estimates (one counting user-visible functionality, one counting code volume) converging on the same answer is evidence the sizing is reasonable**, rather than a guess that happens to look precise. This is exactly the kind of thing a reviewer asks about, and "the two methods cross-validate each other" is the one-sentence answer that shows you understand *why* both are in the report.

---

## 7. Bonus: testing strategy, briefly (likely adjacent question)

- **Blackbox testing** (your primary technique, 30 cases): testing purely through the UI/inputs-and-outputs, with no reference to the internal code — appropriate because it verifies the system meets the SRS's *stated* behavior, which is what actually matters to a user.
- **Whitebox testing** (applied narrowly, to `recommendProjects()`): testing based on the internal logic/structure of the code itself. You used **cyclomatic complexity** — a metric (V(G), from a control-flow graph) that counts the number of independent linear paths through a function, which tells you the *minimum* number of test cases needed for full branch coverage. V(G) = 3 means three independent paths needed to be exercised. This was applied narrowly (not to every function) specifically because it was identified as your most decision-heavy function — the right engineering call is to spend whitebox effort where branching complexity is actually concentrated, not uniformly everywhere.
- **Result**: 29/30 passed first execution; the one failure (TC204 — a missing ownership check letting a non-owner attempt to edit a project) was a real, specific security-relevant bug you found, fixed, and re-verified — a concrete, well-rounded story if asked "tell me about a bug you found during testing."

---

## One-paragraph summary (if you only memorize one thing per topic)

*"We used Agile/Scrum because requirements for a few modules — recommendations, the request workflow — were expected to evolve, and Firestore's independent collections let each module be built and iterated on in isolation; that's also exactly why the project classifies as COCOMO 'Organic' — small, domain-familiar team, flexible requirements. The eight UML diagrams cover structural and behavioral views of the same system from different angles. The database is Firestore, a NoSQL document store, with denormalization used deliberately to avoid joins Firestore can't do server-side. COCOMO estimated ≈7 effort-months from ≈6 KLOC; Function Point Analysis independently estimated ≈180 FP from counted inputs/outputs/data stores, which converts to almost the same ≈6 KLOC — two independent methods agreeing is the actual point of including both."*
