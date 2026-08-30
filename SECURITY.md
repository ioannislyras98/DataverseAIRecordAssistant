# Security policy

## Reporting a vulnerability

Do not disclose a suspected vulnerability, credential, tenant URL, or personal data in a public issue. Contact the maintainer privately through the repository owner's GitHub profile and include only the minimum information needed to reproduce the problem. You can expect an acknowledgement within five business days.

## Deployment guidance

- Store the Cloudflare API token only in the asynchronous plug-in step's Secure Configuration.
- Use a narrowly scoped Cloudflare API token and rotate it according to your organization's policy.
- Keep release-signing keys outside the repository and inject them only into controlled build environments.
- Apply least-privilege Dataverse roles to applications, analyses, input snapshots, raw responses, and error details.
- Do not trace tokens, authorization headers, complete provider responses, or personal data.
- Send only attributes that are necessary for the review purpose, and define retention rules for snapshots and analysis records.
- Enable Dataverse auditing for AI recommendations and subsequent human decisions.
- Review data residency, privacy, DLP, and responsible-AI requirements before using production data.

The recommendation produced by this project is advisory. It must never update the final application decision without an authorized human review.

