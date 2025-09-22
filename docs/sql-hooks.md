# SQL hooks

Use SQL within hooks to seed or read state.

Example (sqlite):
```
preSuite:
  - name: create table
    sql:
      driver: sqlite
      dsn: file:./qa.sqlite?cache=shared
      query: |
        CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY,
          content TEXT,
          created TEXT
        );

tests:
  - name: insert and select
    pre:
      - name: insert row
        sql:
          driver: sqlite
          dsn: file:./qa.sqlite?cache=shared
          query: |
            INSERT INTO notes(id, content, created) VALUES ('${FAKE:uuid}', 'hello ${RANDINT:1:9}', '${NOW:2006-01-02T15:04:05Z07:00}');
      - name: read one
        sql:
          driver: sqlite
          dsn: file:./qa.sqlite?cache=shared
          query: |
            SELECT id, content, created FROM notes ORDER BY created DESC LIMIT 1;
          extract:
            lastId: id
            lastContent: content
```

DSN quick refs:
- sqlite: `file:./qa.sqlite?cache=shared`
- pgx: `postgres://user:pass@host:5432/db?sslmode=disable`
- sqlserver: `sqlserver://user:pass@host:1433?database=db`
