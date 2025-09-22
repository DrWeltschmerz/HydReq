package runner

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/DrWeltschmerz/HydReq/pkg/models"
)

func TestSQLHook_SQLiteMemory(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	s := &models.Suite{Name: "sql-hooks"}
	vars := map[string]string{}

	// persistent sqlite file to allow separate connections per hook
	dir := t.TempDir()
	dsn := "file:" + filepath.Join(dir, "qa_test.sqlite") + "?cache=shared"

	// create table
	if err := runHook(ctx, s, &vars, models.Hook{
		Name: "create",
		SQL: &models.SQLHook{
			Driver: "sqlite",
			DSN:    dsn,
			Query: `CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT,
                created TEXT
            );`,
		},
	}, Options{}); err != nil {
		t.Fatalf("create table: %v", err)
	}

	// insert row with generators
	if err := runHook(ctx, s, &vars, models.Hook{
		Name: "insert",
		SQL: &models.SQLHook{
			Driver: "sqlite",
			DSN:    dsn,
			Query:  `INSERT INTO users(id, email, created) VALUES ('${FAKE:uuid}', '${EMAIL}', '${NOW:2006-01-02T15:04:05Z07:00}')`,
		},
	}, Options{}); err != nil {
		t.Fatalf("insert row: %v", err)
	}

	// select and extract
	if err := runHook(ctx, s, &vars, models.Hook{
		Name: "select",
		SQL: &models.SQLHook{
			Driver:  "sqlite",
			DSN:     dsn,
			Query:   `SELECT id, email, created FROM users ORDER BY created DESC LIMIT 1;`,
			Extract: map[string]string{"uid": "id", "uemail": "email"},
		},
	}, Options{}); err != nil {
		t.Fatalf("select row: %v", err)
	}

	if vars["uid"] == "" {
		t.Fatalf("expected extracted uid")
	}
	if vars["uemail"] == "" || vars["uemail"] == "null" {
		t.Fatalf("expected extracted email, got %q", vars["uemail"])
	}
}
