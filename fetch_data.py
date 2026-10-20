#!/usr/bin/env python3
"""Build data/neighborhoods.json (+ data/neighborhoods.js) for Swipe Right on NYC.

Run once, offline afterwards:  python3 fetch_data.py

Neighborhoods are the 42 United Hospital Fund (UHF) areas, defined by the official
NYC Health Dept ZIP table (https://www.nyc.gov/assets/doh/downloads/pdf/ah/zipcodetable.pdf).

Rule: never invent numbers. Anything that can't be fetched is left None and listed in
meta.nulls. Standard library only.
"""
import csv
import heapq
import io
import json
import math
import ssl
import statistics
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from collections import defaultdict
from datetime import date, timedelta
from itertools import groupby
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "data"
SOCRATA = "https://data.cityofnewyork.us/resource/"
UA = {"User-Agent": "swipe-right-on-nyc-hackathon/1.0"}

TODAY = date.today()
YEAR_AGO = TODAY - timedelta(days=365)

# ---------------------------------------------------------------- UHF definitions
# code: (official name, borough, [zips])  -- from the NYC Health Dept UHF ZIP table
UHF = {
    "101": ("Kingsbridge - Riverdale", "Bronx", "10463 10471"),
    "102": ("Northeast Bronx", "Bronx", "10466 10469 10470 10475"),
    "103": ("Fordham - Bronx Park", "Bronx", "10458 10467 10468"),
    "104": ("Pelham - Throgs Neck", "Bronx", "10461 10462 10464 10465 10472 10473"),
    "105": ("Crotona - Tremont", "Bronx", "10453 10457 10460"),
    "106": ("High Bridge - Morrisania", "Bronx", "10451 10452 10456"),
    "107": ("Hunts Point - Mott Haven", "Bronx", "10454 10455 10459 10474"),
    "201": ("Greenpoint", "Brooklyn", "11211 11222"),
    "202": ("Downtown - Heights - Park Slope", "Brooklyn", "11201 11205 11215 11217 11231"),
    "203": ("Bedford Stuyvesant - Crown Heights", "Brooklyn", "11213 11212 11216 11233 11238"),
    "204": ("East New York", "Brooklyn", "11207 11208"),
    "205": ("Sunset Park", "Brooklyn", "11220 11232"),
    "206": ("Borough Park", "Brooklyn", "11204 11218 11219 11230"),
    "207": ("East Flatbush - Flatbush", "Brooklyn", "11203 11210 11225 11226"),
    "208": ("Canarsie - Flatlands", "Brooklyn", "11234 11236 11239"),
    "209": ("Bensonhurst - Bay Ridge", "Brooklyn", "11209 11214 11228"),
    "210": ("Coney Island - Sheepshead Bay", "Brooklyn", "11223 11224 11229 11235"),
    "211": ("Williamsburg - Bushwick", "Brooklyn", "11206 11221 11237"),
    "301": ("Washington Heights - Inwood", "Manhattan", "10031 10032 10033 10034 10040"),
    "302": ("Central Harlem - Morningside Heights", "Manhattan", "10026 10027 10030 10037 10039"),
    "303": ("East Harlem", "Manhattan", "10029 10035"),
    "304": ("Upper West Side", "Manhattan", "10023 10024 10025"),
    "305": ("Upper East Side", "Manhattan", "10021 10028 10044 10128"),
    "306": ("Chelsea - Clinton", "Manhattan", "10001 10011 10018 10019 10020 10036"),
    "307": ("Gramercy Park - Murray Hill", "Manhattan", "10010 10016 10017 10022"),
    "308": ("Greenwich Village - SoHo", "Manhattan", "10012 10013 10014"),
    "309": ("Union Square - Lower East Side", "Manhattan", "10002 10003 10009"),
    "310": ("Lower Manhattan", "Manhattan", "10004 10005 10006 10007 10038 10280"),
    "401": ("Long Island City - Astoria", "Queens", "11101 11102 11103 11104 11105 11106"),
    "402": ("West Queens", "Queens", "11368 11369 11370 11372 11373 11377 11378"),
    "403": ("Flushing - Clearview", "Queens", "11354 11355 11356 11357 11358 11359 11360"),
    "404": ("Bayside - Little Neck", "Queens", "11361 11362 11363 11364"),
    "405": ("Ridgewood - Forest Hills", "Queens", "11374 11375 11379 11385"),
    "406": ("Fresh Meadows", "Queens", "11365 11366 11367"),
    "407": ("Southwest Queens", "Queens", "11414 11415 11416 11417 11418 11419 11420 11421"),
    "408": ("Jamaica", "Queens", "11412 11423 11432 11433 11434 11435 11436"),
    "409": ("Southeast Queens", "Queens", "11004 11005 11411 11413 11422 11426 11427 11428 11429"),
    "410": ("Rockaway", "Queens", "11691 11692 11693 11694 11695 11697"),
    "501": ("Port Richmond", "Staten Island", "10302 10303 10310"),
    "502": ("Stapleton - St. George", "Staten Island", "10301 10304 10305"),
    "503": ("Willowbrook", "Staten Island", "10314"),
    "504": ("South Beach - Tottenville", "Staten Island", "10306 10307 10308 10309 10312"),
}
UHF = {c: (n, b, z.split()) for c, (n, b, z) in UHF.items()}
ZIP_TO_UHF = {z: c for c, (_, _, zs) in UHF.items() for z in zs}

