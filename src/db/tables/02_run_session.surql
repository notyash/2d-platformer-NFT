-- ------------------------------------------------------------------------------
-- Table: run_session
-- Stores single-use session tokens, start/end timestamps, input stream, and audit flags
-- ------------------------------------------------------------------------------

DEFINE TABLE OVERWRITE run_session SCHEMAFULL
    PERMISSIONS
        FOR select WHERE wallet = $auth.wallet
        FOR create, update, delete NONE;

DEFINE FIELD OVERWRITE run_id ON run_session TYPE string
    ASSERT string::len($value) >= 6;

DEFINE FIELD OVERWRITE player ON run_session TYPE record<player>;

DEFINE FIELD OVERWRITE wallet ON run_session TYPE string
    VALUE $auth.wallet OR $value
    ASSERT string::starts_with($value, '0x');

DEFINE FIELD OVERWRITE stage ON run_session TYPE string 
    DEFAULT 'stage1'
    ASSERT string::len($value) > 0;

DEFINE FIELD OVERWRITE start_time ON run_session TYPE number
    ASSERT $value > 0;

DEFINE FIELD OVERWRITE end_time ON run_session TYPE option<number>
    ASSERT $value == NONE OR $value >= start_time;

DEFINE FIELD OVERWRITE duration_ms ON run_session TYPE option<number>
    ASSERT $value == NONE OR $value >= 0;

DEFINE FIELD OVERWRITE is_finalized ON run_session TYPE bool 
    DEFAULT false;

DEFINE FIELD OVERWRITE verified ON run_session TYPE bool 
    DEFAULT false;

DEFINE FIELD OVERWRITE inputs ON run_session TYPE option<array>;

DEFINE FIELD OVERWRITE validation_flags ON run_session TYPE array 
    DEFAULT [];

DEFINE FIELD OVERWRITE created_at ON run_session TYPE datetime 
    VALUE $before.created_at OR time::now();

DEFINE INDEX OVERWRITE idx_run_id ON run_session FIELDS run_id UNIQUE;
