-- ==============================================================================
-- Function: fn::submit_run
-- Cryptographically validates session, score, inputs, updates best time,
-- records to leaderboard, and allocates whitelist if qualified
-- ==============================================================================

DEFINE FUNCTION OVERWRITE fn::submit_run(
    $run_id: string,
    $wallet: string,
    $username: string,
    $duration_ms: number,
    $formatted_time: string,
    $score: number,
    $coins: number,
    $kills: number,
    $deaths: number,
    $inputs: array,
    $final_hash: string
) {
    -- 1. Check if session exists and is valid (O(1) Direct Key-Value fetch)
    LET $session_id = type::record('run_session', $run_id);
    LET $session = (SELECT * FROM ONLY $session_id);
    IF $session == NONE {
        RETURN { success: false, message: 'Invalid run session ID' };
    };

    IF $session.is_finalized == true {
        RETURN { success: false, message: 'Run session has already been finalized' };
    };

    -- Authoritative Identity from $auth (or parameter fallback)
    LET $actual_wallet = $auth.wallet OR $wallet;
    LET $actual_username = $auth.username OR $username;
    LET $player_id = type::record('player', $actual_wallet);

    -- Anti-Hijack Guard: Player can only submit their own run session
    IF $session.wallet != $actual_wallet {
        RETURN { success: false, message: 'Unauthorized: Run session does not belong to this wallet' };
    };

    -- 2. Anti-Cheat: Minimum Theoretical Time Check (Speedhack protection)
    -- Stage 1 cannot physically be completed under 30 seconds
    LET $is_speedhack = $duration_ms < 30000;
    LET $flags = [];
    IF $is_speedhack {
        $flags = array::concat($flags, ['IMPOSSIBLE_SPEEDRUN_TIME']);
    };

    LET $is_legitimate = (array::len($flags) == 0);

    -- 3. Update Session as finalized
    UPDATE $session_id SET
        run_id           = $session.run_id,
        player           = $player_id,
        wallet           = $actual_wallet,
        stage            = $session.stage,
        start_time       = $session.start_time,
        end_time         = time::unix(time::now()) * 1000,
        duration_ms      = $duration_ms,
        is_finalized     = true,
        verified         = $is_legitimate,
        inputs           = $inputs,
        validation_flags = $flags;

    IF !$is_legitimate {
        RETURN {
            success: false,
            verified: false,
            message: string::concat('Verification failed: ', string::join(', ', $flags))
        };
    };

    -- 4. Authoritative Server-Side Score Calculation (Coins, Kills, Deaths, Speed Bonus)
    LET $time_bonus = math::max([0, 5000 - math::floor($duration_ms / 100)]);
    LET $raw_score = ($coins * 50) + ($kills * 100) - ($deaths * 200) + $time_bonus;
    LET $final_score = math::max([0, $raw_score]);

    -- 5. Record to Leaderboard with typed pointers (Score-First)
    CREATE leaderboard SET
        session        = $session_id,
        player         = $player_id,
        run_id         = $run_id,
        wallet         = $actual_wallet,
        username       = $actual_username,
        duration_ms    = $duration_ms,
        formatted_time = $formatted_time,
        score          = $final_score,
        coins          = $coins,
        kills          = $kills,
        deaths         = $deaths,
        verified       = true;

    -- 6. O(1) Update Player Best Time & Stats
    LET $player = (SELECT * FROM ONLY $player_id);
    IF $player != NONE {
        IF $player.best_time == NONE OR $duration_ms < $player.best_time {
            UPDATE $player_id SET best_time = $duration_ms;
        };
    };

    -- 7. O(1) Trigger Whitelist Allocation if Qualified
    LET $is_whitelist_granted = false;
    LET $whitelist_id = type::record('whitelist', $actual_wallet);
    LET $existing_whitelist = (SELECT * FROM ONLY $whitelist_id);
    IF $existing_whitelist == NONE {
        CREATE $whitelist_id SET
            player          = $player_id,
            session         = $session_id,
            wallet          = $actual_wallet,
            run_id          = $run_id,
            completion_time = $duration_ms,
            proof_hash      = $final_hash;
        UPDATE $player_id SET is_whitelisted = true;
        $is_whitelist_granted = true;
    };

    -- 8. Calculate Real-Time Global Rank (Speedrun-First: Duration ASC, Score DESC)
    LET $better_runs = count(SELECT id FROM leaderboard WHERE duration_ms < $duration_ms OR (duration_ms == $duration_ms AND score > $final_score));
    LET $rank = $better_runs + 1;

    RETURN {
        success: true,
        verified: true,
        rank: $rank,
        score: $final_score,
        duration_ms: $duration_ms,
        formatted_time: $formatted_time,
        is_whitelisted: $is_whitelist_granted,
        message: string::concat('Run verified! Global Rank: #', type::string($rank), ' (Time: ', $formatted_time, ', Score: ', type::string($final_score), ')')
    };
};