# Where people might work (UHF codes). Commute = estimated subway time to the nearest station there.
WORK_AREAS = {
    "306": "Midtown West & Hudson Yards",
    "307": "Midtown East & Grand Central",
    "310": "Financial District & Lower Manhattan",
    "308": "Greenwich Village & SoHo",
    "202": "Downtown Brooklyn & Park Slope",
    "401": "Long Island City & Astoria",
}

# Modelling parameters for the commute estimate (documented in meta.commute_method)
BOARD_WAIT_MIN = 4.0  # average wait added each time you board a train


def log(*a):
    print(*a, file=sys.stderr, flush=True)


# ---------------------------------------------------------------- http helpers
def _ssl_context():
    # python.org builds on macOS ship without CA certs; fall back to the system bundle
    ctx = ssl.create_default_context()
    if not ctx.get_ca_certs():
        for cafile in ("/etc/ssl/cert.pem", "/etc/ssl/certs/ca-certificates.crt"):
            if Path(cafile).exists():
                return ssl.create_default_context(cafile=cafile)
    return ctx


SSL_CTX = _ssl_context()


def fetch(url, tries=3, timeout=120):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                raise
            log(f"  retry {i + 1} after {e}")
            time.sleep(2)


def soql(dataset, **params):
    q = urllib.parse.urlencode({"$" + k: v for k, v in params.items()})
    return json.loads(fetch(f"{SOCRATA}{dataset}.json?{q}"))


# ---------------------------------------------------------------- geometry
def ring_area_m2(ring, lat0):
    kx = 111320 * math.cos(math.radians(lat0))
    ky = 110574
    pts = [(x * kx, y * ky) for x, y in ring]
    s = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
        s += x1 * y2 - x2 * y1
    return abs(s) / 2


def point_in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


class Zctas:
    """NYC Modified ZCTA polygons (dataset pri4-ifjk): population, area, point lookup."""

    def __init__(self):
        rows = soql("pri4-ifjk", limit=500)
        self.items = []  # (modzcta, bbox, polygons)
        self.pop = {}
        self.area_km2 = {}
        self.zip_to_mod = {}
        for r in rows:
            mod = r["modzcta"]
            geom = r["the_geom"]
            polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
            xs = [p[0] for poly in polys for ring in poly for p in ring]
            ys = [p[1] for poly in polys for ring in poly for p in ring]
            bbox = (min(xs), min(ys), max(xs), max(ys))
            lat0 = (bbox[1] + bbox[3]) / 2
            area = 0.0
            for poly in polys:
                area += ring_area_m2(poly[0], lat0) - sum(ring_area_m2(h, lat0) for h in poly[1:])
            self.items.append((mod, bbox, polys))
            self.pop[mod] = int(r["pop_est"]) if r.get("pop_est") else None
            self.area_km2[mod] = area / 1e6
            for z in (r.get("zcta") or "").split(","):
                if z.strip():
                    self.zip_to_mod[z.strip()] = mod
            for z in (r.get("label") or "").split(","):
                if z.strip():
                    self.zip_to_mod.setdefault(z.strip(), mod)

    def locate(self, lon, lat):
        for mod, (x0, y0, x1, y1), polys in self.items:
            if x0 <= lon <= x1 and y0 <= lat <= y1:
                for poly in polys:
                    if point_in_ring(lon, lat, poly[0]) and not any(point_in_ring(lon, lat, h) for h in poly[1:]):
                        return mod
        return None


