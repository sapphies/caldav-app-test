use tauri_plugin_sql::{Migration, MigrationKind};

/// Initial database schema - creates all core tables
pub fn migration() -> Migration {
    Migration {
        version: 1,
        description: "create_initial_tables",
        sql: r#"
            -- Accounts table
            CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                server_url TEXT NOT NULL,
                username TEXT NOT NULL,
                password TEXT NOT NULL,
                server_type TEXT,
                last_sync TEXT,
                is_active INTEGER NOT NULL DEFAULT 1
            );

            -- Calendars table
            CREATE TABLE IF NOT EXISTS calendars (
                id TEXT PRIMARY KEY NOT NULL,
                account_id TEXT NOT NULL,
                display_name TEXT NOT NULL,
                url TEXT NOT NULL,
                ctag TEXT,
                sync_token TEXT,
                color TEXT,
                icon TEXT,
                supported_components TEXT,
                FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
            );

            -- Tasks table
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY NOT NULL,
                uid TEXT NOT NULL UNIQUE,
                etag TEXT,
                href TEXT,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                completed INTEGER NOT NULL DEFAULT 0,
                completed_at TEXT,
                tags TEXT,
                category_id TEXT,
                priority TEXT NOT NULL DEFAULT 'none',
                start_date TEXT,
                start_date_all_day INTEGER,
                due_date TEXT,
                due_date_all_day INTEGER,
                created_at TEXT NOT NULL,
                modified_at TEXT NOT NULL,
                reminders TEXT,
                subtasks TEXT NOT NULL DEFAULT '[]',
                parent_uid TEXT,
                is_collapsed INTEGER DEFAULT 0,
                sort_order INTEGER NOT NULL,
                account_id TEXT NOT NULL,
                calendar_id TEXT NOT NULL,
                synced INTEGER NOT NULL DEFAULT 0,
                local_only INTEGER DEFAULT 0,
                FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
                FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
            );

            -- Tags table
            CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                color TEXT NOT NULL,
                icon TEXT
            );

            -- Pending deletions table
            CREATE TABLE IF NOT EXISTS pending_deletions (
                uid TEXT PRIMARY KEY NOT NULL,
                href TEXT NOT NULL,
                account_id TEXT NOT NULL,
                calendar_id TEXT NOT NULL
            );

            -- UI State table (single row)
            CREATE TABLE IF NOT EXISTS ui_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                active_account_id TEXT,
                active_calendar_id TEXT,
                active_tag_id TEXT,
                selected_task_id TEXT,
                search_query TEXT NOT NULL DEFAULT '',
                sort_mode TEXT NOT NULL DEFAULT 'manual',
                sort_direction TEXT NOT NULL DEFAULT 'asc',
                show_completed_tasks INTEGER NOT NULL DEFAULT 1,
                is_editor_open INTEGER NOT NULL DEFAULT 0
            );

            -- Insert default UI state row
            INSERT OR IGNORE INTO ui_state (id) VALUES (1);

            -- Indexes for better performance
            CREATE INDEX IF NOT EXISTS idx_tasks_calendar_id ON tasks(calendar_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_account_id ON tasks(account_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_parent_uid ON tasks(parent_uid);
            CREATE INDEX IF NOT EXISTS idx_tasks_uid ON tasks(uid);
            CREATE INDEX IF NOT EXISTS idx_calendars_account_id ON calendars(account_id);
        "#,
        kind: MigrationKind::Up,
    }
}
