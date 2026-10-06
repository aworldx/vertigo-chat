# Google map adapter design

6 October 2026. Concrete native Google Maps states for the connected provider,
before moving the map hint to the top to avoid covering the Google zoom controls.
The v1/v2 OSM tiles were illustrative; retained unchanged. This reference covers
Google's actual map, same game frame, two target widths (1440×900 and 768×1024),
normal and expanded, top/viewport/bottom. Phones remain text-only.
Selected point 20N 0E (Mali), zoom 2; no target coordinates exposed. Native Google
logo/copyright/controls remain visible. Render uses the real SDK without storing
keys or downloaded tiles. Same chat fixture/auth, fonts and theme as design-v3.