# ---------------------------------------------------------------- pipeline steps
def step_geography(z):
    """UHF -> modzcta set, population, land area; modzcta -> UHF."""
    mod_to_uhf = {}
    uhf_mods = defaultdict(set)
    missing = []
    for code, (_, _, zips) in UHF.items():
        for zp in zips:
            mod = z.zip_to_mod.get(zp)
            if not mod:
                missing.append(zp)
                continue
            if mod in mod_to_uhf and mod_to_uhf[mod] != code:
                # a merged ZCTA claimed by two UHFs: keep the one that lists its primary ZIP
                if zp == mod:
                    uhf_mods[mod_to_uhf[mod]].discard(mod)
                    mod_to_uhf[mod] = code
                else:
                    continue
            mod_to_uhf.setdefault(mod, code)
            uhf_mods[code].add(mod)
    if missing:
        log("  ZIPs with no polygon (excluded from population/area):", missing)
    out = {}
    for code in UHF:
        mods = uhf_mods[code]
        pops = [z.pop[m] for m in mods if z.pop.get(m) is not None]
        out[code] = {
            "population": sum(pops) if pops else None,
            "area_km2": round(sum(z.area_km2[m] for m in mods), 3) if mods else None,
        }
    return out, mod_to_uhf


def step_air():
    rows = soql(
        "c3uy-2p5r",
        select="geo_join_id,geo_place_name,data_value,time_period",
        where="name='Fine particles (PM 2.5)' AND geo_type_name='UHF42' AND measure='Annual mean'",
        limit=5000,
    )
    latest = max(r["time_period"] for r in rows)
    out = {r["geo_join_id"]: (float(r["data_value"]), r["geo_place_name"]) for r in rows if r["time_period"] == latest}
    log(f"  air: {len(out)} UHF areas, period {latest}")
    return out, latest


def zip_list_sql(col):
    return f"{col} in(" + ",".join(f"'{zp}'" for zp in ZIP_TO_UHF) + ")"


def step_rats():
    rows = soql(
        "p937-wjvj",
        select="zip_code,result,count(*) as n",
        where=(
            f"inspection_type='Initial' AND inspection_date>='{YEAR_AGO}T00:00:00' "
            f"AND inspection_date<='{TODAY}T23:59:59' AND {zip_list_sql('zip_code')}"
        ),
        group="zip_code,result",
        limit=50000,
    )
    tot, act = defaultdict(int), defaultdict(int)
    for r in rows:
        c = ZIP_TO_UHF[r["zip_code"]]
        n = int(r["n"])
        tot[c] += n
        if r["result"].startswith("Failed for Rat Activity"):
            act[c] += n
    log(f"  rats: {sum(tot.values())} initial inspections")
    return tot, act


def step_restaurants():
    rows = soql(
        "43nn-pn8j",
        select="zipcode,count(distinct camis) as n",
        where=f"inspection_date>='{YEAR_AGO}T00:00:00' AND {zip_list_sql('zipcode')}",
        group="zipcode",
        limit=50000,
    )
    out = defaultdict(int)
    for r in rows:
        out[ZIP_TO_UHF[r["zipcode"]]] += int(r["n"])
    log(f"  restaurants: {sum(out.values())}")
    return out


def step_parks():
    rows = soql("enfh-gkve", select="zipcode,sum(acres) as a", where="retired=false", group="zipcode", limit=5000)
    out = defaultdict(float)
    for r in rows:
        zips = sorted({s.strip() for s in (r.get("zipcode") or "").split(",") if s.strip()})
        if not zips:
            continue
        share = float(r["a"]) / len(zips)  # multi-ZIP parks are split evenly across their listed ZIPs
        for zp in zips:
            if zp in ZIP_TO_UHF:
                out[ZIP_TO_UHF[zp]] += share
    log(f"  parks: {sum(out.values()):.0f} acres allocated")
    return out


