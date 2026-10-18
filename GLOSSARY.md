# Job Assistance

A personal job-application tracker that gathers company research, contacts and AI-written outreach for each job the user is pursuing.

## Language

### Jobs

**Job**:
One position the user is tracking an application for. Everything else the tracker holds belongs to a Job.

**Job Detail**:
A view of one Job together with its satellites: all of its Contacts, its newest Company Research and its newest Generated Content. It is not stored on its own, and exists exactly when its Job does.
_Avoid_: JobDetail entity, job record

**Job Detail window**:
The screen that shows and edits one Job Detail, opened from a row in the tracker.
_Avoid_: detail modal

### Satellites

**Satellite**:
Anything gathered for a Job after it is added: its Contacts, Company Research and Generated Content. Any satellite may be missing; a new Job has none.
_Avoid_: child, by-job data

**Contact**:
A person at a Job's company who could be reached about it, found by a contact lookup.

**Company Research**:
A summary of what is known about a Job's company, from one research run. A Job may have several; only the newest belongs to its Job Detail.

**Generated Content**:
The outreach message, follow-up message and tailored resume written for a Job in one generation run, with its match score and Missing Keywords. A Job may have several; only the newest belongs to its Job Detail.

**Missing Keyword**:
A keyword from the job description that a tailored resume lacks, which the user can choose to include. It belongs to one Generated Content, not directly to the Job.
