# Final Integrated Architecture

```text
                    SIH26238 Unified Product
                             │
             ┌───────────────┴───────────────┐
             │                               │
      Student Experience               Operations Console
          Suryansh                           Rijvan
       Next.js :3000                     Next.js :3001
             │                               │
             │ REST / Contract v1            │ REST / Contract v1
             └───────────────┬───────────────┘
                             │
                Documents + Verification
                         Suryaansh
                       FastAPI :8000
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   Documents            Verification          Evidence
   Repository             Engine              + Audit
        │                    │                    │
        └──────────── SQLite / Source Connectors ┘
```

## Ownership remains intact

**Suryansh:** student-facing experience, forms, navigation, client adapters.

**Rijvan:** scholarship master, eligibility rules, application workflow, deficiencies, reviews, sanctions, payments, notifications, JAGO, beneficiary intelligence.

**Suryaansh:** document lifecycle, source connectors, identity matching, verification, evidence, exceptions, verification investigation.

No service reads another owner's internal database tables. Integration happens through HTTP contracts.

## Demo path

The startup script seeds both databases, records a scholarship-verification consent, creates the document set and source observations, then starts all services with the student app as the main entry point.