def step_crime(z, mod_to_uhf):
    rows = soql(
        "5uac-w243",
        select="round(latitude,3) as la,round(longitude,3) as lo,count(*) as n",
        where="law_cat_cd='FELONY' AND cmplnt_fr_dt>='2026-01-01T00:00:00' AND latitude IS NOT NULL",
        group="la,lo",
        limit=100000,
    )
    last = soql("5uac-w243", select="max(cmplnt_fr_dt)")[0]["max_cmplnt_fr_dt"][:10]
    out = defaultdict(int)
    placed = total = 0
    for r in rows:
        n = int(r["n"])
        total += n
        la, lo = float(r["la"]), float(r["lo"])
        if la == 0:
            continue
        mod = z.locate(lo, la)
        if mod and mod in mod_to_uhf:
            out[mod_to_uhf[mod]] += n
            placed += n
    log(f"  crime: placed {placed}/{total} felony complaints, through {last}")
    return out, last


def step_rent():
    text = fetch("https://files.zillowstatic.com/research/public_csvs/zori/Zip_zori_uc_sfrcondomfr_sm_month.csv").decode()
    reader = csv.DictReader(io.StringIO(text))
    cols = reader.fieldnames
    month_cols = [c for c in cols if c[:2] == "20"]
    vals = defaultdict(list)
    asof = None
    for row in reader:
        zp = row["RegionName"].zfill(5)
        if zp not in ZIP_TO_UHF:
            continue
        for c in reversed(month_cols):
            if row[c]:
                asof = max(asof or c, c)
                vals[ZIP_TO_UHF[zp]].append((c, float(row[c])))
                break
    out = {}
    for code, items in vals.items():
        newest = max(c for c, _ in items)
        out[code] = (round(statistics.median(v for _, v in items), 0), len(items), newest)
    log(f"  rent: {len(out)} UHFs have Zillow ZORI values (latest month {asof})")
    return out, asof


def step_transit(z, mod_to_uhf):
    gtfs = zipfile.ZipFile(io.BytesIO(fetch("http://web.mta.info/developers/data/nyct/subway/google_transit.zip")))

    def rows(name):
        return csv.DictReader(io.TextIOWrapper(gtfs.open(name), encoding="utf-8-sig"))

    stops = {r["stop_id"]: r for r in rows("stops.txt")}
    parent = {sid: (r["parent_station"] or sid) for sid, r in stops.items()}
    stations = {sid: r for sid, r in stops.items() if r["location_type"] == "1"}
    st_uhf = {}
    for sid, r in stations.items():
        mod = z.locate(float(r["stop_lon"]), float(r["stop_lat"]))
        if mod and mod in mod_to_uhf:
            st_uhf[sid] = mod_to_uhf[mod]
    route_name = {r["route_id"]: r["route_short_name"] for r in rows("routes.txt")}

    # services running on a weekday today
    ds = TODAY.strftime("%Y%m%d")
    services = {
        r["service_id"]
        for r in rows("calendar.txt")
        if r["monday"] == "1" and r["start_date"] <= ds <= r["end_date"]
    }
    trips = {r["trip_id"]: r["route_id"] for r in rows("trips.txt") if r["service_id"] in services}
    log(f"  gtfs: {len(stations)} stations, {len(st_uhf)} placed in a UHF, {len(trips)} weekday trips")

    def secs(t):
        h, m, s = t.split(":")
        return int(h) * 3600 + int(m) * 60 + int(s)

    seg = defaultdict(list)  # (route, a, b) -> [minutes]
    route_stations = defaultdict(set)
    f = io.TextIOWrapper(gtfs.open("stop_times.txt"), encoding="utf-8-sig")
    for trip_id, grp in groupby(csv.DictReader(f), key=lambda r: r["trip_id"]):
        route = trips.get(trip_id)
        if not route:
            continue
        g = list(grp)
        if not (10 * 3600 <= secs(g[0]["departure_time"]) < 15 * 3600):  # midday service only
            continue
        for a, b in zip(g, g[1:]):
            pa, pb = parent[a["stop_id"]], parent[b["stop_id"]]
            if pa == pb:
                continue
            seg[(route, pa, pb)].append((secs(b["arrival_time"]) - secs(a["departure_time"])) / 60)
            route_stations[route].update((pa, pb))

    graph = defaultdict(list)
    for (route, a, b), ts in seg.items():
        graph[f"{a}|{route}"].append((f"{b}|{route}", statistics.median(ts)))
    for route, sts in route_stations.items():
        for s in sts:
            graph[s].append((f"{s}|{route}", BOARD_WAIT_MIN))  # board
            graph[f"{s}|{route}"].append((s, 0.0))  # alight
    for r in rows("transfers.txt"):
        a, b = r["from_stop_id"], r["to_stop_id"]
        if a != b and a in stations and b in stations:
            graph[a].append((b, int(r["min_transfer_time"] or 0) / 60))

    def dijkstra(src):
        dist = {src: 0.0}
        pq = [(0.0, src)]
        while pq:
            d, u = heapq.heappop(pq)
            if d > dist.get(u, 1e18):
                continue
            for v, w in graph.get(u, ()):
                nd = d + w
                if nd < dist.get(v, 1e18):
                    dist[v] = nd
                    heapq.heappush(pq, (nd, v))
        return dist

    by_uhf = defaultdict(list)
    for sid, code in st_uhf.items():
        by_uhf[code].append(sid)

    lines = defaultdict(set)
    for route, sts in route_stations.items():
        for s in sts:
            if s in st_uhf:
                lines[st_uhf[s]].add(route_name[route])

    commute = {code: {} for code in UHF}
    for code, origins in by_uhf.items():
        per_work = {w: [] for w in WORK_AREAS}
        for o in origins:
            dist = dijkstra(o)
            for w in WORK_AREAS:
                best = min((dist[s] for s in by_uhf[w] if s in dist), default=None)
                if best is not None:
                    per_work[w].append(best)
        for w, vals in per_work.items():
            commute[code][w] = round(statistics.median(vals)) if vals else None
    for code in UHF:
        for w in WORK_AREAS:
            commute[code].setdefault(w, None)
    log("  commute matrix built")
    return {c: len(by_uhf.get(c, [])) for c in UHF}, {c: sorted(lines.get(c, ())) for c in UHF}, commute


