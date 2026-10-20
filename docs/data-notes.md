# Data notes: extra files review (2026-10-19)

## Rent file (`nyc_median_rents.txt`, ~300 neighborhoods)
- Not used. No source, date or unit stated, so it can't be cited.
- Runs ~30-40% below the Zillow ZORI values the app uses (e.g. Williamsburg $2,307 vs $3,778 for our Williamsburg & Bushwick area).
- Includes non-residential places (Rockaway Community Park $665, Central Park, Cemetery, JFK, LaGuardia) and odd values (Starrett City $800, Red Hook $944, Mott Haven $1,015).
- Using it means mapping ~300 names to our 42 UHF areas (~30-45 min). Ranks would barely change.
- If a teammate finds its source and date, use it as a cross-check only.

## Hackathon API list (`nycapihackathon.txt`)
- Already used: air `c3uy-2p5r`, rodents `p937-wjvj`.
- Worth adding: HPD violations `wvxf-dwi5` (a per-area "landlord roast" stat, ~30 min).
- Optional: DOB complaints `eabe-havv`, retail food stores `9a8c-vfzj`, school quality `dnpx-dfnc`, MTA stations `5f5g-n3cz` (we already use MTA GTFS).
- Not useful: rolling sales `usep-8jbt` (purchase prices, not rent), drinking water `bkwf-xfky` (sample sites).
- Dead IDs (404): harbor water `5uac-4256`, beach water `2x44-245v`, DEP noise permits `542n-s3py`.
- Mislabeled: `hg3c-2jsy` is a school directory, not MTA bus stops.
- Do NOT bulk-download with `$limit=50000`: 311 has ~22.8M rows and HPD violations ~11.3M, so counts would be silently wrong. Aggregate server-side with `$select`/`$where`/`$group`, as `fetch_data.py` does.
