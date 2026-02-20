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
