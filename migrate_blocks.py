"""
Migrate LevelExercise.block values from generic names to body-region-specific IDs.

Old: explosiv, strengthA, strengthB, isometrics
New: ukex/okex, ukk/okk, ukp/okp, ukiso/okiso (based on exercise bodyRegion)
"""
import requests

API = "http://localhost:8082/api/v1"

# Fetch all data
exercises = {e['id']: e for e in requests.get(f"{API}/exercises").json()}
level_exercises = requests.get(f"{API}/level-exercises").json()

BODY_PREFIX = {
    'lowerBody': 'uk',
    'upperBody': 'ok',
    'core': 'core',
    'fullBody': 'uk',  # default fullBody to UK
}

BLOCK_SUFFIX = {
    'explosiv': 'ex',
    'strengthA': 'k',
    'strengthB': 'p',
    'isometrics': 'iso',
}

updated = 0
skipped = 0
errors = 0

for le in level_exercises:
    old_block = le['block']
    if old_block not in BLOCK_SUFFIX:
        print(f"  SKIP: {le['id']} block={old_block} (already migrated or unknown)")
        skipped += 1
        continue

    exercise = exercises.get(le['exerciseId'])
    if not exercise:
        print(f"  WARN: {le['id']} exercise {le['exerciseId']} not found")
        errors += 1
        continue

    body_region = exercise['bodyRegion']
    prefix = BODY_PREFIX.get(body_region, 'uk')
    suffix = BLOCK_SUFFIX[old_block]
    new_block = prefix + suffix

    le['block'] = new_block
    r = requests.put(f"{API}/level-exercises/{le['id']}", json=le)
    if r.status_code in (200, 201):
        updated += 1
    else:
        print(f"  ERROR: {le['id']}: {r.status_code} {r.text[:80]}")
        errors += 1

print(f"\nMigration complete: {updated} updated, {skipped} skipped, {errors} errors")
print(f"Total level exercises: {len(level_exercises)}")
