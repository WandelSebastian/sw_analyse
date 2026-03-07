package models

import "encoding/json"

type Player struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Height    *string `json:"height,omitempty"`
	Weight    *string `json:"weight,omitempty"`
	Level     string  `json:"level"`
	DOB       *string `json:"dob,omitempty"`
	Notes     string  `json:"notes"`
	CreatedAt string  `json:"createdAt"`
	UpdatedAt string  `json:"updatedAt"`
}

type WeekPlan struct {
	ID        string          `json:"id"`
	PlayerID  string          `json:"playerId"`
	Week      string          `json:"week"`
	Days      json.RawMessage `json:"days"`
	TotalRPE  int             `json:"totalRPE"`
	CreatedAt string          `json:"createdAt"`
}

type Media struct {
	ID         string `json:"id"`
	ExerciseID string `json:"exerciseId"`
	Type       string `json:"type"`
	Data       string `json:"data"`
	Name       string `json:"name"`
	CreatedAt  string `json:"createdAt"`
}

type PlayerLog struct {
	ID        string          `json:"id"`
	Entries   json.RawMessage `json:"entries"`
	UpdatedAt string          `json:"updatedAt"`
}

type Setting struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// Exercise is a unique exercise in the master library.
type Exercise struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	BodyRegion  string   `json:"bodyRegion"`  // lowerBody, upperBody, core, fullBody
	Category    string   `json:"category"`    // BH, KV, K, P, EX, ISO
	Tags        []string `json:"tags"`        // free-form tags for filtering
	Equipment   []string `json:"equipment"`   // optional equipment list
	Description string   `json:"description"` // free text
	CreatedAt   string   `json:"createdAt"`
	UpdatedAt   string   `json:"updatedAt"`
}

// Progression represents an exercise progression chain across levels.
type Progression struct {
	ID         string          `json:"id"`
	Name       string          `json:"name"`
	BodyRegion string          `json:"bodyRegion"` // lowerBody, upperBody, warmup
	Steps      json.RawMessage `json:"steps"`      // [{level, exerciseId?, exerciseName}]
	CreatedAt  string          `json:"createdAt"`
	UpdatedAt  string          `json:"updatedAt"`
}

// LevelExercise assigns an exercise to a level with specific training parameters.
type LevelExercise struct {
	ID            string `json:"id"`
	ExerciseID    string `json:"exerciseId"`
	Level         string `json:"level"`
	Block         string `json:"block"` // ukk, okk, ukex, okex, ukp, okp, ukiso, okiso, ukbh, okbh, ukkv, okkv
	OrderNum      int    `json:"order"`
	DefaultTempo  string `json:"defaultTempo,omitempty"`
	DefaultRPE    string `json:"defaultRPE,omitempty"`
	DefaultSxR    string `json:"defaultSxR,omitempty"`
	DefaultWeight string `json:"defaultWeight,omitempty"`
}
