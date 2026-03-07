package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/MeKo-Tech/go-react/internal/models"
	_ "modernc.org/sqlite"
)

type DB struct {
	db *sql.DB
}

func NewDB(path string) (*DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	// Enable WAL mode for better concurrency
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return nil, fmt.Errorf("set WAL mode: %w", err)
	}

	d := &DB{db: db}
	if err := d.createTables(); err != nil {
		return nil, fmt.Errorf("create tables: %w", err)
	}

	slog.Info("database initialized", "path", path)
	return d, nil
}

func (d *DB) Close() error {
	return d.db.Close()
}

func (d *DB) createTables() error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS exercises (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			body_region TEXT NOT NULL DEFAULT '',
			category TEXT NOT NULL DEFAULT '',
			tags TEXT NOT NULL DEFAULT '[]',
			equipment TEXT NOT NULL DEFAULT '[]',
			description TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS level_exercises (
			id TEXT PRIMARY KEY,
			exercise_id TEXT NOT NULL REFERENCES exercises(id),
			level TEXT NOT NULL,
			block TEXT NOT NULL,
			order_num INTEGER NOT NULL DEFAULT 0,
			default_tempo TEXT NOT NULL DEFAULT '',
			default_rpe TEXT NOT NULL DEFAULT '',
			default_sxr TEXT NOT NULL DEFAULT '',
			default_weight TEXT NOT NULL DEFAULT ''
		)`,
		`CREATE INDEX IF NOT EXISTS idx_level_exercises_level ON level_exercises(level)`,
		`CREATE INDEX IF NOT EXISTS idx_level_exercises_exercise ON level_exercises(exercise_id)`,
		`CREATE TABLE IF NOT EXISTS players (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			height TEXT,
			weight TEXT,
			level TEXT NOT NULL DEFAULT '',
			dob TEXT,
			notes TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS week_plans (
			id TEXT PRIMARY KEY,
			player_id TEXT NOT NULL,
			week TEXT NOT NULL,
			days TEXT NOT NULL DEFAULT '[]',
			total_rpe INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS media (
			id TEXT PRIMARY KEY,
			exercise_id TEXT NOT NULL,
			type TEXT NOT NULL,
			data TEXT NOT NULL,
			name TEXT NOT NULL,
			created_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS player_logs (
			id TEXT PRIMARY KEY,
			entries TEXT NOT NULL DEFAULT '[]',
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS progressions (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			body_region TEXT NOT NULL DEFAULT '',
			steps TEXT NOT NULL DEFAULT '[]',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)`,
	}

	for _, stmt := range statements {
		if _, err := d.db.Exec(stmt); err != nil {
			return fmt.Errorf("exec %q: %w", stmt[:40], err)
		}
	}
	return nil
}

// --- Players ---

func (d *DB) GetAllPlayers() ([]models.Player, error) {
	rows, err := d.db.Query("SELECT id, name, height, weight, level, dob, notes, created_at, updated_at FROM players ORDER BY name")
	if err != nil {
		return nil, fmt.Errorf("query players: %w", err)
	}
	defer rows.Close()

	var players []models.Player
	for rows.Next() {
		var p models.Player
		if err := rows.Scan(&p.ID, &p.Name, &p.Height, &p.Weight, &p.Level, &p.DOB, &p.Notes, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan player: %w", err)
		}
		players = append(players, p)
	}
	if players == nil {
		players = []models.Player{}
	}
	return players, rows.Err()
}

func (d *DB) GetPlayer(id string) (*models.Player, error) {
	var p models.Player
	err := d.db.QueryRow("SELECT id, name, height, weight, level, dob, notes, created_at, updated_at FROM players WHERE id = ?", id).
		Scan(&p.ID, &p.Name, &p.Height, &p.Weight, &p.Level, &p.DOB, &p.Notes, &p.CreatedAt, &p.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("query player %s: %w", id, err)
	}
	return &p, nil
}

func (d *DB) UpsertPlayer(p models.Player) error {
	_, err := d.db.Exec(`
		INSERT INTO players (id, name, height, weight, level, dob, notes, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name, height=excluded.height, weight=excluded.weight,
			level=excluded.level, dob=excluded.dob, notes=excluded.notes,
			updated_at=excluded.updated_at`,
		p.ID, p.Name, p.Height, p.Weight, p.Level, p.DOB, p.Notes, p.CreatedAt, p.UpdatedAt)
	if err != nil {
		return fmt.Errorf("upsert player: %w", err)
	}
	return nil
}

func (d *DB) DeletePlayer(id string) error {
	res, err := d.db.Exec("DELETE FROM players WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete player: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// --- Week Plans ---

func (d *DB) GetAllWeekPlans() ([]models.WeekPlan, error) {
	rows, err := d.db.Query("SELECT id, player_id, week, days, total_rpe, created_at FROM week_plans ORDER BY created_at DESC")
	if err != nil {
		return nil, fmt.Errorf("query week_plans: %w", err)
	}
	defer rows.Close()

	var plans []models.WeekPlan
	for rows.Next() {
		var p models.WeekPlan
		var days string
		if err := rows.Scan(&p.ID, &p.PlayerID, &p.Week, &days, &p.TotalRPE, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan week_plan: %w", err)
		}
		p.Days = []byte(days)
		plans = append(plans, p)
	}
	if plans == nil {
		plans = []models.WeekPlan{}
	}
	return plans, rows.Err()
}

func (d *DB) GetWeekPlan(id string) (*models.WeekPlan, error) {
	var p models.WeekPlan
	var days string
	err := d.db.QueryRow("SELECT id, player_id, week, days, total_rpe, created_at FROM week_plans WHERE id = ?", id).
		Scan(&p.ID, &p.PlayerID, &p.Week, &days, &p.TotalRPE, &p.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("query week_plan %s: %w", id, err)
	}
	p.Days = []byte(days)
	return &p, nil
}

func (d *DB) UpsertWeekPlan(p models.WeekPlan) error {
	days := string(p.Days)
	_, err := d.db.Exec(`
		INSERT INTO week_plans (id, player_id, week, days, total_rpe, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			player_id=excluded.player_id, week=excluded.week, days=excluded.days,
			total_rpe=excluded.total_rpe`,
		p.ID, p.PlayerID, p.Week, days, p.TotalRPE, p.CreatedAt)
	if err != nil {
		return fmt.Errorf("upsert week_plan: %w", err)
	}
	return nil
}

func (d *DB) DeleteWeekPlan(id string) error {
	res, err := d.db.Exec("DELETE FROM week_plans WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete week_plan: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// --- Media ---

func (d *DB) GetAllMedia() ([]models.Media, error) {
	rows, err := d.db.Query("SELECT id, exercise_id, type, data, name, created_at FROM media ORDER BY created_at DESC")
	if err != nil {
		return nil, fmt.Errorf("query media: %w", err)
	}
	defer rows.Close()

	var media []models.Media
	for rows.Next() {
		var m models.Media
		if err := rows.Scan(&m.ID, &m.ExerciseID, &m.Type, &m.Data, &m.Name, &m.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan media: %w", err)
		}
		media = append(media, m)
	}
	if media == nil {
		media = []models.Media{}
	}
	return media, rows.Err()
}

func (d *DB) UpsertMedia(m models.Media) error {
	_, err := d.db.Exec(`
		INSERT INTO media (id, exercise_id, type, data, name, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			exercise_id=excluded.exercise_id, type=excluded.type,
			data=excluded.data, name=excluded.name`,
		m.ID, m.ExerciseID, m.Type, m.Data, m.Name, m.CreatedAt)
	if err != nil {
		return fmt.Errorf("upsert media: %w", err)
	}
	return nil
}

func (d *DB) DeleteMedia(id string) error {
	res, err := d.db.Exec("DELETE FROM media WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete media: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// --- Player Logs ---

func (d *DB) GetPlayerLog(id string) (*models.PlayerLog, error) {
	var l models.PlayerLog
	var entries string
	err := d.db.QueryRow("SELECT id, entries, updated_at FROM player_logs WHERE id = ?", id).
		Scan(&l.ID, &entries, &l.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("query player_log %s: %w", id, err)
	}
	l.Entries = []byte(entries)
	return &l, nil
}

func (d *DB) UpsertPlayerLog(l models.PlayerLog) error {
	entries := string(l.Entries)
	_, err := d.db.Exec(`
		INSERT INTO player_logs (id, entries, updated_at)
		VALUES (?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			entries=excluded.entries, updated_at=excluded.updated_at`,
		l.ID, entries, l.UpdatedAt)
	if err != nil {
		return fmt.Errorf("upsert player_log: %w", err)
	}
	return nil
}

// --- Settings ---

func (d *DB) GetSetting(key string) (*models.Setting, error) {
	var s models.Setting
	err := d.db.QueryRow("SELECT key, value FROM settings WHERE key = ?", key).
		Scan(&s.Key, &s.Value)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("query setting %s: %w", key, err)
	}
	return &s, nil
}

func (d *DB) UpsertSetting(s models.Setting) error {
	_, err := d.db.Exec(`
		INSERT INTO settings (key, value)
		VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
		s.Key, s.Value)
	if err != nil {
		return fmt.Errorf("upsert setting: %w", err)
	}
	return nil
}

// --- Exercises ---

func (d *DB) GetAllExercises() ([]models.Exercise, error) {
	rows, err := d.db.Query("SELECT id, name, body_region, category, tags, equipment, description, created_at, updated_at FROM exercises ORDER BY name")
	if err != nil {
		return nil, fmt.Errorf("query exercises: %w", err)
	}
	defer rows.Close()

	var exercises []models.Exercise
	for rows.Next() {
		var e models.Exercise
		var tags, equip string
		if err := rows.Scan(&e.ID, &e.Name, &e.BodyRegion, &e.Category, &tags, &equip, &e.Description, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan exercise: %w", err)
		}
		json.Unmarshal([]byte(tags), &e.Tags)
		json.Unmarshal([]byte(equip), &e.Equipment)
		if e.Tags == nil {
			e.Tags = []string{}
		}
		if e.Equipment == nil {
			e.Equipment = []string{}
		}
		exercises = append(exercises, e)
	}
	if exercises == nil {
		exercises = []models.Exercise{}
	}
	return exercises, rows.Err()
}

func (d *DB) GetExercise(id string) (*models.Exercise, error) {
	var e models.Exercise
	var tags, equip string
	err := d.db.QueryRow("SELECT id, name, body_region, category, tags, equipment, description, created_at, updated_at FROM exercises WHERE id = ?", id).
		Scan(&e.ID, &e.Name, &e.BodyRegion, &e.Category, &tags, &equip, &e.Description, &e.CreatedAt, &e.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("query exercise %s: %w", id, err)
	}
	json.Unmarshal([]byte(tags), &e.Tags)
	json.Unmarshal([]byte(equip), &e.Equipment)
	if e.Tags == nil {
		e.Tags = []string{}
	}
	if e.Equipment == nil {
		e.Equipment = []string{}
	}
	return &e, nil
}

func (d *DB) UpsertExercise(e models.Exercise) error {
	tagsJSON, _ := json.Marshal(e.Tags)
	equipJSON, _ := json.Marshal(e.Equipment)
	_, err := d.db.Exec(`
		INSERT INTO exercises (id, name, body_region, category, tags, equipment, description, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name, body_region=excluded.body_region, category=excluded.category,
			tags=excluded.tags, equipment=excluded.equipment, description=excluded.description,
			updated_at=excluded.updated_at`,
		e.ID, e.Name, e.BodyRegion, e.Category, string(tagsJSON), string(equipJSON), e.Description, e.CreatedAt, e.UpdatedAt)
	if err != nil {
		return fmt.Errorf("upsert exercise: %w", err)
	}
	return nil
}

func (d *DB) DeleteExercise(id string) error {
	// Delete level assignments first
	d.db.Exec("DELETE FROM level_exercises WHERE exercise_id = ?", id)
	res, err := d.db.Exec("DELETE FROM exercises WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete exercise: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// --- Level Exercises ---

func (d *DB) GetLevelExercises(level string) ([]models.LevelExercise, error) {
	rows, err := d.db.Query("SELECT id, exercise_id, level, block, order_num, default_tempo, default_rpe, default_sxr, default_weight FROM level_exercises WHERE level = ? ORDER BY block, order_num", level)
	if err != nil {
		return nil, fmt.Errorf("query level_exercises: %w", err)
	}
	defer rows.Close()

	var les []models.LevelExercise
	for rows.Next() {
		var le models.LevelExercise
		if err := rows.Scan(&le.ID, &le.ExerciseID, &le.Level, &le.Block, &le.OrderNum, &le.DefaultTempo, &le.DefaultRPE, &le.DefaultSxR, &le.DefaultWeight); err != nil {
			return nil, fmt.Errorf("scan level_exercise: %w", err)
		}
		les = append(les, le)
	}
	if les == nil {
		les = []models.LevelExercise{}
	}
	return les, rows.Err()
}

func (d *DB) GetAllLevelExercises() ([]models.LevelExercise, error) {
	rows, err := d.db.Query("SELECT id, exercise_id, level, block, order_num, default_tempo, default_rpe, default_sxr, default_weight FROM level_exercises ORDER BY level, block, order_num")
	if err != nil {
		return nil, fmt.Errorf("query all level_exercises: %w", err)
	}
	defer rows.Close()

	var les []models.LevelExercise
	for rows.Next() {
		var le models.LevelExercise
		if err := rows.Scan(&le.ID, &le.ExerciseID, &le.Level, &le.Block, &le.OrderNum, &le.DefaultTempo, &le.DefaultRPE, &le.DefaultSxR, &le.DefaultWeight); err != nil {
			return nil, fmt.Errorf("scan level_exercise: %w", err)
		}
		les = append(les, le)
	}
	if les == nil {
		les = []models.LevelExercise{}
	}
	return les, rows.Err()
}

func (d *DB) UpsertLevelExercise(le models.LevelExercise) error {
	_, err := d.db.Exec(`
		INSERT INTO level_exercises (id, exercise_id, level, block, order_num, default_tempo, default_rpe, default_sxr, default_weight)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			exercise_id=excluded.exercise_id, level=excluded.level, block=excluded.block,
			order_num=excluded.order_num, default_tempo=excluded.default_tempo,
			default_rpe=excluded.default_rpe, default_sxr=excluded.default_sxr,
			default_weight=excluded.default_weight`,
		le.ID, le.ExerciseID, le.Level, le.Block, le.OrderNum, le.DefaultTempo, le.DefaultRPE, le.DefaultSxR, le.DefaultWeight)
	if err != nil {
		return fmt.Errorf("upsert level_exercise: %w", err)
	}
	return nil
}

func (d *DB) DeleteLevelExercise(id string) error {
	res, err := d.db.Exec("DELETE FROM level_exercises WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete level_exercise: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (d *DB) DeleteLevelExercisesByExercise(exerciseID string) error {
	_, err := d.db.Exec("DELETE FROM level_exercises WHERE exercise_id = ?", exerciseID)
	return err
}

// --- Progressions ---

func (d *DB) GetAllProgressions() ([]models.Progression, error) {
	rows, err := d.db.Query("SELECT id, name, body_region, steps, created_at, updated_at FROM progressions ORDER BY body_region, name")
	if err != nil {
		return nil, fmt.Errorf("query progressions: %w", err)
	}
	defer rows.Close()

	var progs []models.Progression
	for rows.Next() {
		var p models.Progression
		var steps string
		if err := rows.Scan(&p.ID, &p.Name, &p.BodyRegion, &steps, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan progression: %w", err)
		}
		p.Steps = []byte(steps)
		progs = append(progs, p)
	}
	if progs == nil {
		progs = []models.Progression{}
	}
	return progs, rows.Err()
}

func (d *DB) GetProgression(id string) (*models.Progression, error) {
	var p models.Progression
	var steps string
	err := d.db.QueryRow("SELECT id, name, body_region, steps, created_at, updated_at FROM progressions WHERE id = ?", id).
		Scan(&p.ID, &p.Name, &p.BodyRegion, &steps, &p.CreatedAt, &p.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("query progression %s: %w", id, err)
	}
	p.Steps = []byte(steps)
	return &p, nil
}

func (d *DB) UpsertProgression(p models.Progression) error {
	steps := string(p.Steps)
	_, err := d.db.Exec(`
		INSERT INTO progressions (id, name, body_region, steps, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name, body_region=excluded.body_region,
			steps=excluded.steps, updated_at=excluded.updated_at`,
		p.ID, p.Name, p.BodyRegion, steps, p.CreatedAt, p.UpdatedAt)
	if err != nil {
		return fmt.Errorf("upsert progression: %w", err)
	}
	return nil
}

func (d *DB) DeleteProgression(id string) error {
	res, err := d.db.Exec("DELETE FROM progressions WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete progression: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}
