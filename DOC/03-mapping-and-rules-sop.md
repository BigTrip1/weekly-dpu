# Mapping and rules

Two decisions are separate.

The **cleansed fault** is the name on the panel. It comes from the comment, using the first matching rule. The original comment is kept and shown in the drill-down.

The **executive department** decides which panel receives the fault. It comes from the Failed To value, not from the words in the comment.

## Map a Failed To value

Open Departments. Each row is one Failed To value and how many stored faults use it.

1. Click the fault count to read the individual records.
2. Choose an executive department, or Hidden, or Unmapped.
3. Leave **Only when defect contains** blank to assign every fault with that Failed To.
4. Type a word in that box only when the department should apply to matching defect types. Finishing Ldl is mapped to Shot & Paint only when the defect type contains `paint`. Every other Finishing Ldl fault goes to Production.
5. Press Save. The page says whether every defect was assigned, and the open fault table reloads.

Man Eng, Design, and Consequential Fault are Hidden. They stay in the database and out of the six panels.

### Starting mappings

Every Failed To value in the current extract has a department. The extra ones follow the names of values that were already mapped:

| Department | Failed To values |
| --- | --- |
| Production | Zone 1, Zone 2, Zone 7, Zone 7 Rectification, the Engine, Axle, Cooling Pack, Leg, Ram, Scr and Fuel Tank sub assemblies, Power Systems, Transmissions, Attachments, Assembly, Assembly Track, Static Build, Off Track, Cycle Test, Rectification, Heavy Rectification, Standard Work, Customer Focus Centre, and Finishing Ldl without a paint defect |
| Manufacturing Facilities | Manufacturing, Boom Manufacturing, Inner Boom Manufacturing, Outer Boom Manufacturing, India Fab, Hbu, Maintenance |
| Parts / POF | Boom Kitting |
| Hidden | Consequential Fault |

Maintenance, Customer Focus Centre, Standard Work, and Hbu are the least certain. Change any of them on Departments if the plant sees them differently. A database made before these mappings existed gets them once, when the API next starts, and is then left alone, so a mapping you clear stays cleared.

A Failed To value that arrives in a later upload and has no mapping stays unmapped. It counts in the headline totals and not on a panel until it is mapped on Departments.

Saving recalculates the reporting fields on every stored fault. It does not rewrite the original comments.

## Rules

Open Rules. Rules run in priority order. The first match sets the cleansed name.

A rule can require every term in one list, any term in another, a machine area, a defect type, or a work centre, and it can exclude comments that contain a term. Short terms of three characters or fewer match whole words. Longer terms match anywhere in the comment.

Examples already seeded:

- Air con not cold enough, including “above 9.9” and “not going below 9.9”.
- Air con inoperative, air con leak, and air con switch panel inoperative, kept apart from each other.
- No boom available at POF, including the spelling `avaiable`.
- Paint plugs not fitted. Wrong hole size stays in its own wording.
- Fuel cooler bracket shortage, including `brkt`. Damaged fins stay separate.
- Top door fouls lockback. “Top door not closing” stays separate. The latch rule still owns “bounces out of split latch”.
- Sealant missed for the general near-side and off-side lines. Cab-mount sealant and boom sealant stay separate.
- Fusebox cover missing. Clips and cage nuts stay separate.
- Heater tap nut loose, including the cross-threaded lines and the `tape` typo.
- Programming fault, both spellings.
- Radio blank missing or required.

Changing a rule recalculates every stored fault. Add a rule when the same fault is split across the top 10 only because the wording differs. Leave two rows apart when the part or the failure is different.
