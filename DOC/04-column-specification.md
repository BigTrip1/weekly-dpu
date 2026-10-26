# Workbook columns

Header row 1. The importer matches these names after removing spaces, underscores, and capital letters. Column O may be headed `faxed_date`. That spelling is the fix date.

| Column | Header | Used for |
| --- | --- | --- |
| A | order_number | Identity of the row. Not the reporting date. |
| B | build_number | Distinct builds for faults per build. |
| C | serial_number | Shown in the drill-down. Part of the event identity. |
| D | model | Shown in the drill-down. Must match for a closure-only update. |
| E | work_center | Shown in the drill-down. Part of the event identity. |
| F | check_text | Used to recover a label when the comment is blank, unless the check is a generic “additional findings”. |
| G | comments | Cleansed into the fault name. Part of the event identity. |
| H | failed_to | Chooses the executive department. Part of the event identity. |
| I | machine_area | Rule matching and the recovered label. Part of the event identity. |
| J | defect_type | Rule matching, the recovered label, and conditional department maps such as Finishing Ldl paint. |
| K | failed_by | The person who recorded the fault. Shown as Recorded by in the dashboard drill-down. Must match for a closure-only update. Not used to rank anyone. |
| L | failed_date | The only date that sets the month and the week. An unreadable value excludes the row. |
| M | failed_time | Shown beside the failed date. Part of the event identity. |
| N | fixed_by | Stored. A change here, with no other change, refreshes the closure instead of inserting a second fault. |
| O | faxed_date | Fix date. Blank or `2020-01-01` displays as Open. Any other date displays as Fixed. It does not move the fault between months or panels. |
| P | fixed_time | Stored with the closure. Same refresh rule as the fix date. |
| Q | fix | The closure note. Ignored by cleansing and by department assignment. Included in the exact-row fingerprint, so a changed fix note is not treated as an exact duplicate. |

A row is excluded when Failed Date cannot be read, or when comment, Failed To, machine area, and defect type are all empty.

The exact-row fingerprint is a hash of all 17 fields. The event fingerprint omits model, failed by, fixed by, fix date, fix time, and fix. That is what allows a later file to close a fault without counting it again.
