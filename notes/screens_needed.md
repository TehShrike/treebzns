# Creating a lead

Single input client search for name/phone/email/address.

Client inputs for the basic details that get collected on the first call.

Inputs for everything a lead-status project needs.  No line items.

# Project list

More report oriented than the job scheduling screen.  Filter by client name/phone, like the create a lead screen.  Show dollar amounts, dates, age.

# Client screen

Edit all the usual details on the first tab.

Projects tab: maybe just a version of the project list screen, but scoped to just that customer.  Easy options/sub-tabs for open projects.

# Work crew interface

Maybe a part of a larger "job scheduling" interface.

Assign workers to crews.  Each crew needs to be assigned a timeline of projects to work.

Crews have workers with different skills.  Different projects require different skills.

For work orders, the line items (maybe projects too?) define the work skills/equipment needed.

Projects that need to be estimated can be worked by an estimator.

# Job scheduling

Jobs need to be assigned to days and crews.  Jobs require different skills/equipment.

Jobs have a rough ordering based on when they were confirmed by the customer, and whether or not they're an emergency.

View all upcoming jobs on a map, and assign them to days based on how close they are to each other, so that a crew can get as much work done without having to drive all across town.

This will likely grow into a general project triage screen where Andrew can review estimates or see open projects.

# Worker/foreman screen

A crew foreman (or maybe just any crew member) sees the list of projects assigned to his crew.  Needs to be easy to pull up the job address, and phone number to call/text.

Needs to be able to clock the crew in/out.  Needs to be able to clock individuals onto/off of the crew.

# Estimating

Estimator has a list of projects assigned, the same screen as the worker/foreman sees probably, except when they open the project that's in a lead state they see the lead details that were entered already, and client information, and they need to add line items and photos and notes.

Need to be able to dump in a bunch of photos, mark up the photos, dump in a bunch of text, and then pull it apart into line items.  And then assign dollar amounts to the line items.

Probably need to be able to set optional/add-on on the line items too.

# Project screen

Need to show what the current status is, and allow progressing to the next status.  Should be dynamic, a list at the top of the ideal path (initial project document, followed by the "next" status, until you see the current status right-most).  A "change to next document" button that progresses to the next status.

Dropdown (?) to set the document type to a non-happy-path-next-step status.

Show the project location,  Show the client name, but most client details will be behind a link, the address and contact info should be baked into the document, not displayed from the client record.

See all photos marked up in a tableau.  Checkbox to change "visible to customer".  Some way to link the photos to specific line items.

Line items, descriptions + photos + price.  Some way to tag line items with skills/equipment.

Some way to see estimated hours and actual hours.

Some way to see/set relevant dates: when the project was created, when it transitioned to different project_documents (need to add this to the model).  If it can expire, how long until it expires (todo: make sure expiring is properly modeled as "hide from reports after this many days").

# Customer-facing project screen(s)

Probably the same url, but with very different displays depending on the status of the project.

## Proposal

If it's a proposal, they need to see the work that would be done, with notes/description.

Maybe the interface should let them approve line item chunks of work at a time?  Big "approve all" button that does everything?

Main CTA should probably be "approve" (short description of main work with dollar amount), "just the basics" (not including the "optional" line items), "Extra mile" that includes add-on line items.

Eventually: require down payment in order to approve.

## Work order

Show the work in the same way as it was shown on the proposal, but only show the approved line items that are going to get worked, and the dollar amount for what they approved.  All photos and details shown in thes ame way as they were on the proposal.

Also show a guess/estimate at when the job will be worked.  We'll probably need to look at the project/scheduling page to do the design work to figure out how to do a good job at coming up with that.

## Closed worker order

The dollar amount is locked in, it is now an invoice.  Probably default to showing line items with just text, like a traditional invoice optimized for adding up the subtotal/total, but make it easy/obvious to switch back to the display the other screens used where you can see all the photos and information.

Eventually: include a "schedule another job" section that uses the estimator and creates a new lead if they fill it out.

# Settings

- Create users
- User permissions
- Skill/equipment list
