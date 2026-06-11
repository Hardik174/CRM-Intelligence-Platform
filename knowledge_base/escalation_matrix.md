# Escalation Matrix & Ownership

This document defines standard escalation paths and responsible teams for critical alerts, security threats, and sensitive account scenarios.

## Escalation Channels and Contacts
1. **Security Team (`security-alerts@mycompany.com`)**
   - *Handles*: Ransomware threats, suspicious login alerts, server breaches, credentials leak, data exfiltration claims, and general cybersecurity incidents.
   - *SLA*: Immediate (24/7). P0 alerts page the on-call security engineer automatically.
2. **Legal Team (`legal-review@mycompany.com`)**
   - *Handles*: Cease and desist letters, trademark disputes, GDPR Article 20 portability requests, GDPR Article 17 deletion requests, litigation threats, and contractual disputes.
   - *SLA*: 24 hours.
3. **Customer Success Director (`cs-vip-churn@mycompany.com`)**
   - *Handles*: Churn threats from VIP customers (accounts valued >$50,000/year), complaints with zero replies for over 3 days, and customers threatening public negative reviews on G2 or Trustpilot.
   - *SLA*: 2 hours during business hours.
4. **Public Relations (PR) Team (`pr-crisis@mycompany.com`)**
   - *Handles*: Media inquiries (e.g., TechCrunch, journalists), public relations crises, and social media viral complaints.
   - *SLA*: 4 hours.

## Critical Routing Protocols
- **Ransomware / Extortion Threats**:
  - *Action*: Route immediately to the Security Team. Set urgency to `Critical` and flag `requires_human = True`.
  - *CRITICAL RULE*: **NEVER auto-reply to ransomware attackers**. Under no circumstances should an automated template or response be sent back to the extortionist, as it confirms the inbox viability and could complicate forensic actions.
- **GDPR Portability / Deletion Requests**:
  - *Action*: Route to the Legal Team. Flag `requires_human = True` and categorize as `Compliance`.
  - *CRITICAL RULE*: **ALWAYS generate an auto-acknowledgement** to the customer citing the 30-day statutory window for full compliance. Also create an internal compliance ticket assigned to the Legal Team.
- **Legal Cease & Desist Notices**:
  - *Action*: Route to the Legal Team. Set urgency to `Critical`, flag `requires_human = True`, and categorize as `Legal`.
  - *CRITICAL RULE*: **NEVER auto-reply with a generic support response**. The system must draft a professional holding message or wait for manual legal review.
- **Chatbot Misinformation & Refund Requests**:
  - *Action*: Retrieve the Refund Policy. If the customer cites chatbot error, draft an empathetic holding reply acknowledging the discrepancy, and escalate to the CS Director with a summary comparing what the chatbot said vs actual policy. Do not admit legal liability in the draft.
