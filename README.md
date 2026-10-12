# Vish- Centrim Visitor Management

CENTRIM LIFE

────────────────────────────────────────

UK GDPR Compliance Requirements

Visitor Management Module

With Current State Assessment





Document Title

UK GDPR Compliance Requirements – Visitor Management Module

Product

Centrim Life – Visitor Check-In / Check-Out System

Version

2.0 (Revised with Current State Assessment)

Date

February 2026

Prepared For

Product, Engineering, QA, Design Teams

Author

Centrim Life Technical Team

Status

Draft – For Review

Classification

Internal / Confidential








1. Objective

Enable the Centrim Life Visitor Management system to meet UK GDPR requirements when deployed in UK care homes, by adding required privacy notices, lawful basis acknowledgements, data-handling processes, and system enhancements.

This document has been updated to reflect the current implementation state of each requirement, identifying gaps that must be addressed before UK market launch.




2. Product Overview

Centrim Life enables visitors to check in and check out of care homes digitally. When entering the UK market, the product must comply with UK GDPR. This document describes all new and existing requirements, with a clear assessment of current state versus target state.




3. Data Inventory

The following table lists all personal data fields currently collected by the Visitor Management module. All fields are existing within the current system.




Data Field

Type

Required

Purpose

Status

First Name

Text

Mandatory

Visitor identification

Existing

Surname

Text

Mandatory

Visitor identification

Not Existing

Email

Email

Mandatory

Contact tracing

Not Existing

Mobile Number

Phone

Mandatory

Contact tracing

Existing

Check-in Timestamp

DateTime

Auto

Audit trail

Existing

Check-out Timestamp

DateTime

Auto

Audit trail

Existing

Name (legacy)

Text

Optional

Visitor identification

Existing

Phone Number

Phone

Optional

Contact tracing

Existing

Address

Text

Optional

Contact tracing

Existing

Health Declaration

Boolean/Text

Conditional

Infection control

Existing

Additional Visitor Name

Text

Optional

Companion tracking

Existing

Companion Details

Text

Optional

Companion tracking

Existing

Influenza Vaccine Status

Boolean

Optional

Health screening

Existing

Influenza Vaccine Evidence

File Upload

Conditional

Compliance verification

Existing

COVID Vaccine Status

Boolean

Optional

Health screening

Existing

COVID Vaccine Evidence

File Upload

Conditional

Compliance verification

Existing

COVID Vaccine Dates

Date

Conditional

Compliance verification

Existing




4. Business Problem / Opportunity

Care homes in the UK must comply with GDPR when handling visitor data. Without GDPR compliance, care homes cannot legally use Centrim Life, the platform risks fines, refusal, or legal issues, and data handling may be considered unlawful. By adding GDPR-required features, Centrim Life becomes compliant and ready for UK rollout.




5. Product Goals

Primary Goals

Make visitor data collection lawful under UK GDPR.

Provide transparency to visitors about how their data is used.

Support care homes’ obligations for safety and security.

Ensure the platform can handle GDPR rights requests (access, rectification, erasure, portability).

Secondary Goals

Increase trust and adoption among UK care homes.

Provide competitive differentiation versus other visitor management systems.




6. Gap Analysis – Current State vs. UK GDPR Requirements

The table below maps each UK GDPR requirement to the relevant regulation article and assesses whether the current system meets the requirement.




GDPR Requirement

Regulation

Current Status

Notes

Privacy Notice before data submission

UK GDPR Art. 13

Implemented

Displays on check-in screen

Mandatory acknowledgement checkbox

UK GDPR Art. 7

Implemented

Required before form submission

Link to full Privacy Policy

UK GDPR Art. 13(2)

Not Implemented

No link currently present – action required

Configurable data retention settings

UK GDPR Art. 5(1)(e)

Not Implemented

No admin controls exist – action required

Export visitor data (SAR)

UK GDPR Art. 20

Implemented

Export functionality available

Edit visitor data (Rectification)

UK GDPR Art. 16

Partial

Edit functionality available

Delete visitor data (Erasure)

UK GDPR Art. 17

Not Confirmed

Delete endpoint status unknown – needs verification

Automated data deletion

UK GDPR Art. 5(1)(e)

Not Implemented

No cron job or expiry mechanism exists

Data access audit logging

UK GDPR Art. 30

Not Confirmed

Logging status unknown – needs verification

Encryption (transit & rest)

UK GDPR Art. 32

Partial

HTTPS likely in place; at-rest encryption needs verification

Role-based access control

UK GDPR Art. 32

Partial

Exists but scope of permissions needs review

Data Processing Agreement

UK GDPR Art. 28

Not Implemented

DPA documentation not yet created




Compliance Summary

Category

Count

Total Requirements Assessed

12

Implemented

5

Not Implemented

4

Not Confirmed (Needs Verification)

3

Partial

2 (overlap)




7. User Stories

Each user story has been assessed against the current system state. Stories marked as “Not Implemented” or “Not Confirmed” represent gaps that must be resolved.




ID

Role

User Story

Status

VS-001

Visitor

