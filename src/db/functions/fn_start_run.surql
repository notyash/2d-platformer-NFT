-- ==============================================================================
-- Function: fn::start_run
-- Generates a unique runId, starts session timer, and initializes player record
-- ==============================================================================

DEFINE FUNCTION OVERWRITE fn::start_run($wallet: string, $stage: string) {
    LET $now = time::unix(time::now()) * 1000;
    LET $rand_id = string::concat('run_', string::slice(type::string(time::unix(time::now())), 4), '_', rand::string(6));
    LET $actual_wallet = $auth.wallet OR $wallet;
    LET $player_id = type::record('player', $actual_wallet);
    
    -- Register run session with deterministic ID (run_session:run_...) and typed player pointer
    LET $session_id = type::record('run_session', $rand_id);
    CREATE $session_id SET
        run_id           = $rand_id,
        player           = $player_id,
        wallet           = $actual_wallet,
        stage            = $stage,
        start_time       = $now,
        is_finalized     = false,
        verified         = false,
        validation_flags = [];

    -- O(1) Direct Key-Value Player Lookup & Upsert
    LET $existing_player = (SELECT * FROM ONLY $player_id);
    IF $existing_player == NONE {
        CREATE $player_id SET
            wallet         = $actual_wallet,
            username       = string::concat('Player_', string::slice($actual_wallet, 0, 6)),
            total_runs     = 1,
            is_whitelisted = false;
    } ELSE {
        UPDATE $player_id SET total_runs += 1;
    };

    RETURN {
        run_id: $rand_id,
        start_time: $now,
        stage: $stage
    };
};
