# Yali product knowledge

Yali's product knowledge is a small, curated server-side module at
`api/_utils/support-knowledge.ts`. It contains general documentation only. It
does not query user rows, embeddings, a vector store, or any hosted service.

## How selection works

Every request gets the signed-in dashboard role's short navigation guide. The
last user question is normalized and scored against maintained topic keywords.
Only matching topics available to that role are eligible; ties keep source
order, at most three topics are selected, and the final knowledge block is
capped at 4,500 characters. This keeps model context deterministic and avoids
sending the whole corpus with every message.

The server sends this block after the safety system prompt and labels it as
general documentation, not live account state. Existing restrictions still
apply: Yali cannot inspect private data or change accounts, bookings, payments,
messages, or documents.

## Maintaining it

The application source remains authoritative. When a flow changes:

1. Update the owning implementation and architecture documentation first.
2. Find the corresponding topic in `support-knowledge.ts`; each entry comments
   the files that support it.
3. Update the entry and its role/keyword routing. Keep the prose factual and
   avoid promises about data the assistant cannot see.
4. Add or adjust a focused assertion in
   `scripts/verify/support-knowledge.ts`, including an unrelated topic that
   must not be selected.
5. Run `npx tsx scripts/verify/support-knowledge.ts`,
   `npx tsx scripts/verify/support-chat-request.ts`, typecheck, and lint.

The main sources are:

- `docs/architecture/overview.md` for roles and end-to-end product flows.
- `docs/architecture/integrations.md` for Stripe, Google, Zoom, and email.
- `docs/COLLABORATION.md` and `v_student_entitlements` for the payment-only
  access rule and invitation boundary.
- Role layout files for current navigation labels.
- `api/_utils/fulfil.ts` for paid tutoring/admissions fulfilment.
- Messaging, notification, parent, and admissions services for UI behavior.

## When to consider retrieval infrastructure

Keep this approach while the corpus is small and product-owned. A future RAG
or vector-search system may help if Yakal gains a large policy/help center,
many versioned programs, or staff-authored operational content. That should be
a separate design with source freshness, access filtering, citations,
evaluation, and a strict ban on indexing private user rows. It is unnecessary
for the current bounded product guide.
