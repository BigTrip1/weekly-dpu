# How this review was built

This note records the decisions behind the app. The operating procedures are in the other files in `DOC`.

## Starting point

The source was a weekly faults extract, a methodology note, and a picture of an Excel dashboard titled Build Quality | Executive DPU Review. The app had to run locally, accept a new workbook each week, and avoid counting the same fault twice.

The stack is a React page in `frontend`, an Express API in `backend`, and MongoDB on `127.0.0.1:27017`, database `weekly_dpu`. Docker is described in `docker-compose.yml` for a PC that does not already have MongoDB. This PC already did, so Compose is not started while port 27017 is taken. `npm install` failed on npm 11, so the dependencies were installed with Bun. The API is compiled with `tsc` and run with Node, because running TypeScript directly could not load the Excel library.

The page and the API were first placed in `client` and `server`, then renamed to `frontend` and `backend`.

## What is counted

The reporting date is Failed Date, column L. The month is that date’s calendar month. The week starts on Monday. A week that crosses a month is offered in both month filters, and each month counts only its own days.

Fix text and fix date do not assign a department and do not choose the period. They mark the drill-down row Open or Fixed, and a later upload can refresh them without a second count.

Faults per build uses distinct build numbers in the extract. It is not a count of every machine that passed through the factory.

## Duplicates

An exact copy of all 17 columns is skipped and written to the duplicate audit. The same event with only closure fields changed updates the stored row. The same event with some other field changed is kept twice and flagged for operational review. Re-uploading one unchanged file does not change the dashboard totals.

## Panels and wording

Six panels are shown: Shot & Paint, Manufacturing Facilities, Parts / POF, Production, Cab Systems, and Supplier Quality. Known Failed To values were seeded onto those panels. Man Eng and Design are hidden. The first extract left 33 further Failed To values unmapped. They were later mapped by the naming pattern of the seeded ones (zones, sub assemblies, manufacturing areas), which is listed in `DOC/03-mapping-and-rules-sop.md`. The unmapped and hidden notice above the panels was removed once nothing was left unmapped. A blank “Only when defect contains” assigns every defect. A word in that box, such as paint on Finishing Ldl, applies only when the defect type contains it.

Comment rules group different sentences for the same fault. They were extended when the dashboard showed splits that were only spelling or phrasing: air con cooling, leaks, and switch panels; boom unavailable at POF; paint plugs; fuel cooler brackets; top door lockback fouling; general sealant misses; fusebox covers; heater tap nuts; programming faults; and radio blanks. Cab-mount sealant, boom sealant, fuse clips, “top door not closing”, and not-to-model lines that name different parts were left as their own faults.

## Dashboard

A selected week is compared with the previous calendar week. All weeks compares the selected month with the previous calendar month. The sample extract is mostly October 2026, with only a small number of September faults, so an October monthly view shows large increases.

Clicking a count opens the source rows. The drill-down includes the original comment and the person in `failed_by`, labelled Recorded by. Departments has its own drill-down for each Failed To value.

## Visual overhaul

The first version used hand-written styles on a paper background. It was rebuilt as a JCB themed interface:

- Tailwind CSS v4 and shadcn/ui replace the hand-written stylesheet. The tokens live in `frontend/src/styles.css`.
- Dark mode is the landing theme. Light mode keeps the JCB yellow header and the paper page. The switch is in the header and the choice is stored in the browser.
- The six ranked panels stay, with trend badges that carry an arrow as well as a colour.
- A chart row sits above the panels: faults by department, share of mapped faults, and the last eight weeks by department. The weekly lines come from `GET /api/dashboard/trend`, which counts by Failed Date week like the rest of the review.
- The headline figures show their change against the comparison period. The dashboard response gained `previousTotals` for that.
- The fault drill-down is a side sheet with a search box and a sticky header. Upload takes a dropped file and reports the result as tiles and a toast. Departments has search and status filters. Rules are edited in a side sheet with term chips and a confirmation before delete. Audit uses tabs with counts.
- Chart marks open records: a bar, slice or legend name opens every fault on that panel for the period, and a weekly trend point opens that department for that week. `GET /api/faults` accepts a missing cleansed fault, and a missing month when a week date is given.
- Panel rows dropped the share bar and gained a previous period quantity column (Prev week QTY or Prev month QTY). Count is labelled QTY.
- Counting, cleansing, comparison, and upload behaviour are unchanged.
