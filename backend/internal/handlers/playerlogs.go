package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/MeKo-Tech/go-react/internal/models"
	"github.com/MeKo-Tech/go-react/internal/storage"
)

type PlayerLogHandler struct {
	DB *storage.DB
}

func (h *PlayerLogHandler) Get(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	if key == "" {
		http.Error(w, "missing key", http.StatusBadRequest)
		return
	}

	log, err := h.DB.GetPlayerLog(key)
	if err != nil {
		slog.Error("failed to get player log", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if log == nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(log)
}

func (h *PlayerLogHandler) Update(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	if key == "" {
		http.Error(w, "missing key", http.StatusBadRequest)
		return
	}

	var l models.PlayerLog
	if err := json.NewDecoder(r.Body).Decode(&l); err != nil {
		slog.Warn("invalid request body", "error", err)
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	l.ID = key
	l.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if err := h.DB.UpsertPlayerLog(l); err != nil {
		slog.Error("failed to update player log", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(l)
}
