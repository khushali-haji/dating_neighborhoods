# PRD: Swipe Right on NYC

A dating-app-style web app where users swipe on NYC neighborhoods and get matched with the one that fits them best. Humor is the hook; the data must be real.

- **Status:** Draft for team review
- **Format:** Hackathon build, ~2 hours
- **Owner:** Khushali

---

## 1. Problem and goal

Renters trade off quiet, cost, safety, transit, and environment, and NYC open data makes those trade-offs visible, but nobody reads a dataset to pick a neighborhood. We wrap the data in a dating-app format with funny profiles so people actually engage with it.

**Goal:** In under two minutes, a user fills in a short profile, swipes through 12 neighborhoods, and gets a "match" with a one-line explanation backed by a real statistic.

**Civic point:** Make the real trade-offs between neighborhoods visible and memorable.

## 2. Non-goals

- No map
- No live API calls at demo time
- No user accounts
- No "enter any address" feature in the base build (workplace is chosen by neighborhood; address entry is a stretch, see section 6)
- No framework or build step for the app itself

## 3. Hard constraints

- Single static `index.html` (vanilla HTML/CSS/JS). Runs by opening the file or via a simple local server.
- Works with no network. Data is inlined or loaded locally.
- **Never invent or estimate numbers.** If a value can't be fetched or cited, it is `null` and flagged.
- Mobile-friendly (demo may be on a phone).
- Original visual style. No imitation of Tinder/Hinge branding or UI.

## 4. Users and demo audience

Hackathon judges and attendees, likely viewing on a phone. People who rent or may rent in NYC.

## 5. User flow

1. **Profile (start screen).** Short questions, tap to answer, like a dating-app profile. They set the user's preferences and weights (see section 6).
2. **Swipe.** One card at a time: neighborhood name and a joke age, first-person bio, stat chips, red flag and green flag. Swipe by drag (pointer events) and by ❌ / 💚 buttons (buttons are the reliable fallback). Fly-off animation.
3. **Match.** Among right-swiped neighborhoods, show the highest compatibility score: "It's a match!" plus a one-line explanation using a real stat. If nothing was right-swiped, show a funny "Still single in NYC" screen. Both screens have a restart button.

Footer on every screen: "Data: NYC Open Data, pulled [date]." Each stat chip names its source dataset (tooltip or tap-to-reveal).

## 6. Locked factors

| # | Factor | Profile question (draft) | What it measures |
|---|---|---|---|
| 1 | Safety | How much does safety matter? | Crime rate for the area |
| 2 | Green space | Do you want parks nearby? | Park acreage / access |
| 3 | Population density | Quiet and spread out, or packed and buzzing? | People per area |
| 4 | Rent affordability | What is your budget: low / mid / high? | 1BR rent level |
| 5 | Transit | How much does the subway matter? | Station and line access |
| 6 | Workplace connection | Where do you work? | Public transit travel time to a chosen work area |
| 7 | Food density | Want lots of places to eat? | Restaurants per area |
| 8 | Air pollution | Does air quality matter? | PM2.5 |
| 9 | Rats | Is rat activity a dealbreaker? | Rodent inspection results |

**Decision:** noise complaints (311) are out. "Quiet vs. lively" is covered by population density and food density.

### Profile screens

The nine factors are grouped into 5 to 6 tap-to-answer screens so the profile stays fast:

1. Budget (rent affordability)
2. Vibe (population density and food density)
3. Getting around (transit)
4. Where you work (workplace connection)
5. Safety and green space
6. Health dealbreakers (air pollution, rats)

### Matching logic (proposed)

- Each neighborhood gets a 0 to 100 score per factor, based on its rank among the 12 (1 = best).
- Each profile answer sets a weight for the factor.
- Compatibility = weighted average, shown as a percentage.
- If a factor's data is `null` for a neighborhood, that factor is skipped and the score is reweighted. Never guessed.
- Match = highest compatibility among right-swiped neighborhoods. Ties: the neighborhood swiped right first wins.

### Workplace input

- **Default (in scope):** the user picks a work *neighborhood* from a list. Commute is precomputed per neighborhood pair, so it works offline.
- **Stretch (out of scope unless time allows):** the user enters an exact address, which we place inside our neighborhood boundaries. This conflicts with the no-network and no-live-API constraints, because geocoding needs a service or a bundled boundary file plus a geocoder. See open question 6.

## 7. Neighborhoods

12 neighborhoods, each defined as a list of ZIP codes. Verify ZIPs before use.

