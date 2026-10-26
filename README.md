# Relay

**Every call becomes a next step.** Relay is an AI receptionist for home service businesses. It answers calls when a crew is on a job, gathers the details, handles routine booking requests, and escalates urgent work to a person.

This repository contains a responsive, interactive product prototype. Open `index.html` in a browser to explore the owner dashboard, inspect sample conversations, and run the simulated urgent-call flow. The dashboard uses sample data; it is not connected to a phone number, calendar, payment system, or AI voice service.

## Customer and problem

Start with independent plumbing and HVAC companies with 3–30 field technicians. Calls arrive while owners and technicians are driving, on a job, or after hours. A missed emergency call can become a lost job and a lost customer. Relay should prove that it captures incremental booked work without forcing the owner to change how the crew operates.

## First sellable version

1. Forward unanswered calls to a Relay number; support after-hours coverage and an owner-defined schedule.
2. Collect caller name, callback number, service address, issue, and urgency with a natural voice conversation.
3. Send a concise SMS to the owner or dispatcher; transfer urgent calls to the on-call person.
4. Offer appointment windows from the business's availability and confirm by text.
5. Show call recordings/transcripts, consent controls, outcomes, and a simple recovered-jobs report.

Start with plumbing only in one service area. Keep a human escalation path for emergencies, uncertain answers, pricing questions, and callers who ask for a person. Do not let the assistant promise a diagnosis or quote before the business has configured its rules.

## Pricing hypothesis

- **Starter — $199/month:** one location, missed-call and after-hours coverage, call summaries, and a monthly call allowance.
- **Growth — $399/month:** booking workflows, calendar connection, multiple team members, and higher usage.
- **Multi-location — from $999/month:** shared reporting, location-specific rules, and priority support.

Validate willingness to pay with paid pilots. Track gross margin per answered minute, number porting and telephony costs, support load, bookings per account, and churn before locking in tiers. A reasonable initial proof point is 10 local businesses paying for a 30-day pilot and renewing because tracked recovered work exceeds the monthly fee.

## Path to a durable business

Win one trade and geography with reliable call handling and measurable booked jobs. Expand into adjacent home-service trades, then add the workflow layer owners already use: dispatch, estimates, payments, and customer follow-up. The long-term opportunity is becoming the voice and lead-conversion layer for service SMBs, with integrations and outcome data creating retention. That is a high-upside thesis, not a promise of billionaire income; execution, customer trust, distribution, and unit economics decide whether it becomes a business.

## Prototype files

- `index.html` — dashboard structure and sample customer interactions.
- `styles.css` — responsive visual system.
- `app.js` — navigation, conversation drawer, notifications, and simulated AI call.
