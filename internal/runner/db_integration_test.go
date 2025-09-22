package runner

import (
	"context"
	"database/sql"
	"os"
	"testing"
	"time"
)

// TestPGIntegration runs only when PG_DSN is set.
func TestPGIntegration(t *testing.T) {
	dsn := os.Getenv("PG_DSN")
	if dsn == "" {
		t.Skip("PG_DSN not set; skipping Postgres integration test")
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatalf("pg open: %v", err)
	}
	defer db.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if _, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS qa_ci_items(id SERIAL PRIMARY KEY, name TEXT)`); err != nil {
		t.Fatalf("pg create: %v", err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO qa_ci_items(name) VALUES ('a')`); err != nil {
		t.Fatalf("pg insert: %v", err)
	}
	var cnt int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM qa_ci_items`).Scan(&cnt); err != nil {
		t.Fatalf("pg select: %v", err)
	}
	if cnt <= 0 {
		t.Fatalf("expected rows > 0, got %d", cnt)
	}
}

// TestMSSQLIntegration runs only when MSSQL_DSN is set.
func TestMSSQLIntegration(t *testing.T) {
	dsn := os.Getenv("MSSQL_DSN")
	if dsn == "" {
		t.Skip("MSSQL_DSN not set; skipping SQL Server integration test")
	}
	db, err := sql.Open("sqlserver", dsn)
	if err != nil {
		t.Fatalf("mssql open: %v", err)
	}
	defer db.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if _, err := db.ExecContext(ctx, `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='qa_ci_items' and xtype='U') CREATE TABLE qa_ci_items(id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(100))`); err != nil {
		t.Fatalf("mssql create: %v", err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO qa_ci_items(name) VALUES ('a')`); err != nil {
		t.Fatalf("mssql insert: %v", err)
	}
	var cnt int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM qa_ci_items`).Scan(&cnt); err != nil {
		t.Fatalf("mssql select: %v", err)
	}
	if cnt <= 0 {
		t.Fatalf("expected rows > 0, got %d", cnt)
	}
}
