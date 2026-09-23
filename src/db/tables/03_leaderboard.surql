-- ------------------------------------------------------------------------------
-- Table: leaderboard
-- Stores verified global speedruns, scores, and statistics
-- ------------------------------------------------------------------------------

DEFINE TABLE OVERWRITE leaderboard SCHEMAFULL
    PERMISSIONS
        FOR select FULL
        FOR create, update, delete NONE;

-- Typed Record Pointers
DEFINE FIELD OVERWRITE session        ON leaderboard TYPE record<run_session>;
DEFINE FIELD OVERWRITE player         ON leaderboard TYPE record<player>;

-- String Identifiers & Denormalized Data
DEFINE FIELD OVERWRITE run_id         ON leaderboard TYPE string;
DEFINE FIELD OVERWRITE wallet         ON leaderboard TYPE string;
DEFINE FIELD OVERWRITE username       ON leaderboard TYPE string;
DEFINE FIELD OVERWRITE duration_ms    ON leaderboard TYPE number
    ASSERT $value >= 30000;

DEFINE FIELD OVERWRITE formatted_time ON leaderboard TYPE string;
DEFINE FIELD OVERWRITE score          ON leaderboard TYPE number
    ASSERT $value >= 0;

DEFINE FIELD OVERWRITE coins          ON leaderboard TYPE number 
    DEFAULT 0
    ASSERT $value >= 0;

DEFINE FIELD OVERWRITE kills          ON leaderboard TYPE number 
    DEFAULT 0
    ASSERT $value >= 0;

DEFINE FIELD OVERWRITE deaths         ON leaderboard TYPE number 
    DEFAULT 0
    ASSERT $value >= 0;

DEFINE FIELD OVERWRITE verified       ON leaderboard TYPE bool 
    DEFAULT true;

DEFINE FIELD OVERWRITE created_at     ON leaderboard TYPE datetime 
    VALUE $before.created_at OR time::now();

-- Compound Performance Index for instant Speedrun Leaderboard Sorting
DEFINE INDEX OVERWRITE idx_leaderboard_rank ON leaderboard FIELDS duration_ms, score;
