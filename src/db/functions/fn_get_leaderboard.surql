-- ==============================================================================
-- Function: fn::get_leaderboard
-- Returns top verified runs ordered by duration_ms ASC, score DESC
-- ==============================================================================

DEFINE FUNCTION OVERWRITE fn::get_leaderboard($limit: number) {
    LET $top_entries = (
        SELECT 
            run_id, 
            wallet, 
            username, 
            duration_ms, 
            formatted_time, 
            score, 
            coins, 
            kills, 
            deaths, 
            verified, 
            created_at 
        FROM leaderboard 
        WHERE verified = true 
        ORDER BY duration_ms ASC, score DESC 
        LIMIT $limit
    );

    RETURN $top_entries;
};
