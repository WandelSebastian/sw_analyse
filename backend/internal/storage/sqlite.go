package storage

import (
	"database/sql"
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
