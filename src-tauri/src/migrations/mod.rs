mod v001_initial_tables;
mod v002_nullable_account_calendar;
mod v003_add_url_field;

use tauri_plugin_sql::Migration;

pub use v001_initial_tables::migration as migration_v001;
pub use v002_nullable_account_calendar::migration as migration_v002;
pub use v003_add_url_field::migration as migration_v003;

/// Returns all database migrations for the application
pub fn get_migrations() -> Vec<Migration> {
    vec![migration_v001(), migration_v002(), migration_v003()]
}
