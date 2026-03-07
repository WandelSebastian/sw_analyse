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

type ExerciseHandler struct {
	DB *storage.DB
}

func (h *ExerciseHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	exercises, err := h.DB.GetAllExercises()
	if err != nil {
		slog.Error("failed to get exercises", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(exercises)
}

func (h *ExerciseHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ex, err := h.DB.GetExercise(id)
	if err != nil {
		slog.Error("failed to get exercise", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if ex == nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ex)
}

func (h *ExerciseHandler) Create(w http.ResponseWriter, r *http.Request) {
	var e models.Exercise
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if e.ID == "" {
		e.ID = generateID()
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if e.CreatedAt == "" {
		e.CreatedAt = now
	}
	e.UpdatedAt = now
	if e.Tags == nil {
		e.Tags = []string{}
	}
	if e.Equipment == nil {
		e.Equipment = []string{}
	}

	if err := h.DB.UpsertExercise(e); err != nil {
		slog.Error("failed to create exercise", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(e)
}

func (h *ExerciseHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	var e models.Exercise
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	e.ID = id
	e.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	if e.Tags == nil {
		e.Tags = []string{}
	}
	if e.Equipment == nil {
		e.Equipment = []string{}
	}

	if err := h.DB.UpsertExercise(e); err != nil {
		slog.Error("failed to update exercise", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(e)
}

func (h *ExerciseHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.DB.DeleteExercise(id); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		slog.Error("failed to delete exercise", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
