package handlers

import (
	"database/sql"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/MeKo-Tech/go-react/internal/models"
	"github.com/MeKo-Tech/go-react/internal/storage"
)

type LevelExerciseHandler struct {
	DB *storage.DB
}

func (h *LevelExerciseHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	level := r.URL.Query().Get("level")
	var (
		les []models.LevelExercise
		err error
	)
	if level != "" {
		les, err = h.DB.GetLevelExercises(level)
	} else {
		les, err = h.DB.GetAllLevelExercises()
	}
	if err != nil {
		slog.Error("failed to get level exercises", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(les)
}

func (h *LevelExerciseHandler) Create(w http.ResponseWriter, r *http.Request) {
	var le models.LevelExercise
	if err := json.NewDecoder(r.Body).Decode(&le); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if le.ID == "" {
		le.ID = generateID()
	}
	if err := h.DB.UpsertLevelExercise(le); err != nil {
		slog.Error("failed to create level exercise", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(le)
}

func (h *LevelExerciseHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	var le models.LevelExercise
	if err := json.NewDecoder(r.Body).Decode(&le); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	le.ID = id
	if err := h.DB.UpsertLevelExercise(le); err != nil {
		slog.Error("failed to update level exercise", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(le)
}

func (h *LevelExerciseHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.DB.DeleteLevelExercise(id); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		slog.Error("failed to delete level exercise", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
