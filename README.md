# zad-hijri

The Hijri date for the **Zad al-Muntazirin** app, as published by **Taqwim al-Sayegh** for each city.

- `cities.json`: the 47 cities of the app that are in the Sayegh calendar (`sid` = Sayegh city id).
- `hijri.json`: the start (Gregorian date) of each Hijri month, per city:

```json
{"v":1, "checked":"…", "read":"…",
 "cities":{"107":{"id":"najaf","en":"Najaf","lat":32.03,"lng":44.35,"at":"…","m":{"1448-6":"2026-11-11","1448-7":"2026-12-11"}}},
 "diff":{"1448-7":{"2026-12-10":["Beirut"],"2026-12-11":["Najaf","…"]}}}
```

`m` keys are `year-month` (month 1 = Muharram). `diff` lists the months whose start differed between cities.

## How it runs

`.github/workflows/update.yml` runs every evening at 19:00 UTC (9 pm Beirut). The site is read only from the
28th of a Hijri month to the 2nd of the next one (today's and tomorrow's page per city). On other days it reads
nothing. Use **Actions → Hijri date → Run workflow** with **force** to read every city now.

The app reads `https://raw.githubusercontent.com/watcherofreturn/zad-hijri/main/hijri.json`.
