package handlers

import (
	"database/sql"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/MeKo-Tech/go-react/internal/models"
	"github.com/MeKo-Tech/go-react/internal/storage"
)

type ProgressionHandler struct {
	DB *storage.DB
}

func (h *ProgressionHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	progs, err := h.DB.GetAllProgressions()
	if err != nil {
		slog.Error("failed to get progressions", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(progs)
}

func (h *ProgressionHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	p, err := h.DB.GetProgression(id)
	if err != nil {
		slog.Error("failed to get progression", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if p == nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func (h *ProgressionHandler) Create(w http.ResponseWriter, r *http.Request) {
	var p models.Progression
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
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
	if p.Steps == nil {
		p.Steps = []byte("[]")
	}

	if err := h.DB.UpsertProgression(p); err != nil {
		slog.Error("failed to create progression", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(p)
}

func (h *ProgressionHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	var p models.Progression
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	p.ID = id
	p.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	if p.Steps == nil {
		p.Steps = []byte("[]")
	}

	if err := h.DB.UpsertProgression(p); err != nil {
		slog.Error("failed to update progression", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func (h *ProgressionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.DB.DeleteProgression(id); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		slog.Error("failed to delete progression", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
