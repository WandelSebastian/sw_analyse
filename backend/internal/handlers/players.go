package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/MeKo-Tech/go-react/internal/models"
	"github.com/MeKo-Tech/go-react/internal/storage"
)

type PlayerHandler struct {
	DB *storage.DB
}

func (h *PlayerHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	players, err := h.DB.GetAllPlayers()
	if err != nil {
		slog.Error("failed to get players", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(players)
}

func (h *PlayerHandler) Create(w http.ResponseWriter, r *http.Request) {
	var p models.Player
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		slog.Warn("invalid request body", "error", err)
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if p.ID == "" {
		p.ID = generateID()
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if p.CreatedAt == "" {
		p.CreatedAt = now
	}
	p.UpdatedAt = now

	if err := h.DB.UpsertPlayer(p); err != nil {
		slog.Error("failed to create player", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(p)
}

func (h *PlayerHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}

	var p models.Player
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		slog.Warn("invalid request body", "error", err)
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	p.ID = id
	p.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if err := h.DB.UpsertPlayer(p); err != nil {
		slog.Error("failed to update player", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func (h *PlayerHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}

	if err := h.DB.DeletePlayer(id); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		slog.Error("failed to delete player", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func generateID() string {
	b := make([]byte, 3)
	rand.Read(b)
	return fmt.Sprintf("%d%s", time.Now().UnixMilli(), hex.EncodeToString(b))
}
