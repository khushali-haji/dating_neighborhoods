# Swipe Right on NYC

A dating-app for NYC neighborhoods. Fill in a profile, swipe on 42 neighborhoods, and get matched. Every stat is real NYC data; the jokes are not.

## Run it

```
cp .env.example .env     # then paste your Gemini key into .env (git-ignored)
python3 server.py        # http://localhost:8000
```

The swiping works by just opening `index.html`, but the **chat with your match** needs `server.py`: it serves the app and forwards chat to Gemini so the key never reaches the browser. Without a key, the chat shows an error and everything else still works.

## Refresh the data

```
python3 fetch_data.py
```

Python 3, standard library only. Writes `data/neighborhoods.json` and `data/neighborhoods.js` (the app reads the `.js`, so it works from `file://`). Takes about 15 seconds.

## Files

| File | What it is |
|---|---|
| `index.html`, `style.css` | Shell and styles |
| `server.py` | Local server + Gemini chat proxy (reads `.env`) |
| `chat.js` | Builds the neighborhood's persona prompt from real stats and calls `/api/chat` |
| `app.js` | Screens: onboarding, swipe deck, match / reject / "are you sure" sheets, results |
| `logic.js` | Pure logic: scoring, reasons, deck building, copy tokens (no DOM) |
| `art.js` | Illustrated fallback "photos" as inline SVG |
| `data/photos.js`, `photos/` | Real Wikimedia Commons photos (10 neighborhoods) with credit and license. Add more here. |
| `data/profiles.js` | Hand-edited profile copy for each neighborhood (**edit this**) |
| `data/neighborhoods.*` | Generated data, do not edit by hand |
| `fetch_data.py` | Data pipeline |
| `PRD.md` | Product spec |

## Data sources

Neighborhoods are the 42 UHF areas from the NYC Health Dept ZIP table.

| Factor | Source |
|---|---|
| Air | NYC Community Air Survey `c3uy-2p5r`, PM2.5 annual mean, UHF42 |
| Rats | Rodent Inspection `p937-wjvj`, share of initial inspections with active rat signs, last 12 months |
| Food | DOHMH Restaurant Inspections `43nn-pn8j`, distinct restaurants per sq km |
| Safety | NYPD Complaint Data (YTD) `5uac-w243`, felonies per 1,000 residents, placed by lat/long |
| Green | Parks Properties `enfh-gkve`, acres per 1,000 residents (multi-ZIP parks split evenly) |
| Density | MODZCTA `pri4-ifjk`, population over polygon area |
| Transit and commute | MTA subway GTFS, estimated subway time (see `meta.commute_method`) |
| Rent | Zillow ZORI by ZIP (all homes + multifamily, **not 1BR**), median across the area's ZIPs |

## Known gaps and open items

- **Commute** is null for areas with no subway route to the work area (Staten Island, parts of Queens). Ferries, buses and LIRR are not modeled.
- **Rent** is Zillow's index, not an official source and not 1BR.
- **Crime** is Jan to Jun 2026 year-to-date; business districts look worse per resident.
- **Rat counts** come from inspections that are partly complaint-driven; some areas have small samples (`rat_initial_inspections`).
- **Quirky stories** in `data/profiles.js` are from general knowledge and need a teammate fact-check.
- **Photos** are illustrations; swap in real ones if you have licensed images.
- Match threshold is 60%, "top pick" is 75% (constants in `logic.js`).