- Bushwick (11237, 11221)
- Williamsburg (11211, 11249)
- Park Slope (11215)
- Sunset Park (11220)
- Crown Heights (11213, 11216)
- Astoria (11102, 11103, 11105, 11106)
- Long Island City (11101)
- Jackson Heights (11372)
- Ridgewood (11385)
- East Village (10009)
- Washington Heights (10032, 10033)
- Mott Haven (10454, 10455)

## 8. Data schema (proposed)

Saved to `data/neighborhoods.json`, with `data_pulled_at`. Profile copy lives in the same JSON so it can be hand-edited.

```
{
  name, zips,
  safety, green_space, population_density, rent_1br, rent_source,
  transit, commute: { <work_area>: minutes | null },
  food_density, pm25, pm25_uhf_name, rat_activity,
  ranks: { <factor>: 1..12 },
  profile: { age, bio, red_flag, green_flag }
}
```

Raw counts are not population-adjusted unless we decide otherwise (section 9, Q3). Profile copy should lean on ranks and relative language, not precise per-person claims.

## 9. Data sourcing (OPEN: for team discussion)

There is no single API for all factors. Most live on NYC Open Data (Socrata). The open question is **how we get each one fast**.

| Factor | Candidate source | Access | Concern |
|---|---|---|---|
| Rats | Rodent Inspection (`p937-wjvj`) | Socrata | Verify ID and result values |
| Air pollution | NYC Community Air Survey (`c3uy-2p5r`) | Socrata | Reported by UHF area, not ZIP; several neighborhoods may share a value |
| Food density | DOHMH restaurant inspections | Socrata | Count distinct restaurants per ZIP |
| Population density | Census ACS (population by ZIP) plus land area | Census API | Needs land area source |
| Transit | MTA subway stations | Socrata / MTA open data | Needs station-to-ZIP mapping |
| Safety | NYPD complaint data | Socrata | Reported by precinct, not ZIP; sensitive and easy to misrepresent |
| Green space | NYC Parks properties | Socrata | Needs acreage per ZIP |
| Rent | No official source | Manual lookup with citations | Listing-based medians, not official; stays `null` if not citable |
| Commute | Routing engine required | Options below | Hardest factor |

### Commute options

- **A. Google Maps Directions API:** accurate, needs a key and billing; about 60 requests (12 neighborhoods x ~5 work areas).
- **B. Hand-fill:** look up in Google Maps by hand. Zero setup, tedious.
- **C. MTA GTFS plus a routing library:** free but heavy; likely too much for 2 hours.

### Open questions for the team

1. Who owns the commute table, and does anyone have a Google Maps API key?
2. Safety: use the closest precinct per neighborhood with clear labeling, or drop the factor?
3. Do we population-adjust counts (per 1,000 residents using Census), or rank raw counts with a caveat in the footer?
4. Who looks up and cites rent for 12 neighborhoods, and from what source?
5. Air quality ties: several neighborhoods map to the same UHF area. Acceptable, or find a finer source?
6. Exact-address workplace entry: worth the extra work? It needs neighborhood boundary polygons (NYC Neighborhood Tabulation Areas are on Open Data) plus a geocoder, and a live geocoding call breaks the offline rule.

## 10. Profile copy

For each neighborhood: `age` (a playful number, a joke), `bio` (2 to 3 sentences, first person, weaving in at least 2 real stats), `red_flag` and `green_flag` (one line each, each tied to a real stat).

Tone: witty, affectionate, a little roasty. Punch at landlords and systems, never at residents.

## 11. Visual style

Bold and playful. Strong color, big type, rounded cards. Original: no Tinder or Hinge branding, logos, or exact UI.

## 12. Build plan and cut list

| Step | Time | Output |
|---|---|---|
| 1. Data pipeline | ~30 to 40 min | `fetch_data.py` writes `data/neighborhoods.json` (SoQL aggregated server-side) |
| 2. Profiles | ~20 min | Copy for 12 neighborhoods |
| 3. App | ~45 min | Profile, swipe, and match screens, plus footer |
| 4. Polish | ~15 min | Phone-width test, offline check, restart button |

**Cut order if behind:**
1. Drag gestures, buttons only
2. Tooltips, one "Data sources" line on the match screen
3. Optional factors (green space, food density), fewer profile questions
4. Weighted scoring, match = last right-swipe

**Never cut:** real data, the match screen, the footer citation.

## 13. Risks

- Too many factors for a 2-hour build, with data wrangling taking longer than expected.
- Sensitive or misleading factors (safety) being misrepresented.
- Rent and commute depend on manual work.
- ZIP-level data for several datasets does not line up with the neighborhood groupings.

## 14. Deliverable report (when done)

- Dataset IDs and fields actually used, and any not verified
- Every `null` value that needs filling (rent, commute)
- How to run it