# ---------------------------------------------------------------- ranking
def rank(values, best="low"):
    """1 = best. None stays None. Ties share the better rank."""
    items = [(c, v) for c, v in values.items() if v is not None]
    items.sort(key=lambda kv: kv[1], reverse=(best == "high"))
    out = {c: None for c in values}
    for i, (c, v) in enumerate(items):
        first = next(j for j, (_, v2) in enumerate(items) if v2 == v)
        out[c] = first + 1
    return out


def main():
    OUT.mkdir(exist_ok=True)
    log("zcta polygons ...")
    z = Zctas()
    geo, mod_to_uhf = step_geography(z)
    log("air quality ...")
    air, air_year = step_air()
    log("rodents ...")
    rat_tot, rat_act = step_rats()
    log("restaurants ...")
    rest = step_restaurants()
    log("parks ...")
    parks = step_parks()
    log("crime ...")
    crime, crime_through = step_crime(z, mod_to_uhf)
    log("rent (Zillow ZORI) ...")
    rent, rent_asof = step_rent()
    log("transit + commute (MTA GTFS) ...")
    stations, lines, commute = step_transit(z, mod_to_uhf)

    hoods = []
    for code, (name, boro, zips) in UHF.items():
        pop, area = geo[code]["population"], geo[code]["area_km2"]
        per1k = lambda n: round(n / pop * 1000, 2) if (pop and n is not None) else None  # noqa: E731
        rr = rent.get(code)
        hoods.append({
            "code": code,
            "name": name,
            "borough": boro,
            "zips": zips,
            "population": pop,
            "area_km2": area,
            "pop_density_per_km2": round(pop / area) if pop and area else None,
            "felonies": crime.get(code, 0),
            "felonies_per_1k": per1k(crime.get(code, 0)),
            "park_acres": round(parks.get(code, 0.0), 1),
            "park_acres_per_1k": per1k(parks.get(code, 0.0)),
            "restaurants": rest.get(code, 0),
            "restaurants_per_km2": round(rest.get(code, 0) / area, 1) if area else None,
            "rat_initial_inspections": rat_tot.get(code, 0),
            "rat_active": rat_act.get(code, 0),
            "rat_active_pct": round(100 * rat_act.get(code, 0) / rat_tot[code], 1) if rat_tot.get(code) else None,
            "pm25": round(air[code][0], 2) if code in air else None,
            "pm25_uhf_name": air[code][1] if code in air else None,
            "rent_typical": rr[0] if rr else None,
            "rent_zip_count": rr[1] if rr else None,
            "stations": stations[code],
            "stations_per_km2": round(stations[code] / area, 2) if area else None,
            "lines": lines[code],
            "commute_min": commute[code],
        })

    metrics = {
        "safety": ("felonies_per_1k", "low"),
        "green": ("park_acres_per_1k", "high"),
        "food": ("restaurants_per_km2", "high"),
        "transit": ("stations_per_km2", "high"),
        "rent": ("rent_typical", "low"),
        "air": ("pm25", "low"),
        "rats": ("rat_active_pct", "low"),
        "density": ("pop_density_per_km2", "high"),  # 1 = densest (not "better")
    }
    ranks = {k: rank({h["code"]: h[f] for h in hoods}, best) for k, (f, best) in metrics.items()}
    for h in hoods:
        h["ranks"] = {k: ranks[k][h["code"]] for k in metrics}

    nulls = [
        f"{h['code']} {h['name']}: {field}"
        for h in hoods
        for field in ("population", "area_km2", "pm25", "rent_typical", "rat_active_pct")
        if h[field] is None
    ] + [
        f"{h['code']} {h['name']}: commute to {WORK_AREAS[w]}"
        for h in hoods
        for w, v in h["commute_min"].items()
        if v is None
    ]

    meta = {
        "data_pulled_at": TODAY.isoformat(),
        "windows": {
            "rats": f"{YEAR_AGO} to {TODAY}",
            "restaurants": f"{YEAR_AGO} to {TODAY}",
            "crime": f"2026-01-01 to {crime_through}",
            "air": f"{air_year} annual mean",
            "rent": f"Zillow ZORI, {rent_asof}",
        },
        "sources": {
            "safety": {"label": "NYPD Complaint Data, felonies, Jan to " + crime_through, "dataset": "5uac-w243", "note": "per 1,000 residents; low-resident business districts look worse"},
            "green": {"label": "NYC Parks Properties", "dataset": "enfh-gkve", "note": "acres per 1,000 residents; multi-ZIP parks split evenly across their ZIPs"},
            "food": {"label": "DOHMH Restaurant Inspection Results", "dataset": "43nn-pn8j", "note": "distinct restaurants inspected in the last 12 months, per sq km"},
            "transit": {"label": "MTA subway GTFS (stations)", "dataset": "web.mta.info/developers", "note": "stations per sq km"},
            "rent": {"label": "Zillow Observed Rent Index (ZORI)", "dataset": "zillow.com/research/data", "note": "typical rent, all homes + multifamily (not 1BR); median across the area's ZIPs"},
            "air": {"label": "NYC Community Air Survey, PM2.5", "dataset": "c3uy-2p5r", "note": "annual mean, UHF42 area"},
            "rats": {"label": "Rodent Inspection (initial inspections)", "dataset": "p937-wjvj", "note": "share failing for rat activity"},
            "density": {"label": "MODZCTA population estimate", "dataset": "pri4-ifjk", "note": "people per sq km, polygon area computed from the ZCTA boundaries"},
            "commute": {"label": "MTA subway GTFS (midday weekday schedule)", "dataset": "web.mta.info/developers", "note": "see commute_method"},
        },
        "commute_method": (
            "Estimated minutes of subway/rail travel from the median station in a neighborhood to the nearest "
            f"station in the work area, using midday weekday scheduled run times, a {BOARD_WAIT_MIN:.0f}-minute wait each time "
            "you board, and MTA transfer walking times. Excludes walking to/from stations, buses and ferries."
        ),
        "work_areas": WORK_AREAS,
        "nulls": nulls,
    }

    payload = {"meta": meta, "neighborhoods": hoods}
    (OUT / "neighborhoods.json").write_text(json.dumps(payload, indent=2))
    (OUT / "neighborhoods.js").write_text(
        "// Generated by fetch_data.py - do not edit by hand.\nwindow.NYC_DATA = " + json.dumps(payload) + ";\n"
    )
    log(f"wrote data/neighborhoods.json + .js  ({len(hoods)} neighborhoods, {len(nulls)} nulls)")
    for n in nulls[:40]:
        log("  null:", n)


if __name__ == "__main__":
    main()
