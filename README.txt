# SAEC Bus Map

Open `index.html` directly in a browser.

## What is included
- Manual 3-dot navigation with separate views
- Dashboard, tracking, buses, routes, schedules, traffic, search, settings
- Dark/light mode saved in localStorage
- India clock (Asia/Kolkata)
- Timetable-based animated bus position
- Morning route movement from the supplied morning schedules
- Demo evening return mode: college departure at 4:00 PM, first stops at 4:10 PM and 4:25 PM, then 5–10 minute gaps toward 6:00 PM where route length allows; not an official evening timetable
- College building-style destination node
- Demo time control
- Monday/Friday peak traffic simulation, separate from official timetable
- Responsive desktop/mobile layout

## Important data note
The two supplied PDFs contain morning stagewise timings. They also contain some source inconsistencies (for example, some stop times are not strictly increasing). The app preserves the source order/times rather than silently correcting them. Such a segment is labelled as a source timing anomaly in the tracker.

No GPS or live traffic API is used.
