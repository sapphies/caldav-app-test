use tauri_plugin_sql::{Migration, MigrationKind};

/// Makes account_id and calendar_id nullable in tasks table
/// to support local-only tasks without a CalDAV account
pub fn migration() -> Migration {
    Migration {
        version: 2,
        description: "make_task_account_calendar_nullable",
        sql: r#"
            -- Create new tasks table with nullable account_id and calendar_id
            CREATE TABLE tasks_new (
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
                account_id TEXT,
                calendar_id TEXT,
                synced INTEGER NOT NULL DEFAULT 0,
                local_only INTEGER DEFAULT 0,
                FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
                FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
            );

            -- Copy data from old table to new table
            INSERT INTO tasks_new SELECT * FROM tasks;

            -- Drop old table
            DROP TABLE tasks;

            -- Rename new table to tasks
            ALTER TABLE tasks_new RENAME TO tasks;

            -- Recreate indexes
            CREATE INDEX idx_tasks_calendar_id ON tasks(calendar_id);
            CREATE INDEX idx_tasks_account_id ON tasks(account_id);
            CREATE INDEX idx_tasks_parent_uid ON tasks(parent_uid);
            CREATE INDEX idx_tasks_uid ON tasks(uid);
        "#,
        kind: MigrationKind::Up,
    }
}
