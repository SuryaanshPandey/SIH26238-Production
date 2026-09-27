# JAGO — Application Agent Contract

JAGO is the student-facing control layer for the scholarship portal. It is not a generic chatbot or a free-form LLM that invents facts. The backend resolves requests against the authenticated student context and returns grounded text plus safe in-app actions.

## What JAGO can do

| User goal | JAGO behavior | App action |
|---|---|---|
| Explore scholarships | Reads active/upcoming scheme records and summarizes them | `/scholarships` and scheme pages |
| Apply for a known scheme | Matches scheme name/code and opens the real application wizard | `/applications/new?scheme=...` |
| Track an application | Resolves the student's application by explicit ID, scheme, status, or relevant workflow | Application detail |
| Track payment | Reads the linked payment record and distinguishes processing/success/failure/returned | Application detail |
| Understand deficiencies | Reads open/action-required/in-review deficiencies and explains the next action | Action Centre |
| Upload a document | Determines the requested type and opens the real upload modal | `/documents?jagoAction=upload...` |
| Required documents | Uses the scheme's stored required-document list | Document wallet |
| Eligibility questions | Uses the authenticated profile and stored evaluation/rule data | Eligibility checker |
| Verification/sanction questions | Uses stored evaluation, verification-stage and sanction records | Application detail |
| Open app sections | Maps natural-language navigation requests to real routes | Dashboard, profile, notifications, actions, documents, scholarships, applications |
| Hindi / Hinglish | Accepts Devanagari and bilingual queries; explicit UI language remains supported | Hindi responses |

## Conversation principles

1. Resolve explicit application IDs first. If an explicit ID is not owned by the signed-in student, JAGO does not fall back to another application.
2. Reuse the latest in-session application context for follow-up questions such as “what about this one?” until the user selects another application.
3. Prefer stored records over inference. Unknown payment reasons, verification results, deadlines, or eligibility rules are not invented.
4. Deficiencies are explained as action items, not treated as automatic rejection.
5. File upload is initiated by JAGO, but the user explicitly selects the local file in the browser.
6. High-impact actions such as final submission, withdrawal, deletion, or external financial activity are not silently executed. JAGO routes the student to the relevant app workflow instead.
7. Requests outside the portal are handled explicitly and redirected to supported capabilities instead of hallucinating an answer.

## API response

`POST /jago/query` returns:

- `intent` — one of the nine contract intents.
- `response` — grounded natural-language answer.
- `application_id` — the application used as context, when applicable.
- `source_refs` — application/scheme/evaluation/payment/deficiency references used.
- `suggested_actions` — typed `NAVIGATE` actions rendered as buttons in the client.
- `suggested_followups` — contextual prompts the student can tap.

`GET /jago/history/:studentId` returns the signed-in student's recent JAGO conversation records and is identity-bound in the API route.
