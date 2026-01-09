use tauri_plugin_sql::{Migration, MigrationKind};

/// Adds URL field to tasks table for RFC 7986 support
/// The URL property allows tasks to link to external resources
pub fn migration() -> Migration {
    Migration {
        version: 3,
        description: "add_url_field_to_tasks",
        sql: r#"
            -- Add URL field for RFC 7986 support
            ALTER TABLE tasks ADD COLUMN url TEXT;
        "#,
        kind: MigrationKind::Up,
    }
}
