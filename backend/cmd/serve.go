package cmd

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/MeKo-Tech/go-react/internal/handlers"
	"github.com/MeKo-Tech/go-react/internal/storage"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "Start the HTTP server",
	RunE:  runServe,
}

func init() {
	rootCmd.AddCommand(serveCmd)
}

func runServe(cmd *cobra.Command, args []string) error {
	dbPath := viper.GetString("database.path")
	port := viper.GetInt("server.port")

	db, err := storage.NewDB(dbPath)
	if err != nil {
		return fmt.Errorf("initialize database: %w", err)
	}
	defer db.Close()

	mux := http.NewServeMux()
	registerRoutes(mux, db)

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", port),
		Handler:      corsMiddleware(mux),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		slog.Info("server starting", "port", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down server")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("server shutdown: %w", err)
	}

	slog.Info("server stopped")
	return nil
}

func registerRoutes(mux *http.ServeMux, db *storage.DB) {
	// Health
	mux.HandleFunc("GET /healthz", handlers.HandleHealth)

	// Players
	ph := &handlers.PlayerHandler{DB: db}
	mux.HandleFunc("GET /api/v1/players", ph.GetAll)
	mux.HandleFunc("POST /api/v1/players", ph.Create)
	mux.HandleFunc("PUT /api/v1/players/{id}", ph.Update)
	mux.HandleFunc("DELETE /api/v1/players/{id}", ph.Delete)

	// Week Plans
	wh := &handlers.WeekPlanHandler{DB: db}
	mux.HandleFunc("GET /api/v1/week-plans", wh.GetAll)
	mux.HandleFunc("GET /api/v1/week-plans/{id}", wh.Get)
	mux.HandleFunc("PUT /api/v1/week-plans/{id}", wh.Update)
	mux.HandleFunc("DELETE /api/v1/week-plans/{id}", wh.Delete)

	// Media
	mh := &handlers.MediaHandler{DB: db}
	mux.HandleFunc("GET /api/v1/media", mh.GetAll)
	mux.HandleFunc("POST /api/v1/media", mh.Create)
	mux.HandleFunc("DELETE /api/v1/media/{id}", mh.Delete)

	// Player Logs
	plh := &handlers.PlayerLogHandler{DB: db}
	mux.HandleFunc("GET /api/v1/player-logs/{key}", plh.Get)
	mux.HandleFunc("PUT /api/v1/player-logs/{key}", plh.Update)

	// Settings
	sh := &handlers.SettingHandler{DB: db}
	mux.HandleFunc("GET /api/v1/settings/{key}", sh.Get)
	mux.HandleFunc("PUT /api/v1/settings/{key}", sh.Update)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
