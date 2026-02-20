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

type WeekPlanHandler struct {
	DB *storage.DB
}

func (h *WeekPlanHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	plans, err := h.DB.GetAllWeekPlans()
	if err != nil {
		slog.Error("failed to get week plans", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(plans)
}

func (h *WeekPlanHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}

	plan, err := h.DB.GetWeekPlan(id)
	if err != nil {
		slog.Error("failed to get week plan", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if plan == nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(plan)
}

func (h *WeekPlanHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}

	var p models.WeekPlan
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		slog.Warn("invalid request body", "error", err)
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	p.ID = id
	if p.CreatedAt == "" {
		p.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	}

	if err := h.DB.UpsertWeekPlan(p); err != nil {
		slog.Error("failed to update week plan", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func (h *WeekPlanHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}

	if err := h.DB.DeleteWeekPlan(id); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		slog.Error("failed to delete week plan", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
