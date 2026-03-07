"""
Import progressions from progressions.json and warmup.json into the backend API.
"""
import json, re, requests

API = "http://localhost:8082/api/v1"

def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.strip().lower()).strip('-')

# --- Load exercises for ID matching ---
exercises = requests.get(f"{API}/exercises").json()
exercise_name_map = {}
for ex in exercises:
    exercise_name_map[ex["name"].strip().upper()] = ex["id"]

def find_exercise_id(name):
    norm = re.sub(r'\s+', ' ', name.strip().upper())
    return exercise_name_map.get(norm, "")

# --- Import progressions.json ---
with open("frontend/public/data/progressions.json") as f:
    prog_data = json.load(f)

created = 0
for body_region in ["lowerBody", "upperBody"]:
    for prog in prog_data.get(body_region, []):
        name = prog.get("name") or prog.get("fullName", "")
        if not name:
            continue
        prog_id = slug(f"{body_region}-{name}")
        steps = []
        for step in prog.get("levels", []):
            level = step["level"].replace("LEVEL ", "")
            ex_name = step.get("exercise", "")
            ex_id = find_exercise_id(ex_name)
            steps.append({
                "level": level,
                "exerciseName": ex_name,
                "exerciseId": ex_id
            })
        payload = {
            "id": prog_id,
            "name": name,
            "bodyRegion": body_region,
            "steps": steps
        }
        r = requests.post(f"{API}/progressions", json=payload)
        if r.status_code in (200, 201):
            created += 1
        else:
            print(f"  WARN: {name}: {r.status_code} {r.text[:80]}")

print(f"Progressions created: {created}")

# --- Import warmup.json (BH1, BH2) ---
with open("frontend/public/data/warmup.json") as f:
    warmup_data = json.load(f)

warmup_created = 0
for cat in warmup_data.get("categories", []):
    cat_name = cat["name"]  # BH1, BH2
    # Each level has a list of exercises at fixed positions (6 exercises per level)
    # We create one progression per position across levels
    levels_data = cat.get("levels", [])
    if not levels_data:
        continue
    num_positions = len(levels_data[0].get("exercises", []))
    for pos in range(num_positions):
        prog_name = f"{cat_name} Position {pos + 1}"
        prog_id = slug(f"warmup-{cat_name}-pos{pos + 1}")
        steps = []
        for lv in levels_data:
            level = lv["level"]
            exs = lv.get("exercises", [])
            ex_name = exs[pos] if pos < len(exs) else ""
            ex_id = find_exercise_id(ex_name) if ex_name else ""
            steps.append({
                "level": level,
                "exerciseName": ex_name,
                "exerciseId": ex_id
            })
        payload = {
            "id": prog_id,
            "name": prog_name,
            "bodyRegion": "warmup",
            "steps": steps
        }
        r = requests.post(f"{API}/progressions", json=payload)
        if r.status_code in (200, 201):
            warmup_created += 1
        else:
            print(f"  WARN: {prog_name}: {r.status_code} {r.text[:80]}")

print(f"Warmup progressions created: {warmup_created}")
print("Done!")