As a visitor, I want to see a clear privacy notice explaining how my data will be used before I submit any personal information during check-in.

Implemented

VS-002

Visitor

As a visitor, I want to acknowledge the privacy notice via a mandatory checkbox so that my consent is explicitly recorded.

Implemented

VS-003

Visitor

As a visitor, I want access to the full privacy policy via a clearly visible link so I can review the details at any time.

Not Implemented

VS-004

Visitor

As a visitor, I want confidence that my personal data is stored securely and processed in accordance with UK GDPR.

Partial

AS-001

Admin

As an administrator, I want configurable data retention settings so visitor records are automatically deleted after a defined period.

Not Implemented

AS-002

Admin

As an administrator, I need the ability to export visitor records in a portable format to fulfil Subject Access Requests.

Implemented

AS-003

Admin

As an administrator, I need the ability to delete individual visitor records to comply with Right to Erasure requests.

Not Confirmed

AS-004

Admin

As an administrator, I want an audit log of data access and modifications for accountability and compliance reporting.

Not Confirmed

AS-005

Admin

As an administrator, I want to respond to GDPR data subject requests (access, rectification, erasure) within statutory timeframes.

Partial

SY-001

System

The system must store data securely and delete data automatically after retention expiry.

Not Implemented

SY-002

System

The system must track access to visitor records via audit logs.

Not Confirmed




8. Functional Requirements

8.1 Visitor Check-In Screen

FR-01: Display a Short Privacy Notice — IMPLEMENTED

A short privacy notice must appear before the visitor enters their details. It must be placed as a “Privacy Information” card or modal above or below the form, with readable and minimally intrusive text.

FR-02: Add Acknowledgement Checkbox (Mandatory) — IMPLEMENTED

A required checkbox labelled: “I acknowledge that I have read and understood the Privacy Notice and how my information will be used.” The visitor cannot submit the check-in until this is checked. This is acknowledgment, not consent.

FR-03: Include Link to Full Privacy Policy — NOT IMPLEMENTED

A link labelled “View Full Privacy Notice” must open a PDF or webpage with full policy details in a separate screen or popup. Currently no link exists in the system. This is a compliance gap that must be addressed.

8.2 Data Retention

FR-04: Configurable Data Retention — NOT IMPLEMENTED

The admin panel must allow care homes to set retention periods of 30, 60, 90, or 180 days with a default of 60 days. No retention settings currently exist in the admin dashboard.

FR-05: Automatic Data Deletion — NOT IMPLEMENTED

The system must automatically delete visitor data after the retention period expires. No cron job or expiry mechanism currently exists. A new database field for retention expiry date is required along with a scheduled task.

8.3 GDPR Rights Management

FR-06: Data Export — IMPLEMENTED

Admin users can export a single visitor’s data in CSV or PDF format. This functionality currently exists.

FR-07: Data Editing — IMPLEMENTED

Admin users can correct visitor information when requested. This functionality currently exists.

FR-08: Data Deletion — NOT CONFIRMED

Admin users must be able to delete a visitor record permanently. The existence of a delete API endpoint has not been confirmed and requires verification. If it does not exist, it must be implemented as a priority.

8.4 Security

FR-09: Encryption — PARTIAL

Data in transit must use HTTPS/TLS. Data at rest must use platform encryption (AES-256 recommended). HTTPS is likely in place but formal verification of both transit and at-rest encryption is required.

FR-10: Access Control — PARTIAL

Staff-only accounts with role-based permissions must be enforced. Two-factor authentication is recommended. Role-based access exists but the scope of permissions needs review.

FR-11: Audit Logs — NOT CONFIRMED

The system must log who accessed visitor data, when, and what actions were taken. Current logging status is unknown and requires verification. If not present, this must be implemented before UK go-live.




9. Non-Functional Requirements

Performance: Check-in page must load in under 2 seconds.

Usability: Privacy message must be readable on tablets and kiosks.

Compliance: Must meet UK GDPR Articles 5, 6, 13, and 32.

Reliability: 99.5% uptime target.




10. User Flow – Visitor Check-In

Visitor approaches kiosk or device.

System displays welcome screen with short privacy notice and acknowledgement checkbox.

Visitor enters details (name, email, mobile, and any additional fields as configured).

Visitor checks the acknowledgement box.

Visitor clicks Check In.

System stores visitor record securely with retention expiry date.

Visitor checks out later through the same interface.




11. Privacy Notice Content (Short Version)

The following text appears on the check-in screen:




Why we collect your information:

To manage visitor access to the care home, ensure safety, maintain security records, and respond to emergencies.

What we collect:

Your name, contact details, check-in/out times, health declarations, companion details, and vaccination status where applicable.

Lawful basis:

Legitimate Interests / Legal Obligation.

How your data is used:

Only for visitor management and safety. Not for marketing.

How long we keep it:

[Care home selected period – default 60 days].

Your rights:

You may request access, correction, or deletion. Contact the care home for more details.

Data Controller:

The care home you are visiting. Centrim Life processes data on their behalf under strict GDPR rules.





