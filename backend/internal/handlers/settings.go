package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/MeKo-Tech/go-react/internal/models"
	"github.com/MeKo-Tech/go-react/internal/storage"
)

type SettingHandler struct {
	DB *storage.DB
}

func (h *SettingHandler) Get(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	if key == "" {
		http.Error(w, "missing key", http.StatusBadRequest)
		return
	}

	s, err := h.DB.GetSetting(key)
	if err != nil {
		slog.Error("failed to get setting", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if s == nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}

func (h *SettingHandler) Update(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	if key == "" {
		http.Error(w, "missing key", http.StatusBadRequest)
		return
	}

	var s models.Setting
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		slog.Warn("invalid request body", "error", err)
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	s.Key = key

	if err := h.DB.UpsertSetting(s); err != nil {
		slog.Error("failed to update setting", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}
