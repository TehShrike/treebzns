# Creating a lead

Single input client search for name/phone/email/address.

Client inputs for the basic details that get collected on the first call.

Inputs for everything a lead-status project needs.  No line items.

Lead creation bakes the contact name/phone/email onto the project (contact_name/contact_phone/contact_email), same as the address.  Geocoded latitude/longitude get written to the project (and client_address) too.

# Project list

More report oriented than the job scheduling screen.  Filter by client name/phone, like the create a lead screen.  Show dollar amounts, dates, age.

# Client screen

Edit all the usual details on the first tab.

Projects tab: maybe just a version of the project list screen, but scoped to just that customer.  Easy options/sub-tabs for open projects.

# Work crew interface

Maybe a part of a larger "job scheduling" interface.

Assign workers to crews (crew_regular is the default roster, not a hard rule).  Each crew is one timeline that projects get scheduled on per day (project_crew).  The employees actually working a scheduled job are per-job (project_crew_employee), so pulling someone onto another crew for a day is just assignment.

Crews have workers with different skills (employee_work_skill).  Different projects require different skills.

Line items define the work skills needed (project_line_item_work_skill).  A project's requirements are the union of its line items' skills.  Equipment is not modeled explicitly — some equipment use is implicit in work skills.

Projects that need to be estimated can be worked by an estimator.

# Job scheduling

Jobs need to be assigned to days and crews (project_crew rows).  A job on a crew's day is either ordered in the timeline (day_order) or pinned to a fixed time (start_time), never both.  Jobs require different skills.  Which line items get worked on a given visit is per-visit (project_crew_project_line_item).

Jobs have a rough ordering based on when they were confirmed by the customer, and whether or not they're an emergency.

View all upcoming jobs on a map, and assign them to days based on how close they are to each other, so that a crew can get as much work done without having to drive all across town.

This will likely grow into a general project triage screen where Andrew can review estimates or see open projects.

# Worker/foreman screen

Any crew member sees the list of projects assigned to their crew.  Needs to be easy to pull up the job address, and phone number to call/text.

Crews do not have a modeled leader.  A permission gates who can clock the whole crew in/out.  That person also needs to be able to clock individuals onto/off of the crew.

# Estimating

Estimator has a list of projects assigned, the same screen as the worker/foreman sees probably, except when they open the project that's in a lead state they see the lead details that were entered already, and client information, and they need to add line items and photos and notes.

Need to be able to dump in a bunch of photos, mark up the photos, dump in a bunch of text, and then pull it apart into line items.  And then assign dollar amounts to the line items.  Photos live at the project level (project_image, original + marked-up display image) and get linked to line items afterward (project_line_item_image join).

Line items have a short title plus work_details.  They can start from a line_item_template, which carries default work skills.

Line items can be marked optional (client_optional).  A separate add-on tier is deferred.

# Project screen

Need to show what the current status is, and allow progressing to the next status.  Should be dynamic, a list at the top of the ideal path (initial project document, followed by the "next" status, until you see the current status right-most).  A "change to next document" button that progresses to the next status.

Dropdown (?) to set the document type to a non-happy-path-next-step status.

Show the project location,  Show the client name, but most client details will be behind a link, the address and contact info should be baked into the document, not displayed from the client record.

See all photos marked up in a tableau.  Checkbox to change "visible to customer" (photo-level, project_image.visible_to_client).  Some way to link the photos to specific line items (project_line_item_image join).

Line items, title + work details + photos + price.  Some way to tag line items with work skills (project_line_item_work_skill).

Some way to see estimated hours and actual hours.

Some way to see/set relevant dates: when the project was created, when it transitioned to different project_documents (project_document_history).  If it can expire, how long until it expires — the expiration clock anchors on the project_document_history row for the transition into the expiring document (todo: make sure expiring is properly modeled as "hide from reports after this many days").

# Customer-facing project screen(s)

Probably the same url, but with very different displays depending on the status of the project.

## Proposal

If it's a proposal, they need to see the work that would be done, with notes/description.

Show a single price.  The client can decline optional line items, then approve the project as a whole.  Approving changes the project's status and makes it workable.

Tiered CTAs ("just the basics" / "extra mile") are deferred pending more product discussion.

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
- Work skill list (equipment is not modeled separately)
- Line item templates (title + default work skills)
