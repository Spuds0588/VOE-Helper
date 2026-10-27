# E-signing integrations — plan (written 2026-10-27, not yet built)

Where the WVOE flow ends by handing the processor a filled Form 1005, this
plan adds the next step: getting the returned, signed form back. Two lanes
were researched (2026-10-27): hosted e-sign APIs and open-source/self-hosted
platforms. Everything here is plan only — no code changed.

## The workflow constraint (read first)

Fannie Mae's rules for the Form 1005 shape the whole design:

- The **borrower signs to authorize release**; the **employer completes the
  verification and returns it directly to the lender** — not through the
  applicant. So the signing flow must route the completed form back to the
  lender, and a borrower-relayed PDF is not the deliverable.
- Fannie Mae requires e-signatures to be attributable to an identified
  signer, with records retained
  (Selling Guide A2-4.1-03, electronic records and signatures).
  A signature without a retained audit trail must not be treated as
  executable verification.

An extension-only design (no server) can create requests and hand out
signing URLs, but it cannot reliably receive callbacks, store the completed
document by itself (chrome.storage is not an email inbox or a document
vault), or keep secrets. Plan for that boundary explicitly.

## Option A — BYOK architecture (recommended shape)

"BYOK" here = the processor (user) supplies credentials for their own
e-signing account; VOE Helper never ships, holds, or funds a service
account. This is the only hosted-API lane that costs the user nothing
upstream of their own account.

```
side panel (WVOE view)
  └─ "Request e-signature" → picks provider → first use asks for credentials
       chrome.storage.local (user-facing, per-machine, NOT synced):
         esign.strings = provider key/token OR OAuth refresh, base URL
       service worker (or panel fetch — see caveat):
         POST create document  (Form 1005 bytes + signer role mapping)
         ← signing URL
       toast/panel: "Open signing page" (employer side) +
                    "Check status" poll  (extension side)
```

Constraints that temper the diagram:

- **No secrets in content scripts / synced storage.** Extension storage is
  inspectable; any key in `chrome.storage` is available to anyone at the
  machine. Acceptable for a single-user professional tool BYOK key, worth
  saying loudly in setup UI; never key a *shared* platform key here.
- **CORS per provider is unverified for `chrome-extension://` origins.**
  Chrome research: MV3 service workers with `host_permissions` can make
  cross-origin calls. Of the hosted set, **only DocuSign documents a
  CORS/public-token flow for browser apps** (public authorization-code
  OAuth). SignWell, BoldSign, Zoho, Adobe, DocuSeal use static API keys or
  confidential OAuth and do not document extension-origin CORS — plan for
  provider-specific probes, or a tiny companion server, before promising
  any given provider.
- **Lender-side webhook/callbacks are impossible with no server.** Status
  polling from the panel ("Check status" button) is the v1 substitute;
  "signed copy delivered" needs an inbox/poll of the provider.

### BYOK phases

1. **P-1 probe (1 session):** pick DocuSign public-OAuth as the first
   candidate; prototype create-envelope + embedded-sign URL from the service
   worker against a Developer (demo) account; document the exact
   Fannie Mae signer roles (borrower = authorize-release signer; employer =
   completing signer; completed copy routed to lender email).
2. **P-2 UI:** provider row in the WVOE view ("e-sign via …"), BYOK settings
   sheet storing credentials locally only, status chip in the panel
   (draft / sent / signed / declined), download-the-signed-PDF action.
3. **P-3 polish:** audit-trail citation (certificate-of-completion link),
   retention guidance in the panel note (Fannie Mae requirement), issue
   template hook for reporting failed envelopes.

## Option B — free, no-limits lane (what actually exists)

Researched 2026-10-27; prices/limits verified by source at writing time.

| Platform | Free reality | API auth | Verdict for us |
|---|---|---|---|
| **Documenso** (AGPL, self-host) | self-host unlimited, core signing free; needs SMTP + signing cert; Postgres | token, header, team-scoped | **Best self-host API lane** — but token stays server-side |
| **LibreSign** (AGPL, Nextcloud app) | no stated caps; only cost is optional support | Basic auth (Nextcloud creds) | only if already running Nextcloud — heavy otherwise |
| **DocuSeal** (AGPL) | self-host free unlimited **signing**, but **API/embedding is a paid Pro feature** even on-prem ($20/seat + $0.20/doc) | API key (JWT server-signed) | signing UI lane only, no free API |
| **OpenSign** (AGPL) | hosted free signing claimed; **self-hosted free cannot mint API tokens** | `x-api-token` (paid) | avoid for API; fine as manual upload target |
| **Lifted Sign** (AGPL, new) | self-host free forever claimed; SQLite, single container | REST `/api/mysign/*` | **lightest self-host**; new project, verify auth + maturity |
| **DottedSign self-hosted** (AGPL) | unlimited users/signings + API, but free-edition docs carry an embedded identifier | OAuth client-credentials | vendor-backed; heaviest stack (8 GB rec.) |
| Hosted: **SignWell** | dev acct 3 docs/mo; up to 25 API docs/mo free w/ card on file; $0.85/doc after | static API key | **best genuine hosted free tier** if low volume is enough |
| Hosted: **DocuSign** | Developer/demo only (non-binding); production API from ~$600/yr | public OAuth + documented CORS | only hosted lane with published extension-CORS guidance |
| Hosted: Dropbox Sign / Adobe / Zoho / BoldSign / eSignatures.io | sandboxes are watermarked/test, not free production | keys / OAuth | no free production lane worth planning around |

Sources: the researchers' cited pages —
documenso docs + pricing, docuseal.com/signing-api + pricing + on-premises,
opensignlabs API-token docs, libresign.coop FAQ + libresign.github.io API
guide, github.com/LiftedHoldings/lifted-sign, DottedSign self-hosted repo +
developer docs, signwell.com/api-pricing + help.center article, ecom.docusign
developer pricing + developers.docusign CORS/public-auth pages,
sign.dropbox.com API pricing, developer.adobe.com Acrobat Sign guides,
support.boldsign API FAQ, esignatures.com pricing + docs, zoho.com Sign
pricing + credits.

## Recommendation

- **Default lane: BYOK against a self-hosted endpoint the user controls**
  (Documenso first, Lifted Sign second) — no per-signature cost ever, the
  user owns retention; the extension talks to the user's own base URL with a
  user-minted token stored in local storage only.
- **Small-team hosted fallback: SignWell BYOK** (3/mo free, 25/mo with
  card, $0.85/doc) — cheapest way to offer e-signing without running a
  server; probe its CORS from an MV3 SW before committing.
- **Do not** build against sandboxes claiming to be production
  (DocuSign demo, Dropbox Sign test, Adobe Developer, BoldSign sandbox,
  DocuSeal sandbox, OpenSign free API): watermarked or non-binding output is
  the opposite of what a lender files.
- The extension alone still cannot receive callbacks; whatever lane, a
  status-poll + "download signed copy" action is the v1 deliverable, and a
  mailto: intake remains the zero-dependency manual path already offered by
  the sweep's contact lines.

### Open items before build

1. Probe each candidate's CORS behavior from an MV3 service worker
   (nothing in the Researched pages guarantees extension-origin calls
   outside DocuSign's documented flow).
2. Confirm SignWell's free-tier terms (changes regionally/from pricing
   updates) and Documenso's cert requirement against an actual deploy.
3. Decide where completed + audit PDFs live: v1 = manual download + user
   files; a real vault is out of scope until the data-retention question is
   answered by the user.
