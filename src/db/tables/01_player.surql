-- ------------------------------------------------------------------------------
-- Table: player
-- Tracks player wallets, aliases, lifetime attempts, best times, and whitelist status
-- ------------------------------------------------------------------------------

DEFINE TABLE OVERWRITE player SCHEMAFULL
    PERMISSIONS
        FOR select FULL
        FOR create, update, delete NONE;

DEFINE FIELD OVERWRITE wallet ON player TYPE string
    ASSERT string::is::alphanumeric(string::slice($value, 2)) AND string::starts_with($value, '0x');

DEFINE FIELD OVERWRITE username ON player TYPE string
    ASSERT string::len($value) >= 3 AND string::len($value) <= 24;

DEFINE FIELD OVERWRITE total_runs ON player TYPE number 
    DEFAULT 0
    ASSERT $value >= 0;

DEFINE FIELD OVERWRITE best_time ON player TYPE option<number>
    ASSERT $value == NONE OR $value > 0;

DEFINE FIELD OVERWRITE is_whitelisted ON player TYPE bool 
    DEFAULT false;

DEFINE FIELD OVERWRITE created_at ON player TYPE datetime 
    VALUE $before.created_at OR time::now();

DEFINE FIELD OVERWRITE updated_at ON player TYPE datetime 
    VALUE time::now();

DEFINE INDEX OVERWRITE idx_player_wallet ON player FIELDS wallet UNIQUE;