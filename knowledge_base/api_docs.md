# API Documentation & Deprecation Timeline

This document outlines standard integration instructions, limits, and the transition timeline for our web services.

## API Rate Limits by Tier
Our API rate limits are enforced at the organization level using API keys:
- **Starter Plan**: 100 requests per minute (req/min).
- **Standard Plan**: 1,000 requests per minute (req/min).
- **Pro Plan**: 2,500 requests per minute (req/min).
- **Enterprise Plan**: Custom limits starting at 5,000 requests per minute (req/min), scaling up to 20,000 req/min depending on contract agreement.

## Header Requirements
All requests to the API must include the following headers:
- `Authorization`: `Bearer <API_KEY>`
- `X-Workspace-ID`: Unique ID identifying the target workspace (e.g. `ws_998231`). **Note: This header is mandatory for all v2 endpoints. Failing to provide this header will result in a 403 Forbidden error.**
- `Content-Type`: `application/json` (for POST/PUT requests).

## API v1 Sunset & Deprecation Timeline
We are transitioning all integrations from our legacy v1 API to our new v2 API structure:
- **Deprecation Date**: API v1 was officially deprecated on July 1, 2023.
- **Sunset Date**: All API v1 endpoints will be completely disabled on **December 31, 2023**. After this date, all v1 calls will return 410 Gone.
- **Migration Window**: Customers must migrate their production integrations to v2 before December 31, 2023, to avoid service interruptions.

## API v2 Breaking Changes
V2 introduces major performance and security enhancements:
1. **Mandatory Workspace Header**: The `X-Workspace-ID` header must be present on all requests (returns 403 if missing).
2. **Paginated Responses**: Listing endpoints (e.g., `/v2/events`, `/v2/contacts`) now return paginated envelopes (`data`, `cursor`, `has_more`) rather than flat lists.
3. **Webhook Signatures**: Webhook payloads now include an `X-Signature-SHA256` header to verify authenticity using a shared webhook secret.
