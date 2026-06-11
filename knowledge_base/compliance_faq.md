# Compliance & Security FAQ

We maintain a strict compliance posture to safeguard customer data, especially in regulated industries like healthcare and finance.

## HIPAA Compliance & Business Associate Agreements (BAA)
- **BAA Availability**: Yes, we sign Business Associate Agreements (BAAs) with customers on the **Pro and Enterprise tiers**. We do not sign BAAs for Starter or Standard customers.
- **HIPAA Controls**: When a BAA is executed, we enable specialized HIPAA compliance controls, including audit logging of all data access, automatic session timeouts, and dedicated encryption keys.
- **Data Encryption**: All Protected Health Information (PHI) is encrypted at rest using AES-256 and in transit using TLS 1.3.

## GDPR Compliance and Data Portability
- **GDPR DPA**: We offer a standard Data Processing Addendum (DPA) incorporating Standard Contractual Clauses (SCCs) to meet GDPR requirements.
- **Right to Portability (Article 20)**: Upon receiving a formal GDPR data portability request, we are legally obligated to provide a full, structured export of the user's personal data within the statutory **30-day window**. 
- **Right to Be Forgotten (Article 17)**: Users can request deletion of their accounts. Deletions are processed within 14 business days, erasing all logs, contact profiles, and email threads associated with the sender.

## SOC 2 Type II Certification
- **Certification Status**: Our platform is **SOC 2 Type II certified**. Our report is audited annually by an independent third party.
- **Accessing the Report**: Customers on Standard, Pro, or Enterprise tiers can request our latest SOC 2 Type II report and penetration test summary. Requests must go through our security team, and the customer must have a signed NDA on file.

## Data Residency Options
- **Default Hosting**: By default, all customer databases and search embeddings are hosted in AWS US-East-1 (North Virginia).
- **EU Data Residency**: For Enterprise customers, we offer regional hosting options in AWS eu-central-1 (Frankfurt) to comply with European data localization laws.
