-- ==============================================================================
-- ACCESS: Web3 Wallet Authentication (SurrealDB 2.x Record Access)
-- ==============================================================================

DEFINE ACCESS OVERWRITE player_auth ON DATABASE TYPE RECORD
    SIGNUP (
        CREATE type::record('player', $wallet) CONTENT {
            wallet: $wallet,
            username: string::concat('Player_', string::slice($wallet, 0, 6)),
            total_runs: 0,
            is_whitelisted: false
        }
    )
    SIGNIN (
        SELECT * FROM type::record('player', $wallet)
    )
    DURATION FOR TOKEN 7d, FOR SESSION 7d;
