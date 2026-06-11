# Service Level Agreement (SLA) Policy

We strive to maintain a highly reliable service. Our Service Level Agreements govern our performance and customer rights in case of service issues.

## Uptime Commitment
We commit to providing a **99.9% Uptime SLA** for all paying customers, calculated monthly. 
- Uptime is measured as the percentage of minutes in a calendar month where our main API and Dashboard are fully responsive and available.
- Planned maintenance windows (announced at least 48 hours in advance) are excluded from downtime calculations.

## Incident Response Times
We categorize service incidents into four severity levels:
1. **Severity 0 (P0 - Outage)**: System is completely down or core features (e.g., email ingestion, database operations) are completely unusable. 
   - *Response SLA*: 15 minutes.
   - *Target Resolution*: Under 2 hours.
2. **Severity 1 (P1 - High)**: Core features are degraded, affecting a significant number of users or critical operations.
   - *Response SLA*: 1 hour.
3. **Severity 2 (P2 - Medium)**: Minor feature bugs, performance delays, or authentication glitches affecting isolated users.
   - *Response SLA*: 4 hours.
4. **Severity 3 (P3 - Low)**: General questions, minor visual bugs, or feature suggestions.
   - *Response SLA*: 12 hours.

## Credit Calculation Formula
If we fail to meet the 99.9% monthly uptime SLA, customers are entitled to Service Credits applied to their next monthly invoice:
- **Uptime < 99.9% but >= 99.0%**: 10% credit of the monthly subscription fee.
- **Uptime < 99.0% but >= 95.0%**: 25% credit of the monthly subscription fee.
- **Uptime < 95.0%**: 50% credit of the monthly subscription fee.
To claim a credit, the customer must submit a request to support within 14 days of the incident, citing the timestamp and duration of the downtime.

## Root Cause Analysis (RCA) SLA
For all **Severity 0 (P0)** incidents, our engineering team is required to deliver a comprehensive **Root Cause Analysis (RCA) report within 24 hours** of the resolution of the incident. The RCA report must outline the exact sequence of events, root cause, impact analysis, and corrective actions taken to prevent future occurrences.