12. Full Privacy Notice (For Link) – NOT YET CREATED

Engineering must display a link to a webpage or PDF containing: data controller details, all GDPR Article 13 information, data processor (Centrim Life) details, subprocessors (hosting provider), retention period, contact information, and user rights including how to contact the DPO or admin.

Centrim Life must prepare this document separately. This is currently a compliance gap.




13. Acceptance Criteria

Each acceptance criterion has been assessed against the current system state with a QA test result.




ID

Acceptance Criteria

Status

QA Result

AC-01

Privacy notice appears for every visitor before data entry.

Implemented

Pass

AC-02

Acknowledgement checkbox must be checked; otherwise submission is blocked.

Implemented

Pass

AC-03

Full privacy policy link is visible and functional.

Not Implemented

Fail

AC-04

Retention settings are functional and configurable by admins.

Not Implemented

Fail

AC-05

Visitor data is automatically deleted after retention period expires.

Not Implemented

Fail

AC-06

Admins can export visitor records.

Implemented

Pass

AC-07

Admins can edit visitor records.

Implemented

Pass

AC-08

Admins can delete visitor records permanently.

Not Confirmed

Blocked

AC-09

Data is securely encrypted in transit and at rest.

Partial

Blocked

AC-10

Audit logs track all data access and modifications.

Not Confirmed

Blocked




14. Technical Implementation Steps – With Current State

The following table shows each implementation task with its current status. Items marked as “Not Implemented” or “Not Confirmed” represent the remaining work required for UK GDPR compliance.




Phase

Task

Status

Notes

Phase 1

UI + Form Changes

Add Privacy Notice block to check-in page

Implemented

Live on check-in screen

Add acknowledgement checkbox (required field)

Implemented

Mandatory before submission

Add link to full privacy policy

Not Implemented

No link or URL configured yet

Update UI layout for kiosk screens

Partial

Needs review for compliance elements

Phase 2

Backend Changes

Tag database records with retention expiry date

Not Implemented

New DB field required

Implement automated cron job for expired records

Not Implemented

Scheduled task required

API endpoint: Export visitor data

Implemented

Endpoint exists and functional

API endpoint: Edit visitor data

Implemented

Endpoint exists and functional

API endpoint: Delete visitor data

Not Confirmed

Needs verification – may not exist

Add logging for data access events

Not Confirmed

Needs verification

Phase 3

Visitor listing page 

Add data retention settings dropdown

Not Implemented

New feature required

Add visitor search and management tools

Implemented

Search tool exists

Add export button to admin panel

Implemented

Export button exists

Add delete button to admin panel

Not Implemented

New UI element required

Phase 4

Security + Audit

Verify encryption implementation (TLS + AES-256)

Partial

Needs formal audit

Add audit logging system

Not Confirmed

Needs verification / implementation

Enforce role-based access permissions

Partial

Exists but needs scope review

Phase 5

Documentation

Create full Privacy Policy PDF

Not Confirmed

Legal/compliance team action

Create Data Processing Agreement (DPA)

Not Confirmed

Legal/compliance team action

Add GDPR help documentation for care homes

Not Confirmed

Support/content team action




15. Risks and Mitigation

Risk

Mitigation

Severity

Visitors ignore privacy notice

Mandatory checkbox prevents submission without acknowledgement

Low

Care homes misconfigure retention

Default retention period set to 60 days

Low

Staff mishandle personal data

Role-based access control + staff training programme

Medium

UK GDPR regulations updated

Annual compliance review cycle scheduled

Low

Delete functionality does not exist

Verify and implement delete API endpoint as priority

High

Audit logging not in place

Confirm current state; implement if missing before go-live

High

Privacy policy link missing

Create and host policy document; configure URL in system

High




16. Deliverables

Already Delivered

Privacy notice displayed on visitor check-in screen.

Mandatory acknowledgement checkbox.

Visitor data export functionality.

Visitor data edit functionality.

Visitor search tool in admin panel.

Confirmation Required 

Audit logging system for data access events. _( Need Confirmation )

Security verification (encryption audit + RBAC review).

Privacy Policy PDF document. -( Confirm Whether current can be used )

Data Processing Agreement (DPA).. -( Confirm Whether current can be used )




Outstanding Deliverables

Improve the Form -  introducing additional required fields and eliminating hardcoded configurations.

Link to full privacy policy (URL + hosted document).

Configurable data retention settings in the admin dashboard.

Automated data deletion (cron job + database expiry field).

Delete visitor record functionality (API endpoint + admin UI button).





17. Recommended Next Steps

Verify: Confirm whether the delete API endpoint and audit logging currently exist in the system.

Prioritise: Address the three high-severity gaps – privacy policy link, delete functionality, and audit logging.

Design: Create the data retention settings UI and backend cron job for automated deletion.

Legal: Commission the full Privacy Policy PDF and Data Processing Agreement.

Security Audit: Conduct formal verification of encryption and role-based permissions.

QA: Execute full regression testing once all gaps are addressed.




— End of Document —

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/671c5f63-eb05-4ae2-a2e8-8fa245afd5f1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
