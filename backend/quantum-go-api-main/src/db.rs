use crate::entity::{RoomInfo, RoomSummary, User, UserRanking, LeaderboardEntry};
use bcrypt::{DEFAULT_COST, hash, verify};
use sqlx::postgres::PgPoolOptions;
use sqlx::{Error, PgPool};
use uuid::Uuid;
use sqlx::Row;


const MAX_CONNECTIONS: u32 = 50;

/// Database connection and operations handler
#[derive(Debug)]
pub struct Database {
    pool: PgPool,
}

impl Database {
    pub async fn new(database_url: &str) -> Result<Self, Error> {
        let pool = PgPoolOptions::new()
            .max_connections(MAX_CONNECTIONS)
            .connect(database_url)
            .await?;

        Self::initialize_tables(&pool).await?;
        Ok(Self { pool })
    }

    async fn initialize_tables(pool: &PgPool) -> Result<(), Error> {
        // Create users table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL UNIQUE,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Create room_infos table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS room_infos (
                id SERIAL PRIMARY KEY,
                room_id UUID NOT NULL UNIQUE,
                owner_id UUID NOT NULL,
                visitor_id UUID,
                status VARCHAR(50) NOT NULL,
                round VARCHAR(50) NOT NULL,
                winner VARCHAR(50),
                board JSONB NOT NULL,
                countdown INTEGER NOT NULL DEFAULT 30,
                moves INTEGER NOT NULL DEFAULT 0,
                black_lost INTEGER NOT NULL DEFAULT 0,
                white_lost INTEGER NOT NULL DEFAULT 0,
                model INTEGER NOT NULL DEFAULT 9,
                chessman_records JSONB NOT NULL DEFAULT '[]'::jsonb,
                phase VARCHAR(50) DEFAULT 'BlackQuantum',
                komi DOUBLE PRECISION NOT NULL DEFAULT 7.5,
                time_control JSONB
            );
            "#,
        )
        .execute(pool)
        .await?;

        // 检查并添加phase字段（如果不存在）
        let result = sqlx::query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'room_infos' AND column_name = 'phase'"
        )
        .fetch_optional(pool)
        .await?;

        if result.is_none() {
            println!("Adding phase column to room_infos table...");
            sqlx::query("ALTER TABLE room_infos ADD COLUMN phase VARCHAR(50) DEFAULT 'BlackQuantum'")
                .execute(pool)
                .await?;
            println!("Phase column added successfully");
        }

        // Ensure komi column exists
        let result_komi = sqlx::query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'room_infos' AND column_name = 'komi'"
        )
        .fetch_optional(pool)
        .await?;
        if result_komi.is_none() {
            println!("Adding komi column to room_infos table...");
            sqlx::query("ALTER TABLE room_infos ADD COLUMN komi DOUBLE PRECISION NOT NULL DEFAULT 7.5")
                .execute(pool)
                .await?;
            println!("Komi column added successfully");
        }

        // Ensure time_control column exists
        let result_time_control = sqlx::query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'room_infos' AND column_name = 'time_control'"
        )
        .fetch_optional(pool)
        .await?;
        if result_time_control.is_none() {
            println!("Adding time_control column to room_infos table...");
            sqlx::query("ALTER TABLE room_infos ADD COLUMN time_control JSONB")
                .execute(pool)
                .await?;
            println!("time_control column added successfully");
        }

        // Ensure lobby visibility columns exist (Phase 1)
        let result_is_public = sqlx::query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'room_infos' AND column_name = 'is_public'"
        )
        .fetch_optional(pool)
        .await?;
        if result_is_public.is_none() {
            println!("Adding is_public column to room_infos table...");
            sqlx::query("ALTER TABLE room_infos ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT TRUE")
                .execute(pool)
                .await?;
        }
        let result_is_listed = sqlx::query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'room_infos' AND column_name = 'is_listed'"
        )
        .fetch_optional(pool)
        .await?;
        if result_is_listed.is_none() {
            println!("Adding is_listed column to room_infos table...");
            sqlx::query("ALTER TABLE room_infos ADD COLUMN is_listed BOOLEAN NOT NULL DEFAULT TRUE")
                .execute(pool)
                .await?;
        }
        let result_allow_spectate = sqlx::query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'room_infos' AND column_name = 'allow_spectate'"
        )
        .fetch_optional(pool)
        .await?;
        if result_allow_spectate.is_none() {
            println!("Adding allow_spectate column to room_infos table...");
            sqlx::query("ALTER TABLE room_infos ADD COLUMN allow_spectate BOOLEAN NOT NULL DEFAULT TRUE")
                .execute(pool)
                .await?;
        }
        let result_created_at = sqlx::query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'room_infos' AND column_name = 'created_at'"
        )
        .fetch_optional(pool)
        .await?;
        if result_created_at.is_none() {
            println!("Adding created_at column to room_infos table...");
            sqlx::query("ALTER TABLE room_infos ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()")
                .execute(pool)
                .await?;
        }

        // Ensure last_activity_at column exists
        let result_last_activity = sqlx::query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'room_infos' AND column_name = 'last_activity_at'"
        )
        .fetch_optional(pool)
        .await?;
        if result_last_activity.is_none() {
            println!("Adding last_activity_at column to room_infos table...");
            sqlx::query("ALTER TABLE room_infos ADD COLUMN last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()")
                .execute(pool)
                .await?;
        }

        // Create user_rankings table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS user_rankings (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL,
                model INTEGER NOT NULL,
                rating DOUBLE PRECISION NOT NULL DEFAULT 1500.0,
                rd DOUBLE PRECISION NOT NULL DEFAULT 350.0,
                vol DOUBLE PRECISION NOT NULL DEFAULT 0.06,
                games_played INTEGER NOT NULL DEFAULT 0,
                wins INTEGER NOT NULL DEFAULT 0,
                losses INTEGER NOT NULL DEFAULT 0,
                draws INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(user_id, model)
            )
            "#,
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    // Actively used user operations
    pub async fn create_user(&self, username: &str, password: &str) -> Result<User, Error> {
        let user_id = Uuid::new_v4();
        let hashed_password = hash_password(password)?;

        let user = sqlx::query_as::<_, User>(
            "INSERT INTO users (user_id, username, password) VALUES ($1, $2, $3) RETURNING *",
        )
        .bind(user_id)
        .bind(username)
        .bind(hashed_password)
        .fetch_one(&self.pool)
        .await?;

        // 为新用户创建默认评分记录
        for model in [7, 9, 13, 19] {
            self.create_user_ranking(&user_id, model).await?;
        }

        Ok(user)
    }

    pub async fn verify_user(&self, username: &str, password: &str) -> Result<User, Error> {
        let user = self.get_user_by_username(username).await?;

        if verify_password(password, &user.password)? {
            Ok(user)
        } else {
            Err(Error::RowNotFound)
        }
    }

    pub async fn get_user_by_username(&self, username: &str) -> Result<User, Error> {
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = $1")
            .bind(username)
            .fetch_one(&self.pool)
            .await
    }

    // Reserved for future use
    #[allow(dead_code)]
    pub async fn get_user_by_id(&self, id: i32) -> Result<User, Error> {
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
            .bind(id)
            .fetch_one(&self.pool)
            .await
    }

    #[allow(dead_code)]
    pub async fn get_user_by_user_id(&self, user_id: Uuid) -> Result<User, Error> {
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE user_id = $1")
            .bind(user_id)
            .fetch_one(&self.pool)
            .await
    }

    #[allow(dead_code)]
    pub async fn update_user_password(
        &self,
        user_id: Uuid,
        new_password: &str,
    ) -> Result<User, Error> {
        let hashed_password = hash_password(new_password)?;

        sqlx::query_as::<_, User>("UPDATE users SET password = $1 WHERE user_id = $2 RETURNING *")
            .bind(hashed_password)
            .bind(user_id)
            .fetch_one(&self.pool)
            .await
    }

    #[allow(dead_code)]
    pub async fn delete_user(&self, user_id: Uuid) -> Result<(), Error> {
        sqlx::query("DELETE FROM users WHERE user_id = $1")
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // Actively used room operations
    pub async fn create_room(&self, room_info: &RoomInfo) -> Result<RoomInfo, Error> {
        sqlx::query_as::<_, RoomInfo>(
            r#"
            INSERT INTO room_infos (
                room_id, owner_id, visitor_id, status, round, winner, board, countdown, moves, black_lost, white_lost, model, chessman_records, phase, komi, time_control, is_public, is_listed, allow_spectate
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
            ) RETURNING *
            "#,
        )
        .bind(room_info.room_id)
        .bind(room_info.owner_id)
        .bind(room_info.visitor_id)
        .bind(&room_info.status)
        .bind(&room_info.round)
        .bind(&room_info.winner)
        .bind(&room_info.board)
        .bind(room_info.countdown)
        .bind(room_info.moves)
        .bind(room_info.black_lost)
        .bind(room_info.white_lost)
        .bind(room_info.model)
        .bind(&room_info.chessman_records)
        .bind(&room_info.phase)
        .bind(room_info.komi as f64)
        .bind(&room_info.time_control)
        .bind(room_info.is_public)
        .bind(room_info.is_listed)
        .bind(room_info.allow_spectate)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn list_public_waiting_rooms(&self, model: Option<i32>, limit: i64, offset: i64) -> Result<Vec<RoomInfo>, Error> {
        // Backward compatibility (not used by API anymore). Kept in case of future reuse.
        // Only recent rooms (last 24h), without a visitor yet
        let base = "SELECT * FROM room_infos WHERE status = 'waiting' AND is_public = TRUE AND is_listed = TRUE AND visitor_id IS NULL AND created_at IS NOT NULL AND created_at >= NOW() - INTERVAL '24 hours'";
        if let Some(m) = model {
            let query = format!("{} AND model = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3", base);
            sqlx::query_as::<_, RoomInfo>(&query)
                .bind(m)
                .bind(limit)
                .bind(offset)
                .fetch_all(&self.pool)
                .await
        } else {
            let query = format!("{} ORDER BY created_at DESC LIMIT $1 OFFSET $2", base);
            sqlx::query_as::<_, RoomInfo>(&query)
                .bind(limit)
                .bind(offset)
                .fetch_all(&self.pool)
                .await
        }
    }

    pub async fn list_public_waiting_rooms_summary(&self, model: Option<i32>, limit: i64, offset: i64) -> Result<Vec<RoomSummary>, Error> {
        // Join users to fetch owner username; filter to recent and open rooms
        if let Some(m) = model {
            sqlx::query_as::<_, RoomSummary>(
                r#"
                SELECT r.room_id, r.owner_id, u.username AS owner_username, r.status, r.model, r.created_at
                FROM room_infos r
                JOIN users u ON u.user_id = r.owner_id
                WHERE r.status = 'waiting'
                  AND r.is_public = TRUE AND r.is_listed = TRUE
                  AND r.visitor_id IS NULL
                  AND r.created_at IS NOT NULL AND r.created_at >= NOW() - INTERVAL '24 hours'
                  AND r.model = $1
                ORDER BY r.created_at DESC
                LIMIT $2 OFFSET $3
                "#
            )
            .bind(m)
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
        } else {
            sqlx::query_as::<_, RoomSummary>(
                r#"
                SELECT r.room_id, r.owner_id, u.username AS owner_username, r.status, r.model, r.created_at
                FROM room_infos r
                JOIN users u ON u.user_id = r.owner_id
                WHERE r.status = 'waiting'
                  AND r.is_public = TRUE AND r.is_listed = TRUE
                  AND r.visitor_id IS NULL
                  AND r.created_at IS NOT NULL AND r.created_at >= NOW() - INTERVAL '24 hours'
                ORDER BY r.created_at DESC
                LIMIT $1 OFFSET $2
                "#
            )
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
        }
    }

    pub async fn get_room_by_room_id(&self, room_id: Uuid) -> Result<RoomInfo, Error> {
        sqlx::query_as::<_, RoomInfo>("SELECT * FROM room_infos WHERE room_id = $1")
            .bind(room_id)
            .fetch_one(&self.pool)
            .await
    }

    pub async fn update_room(&self, room_info: &RoomInfo) -> Result<RoomInfo, Error> {
        sqlx::query_as::<_, RoomInfo>(
            r#"
            UPDATE room_infos SET
                visitor_id = $1,
                status = $2,
                round = $3,
                winner = $4,
                board = $5,
                countdown = $6,
                moves = $7,
                black_lost = $8,
                white_lost = $9,
                model = $10,
                chessman_records = $11,
                phase = $12,
                last_activity_at = NOW(),
                komi = $13,
                time_control = $14
            WHERE id = $15 RETURNING *
            "#,
        )
        .bind(room_info.visitor_id)       // $1
        .bind(&room_info.status)          // $2
        .bind(&room_info.round)           // $3
        .bind(&room_info.winner)          // $4
        .bind(&room_info.board)           // $5
        .bind(room_info.countdown)        // $6
        .bind(room_info.moves)            // $7
        .bind(room_info.black_lost)       // $8
        .bind(room_info.white_lost)       // $9
        .bind(room_info.model)            // $10
        .bind(&room_info.chessman_records)// $11
        .bind(&room_info.phase)           // $12
        .bind(room_info.komi as f64)      // $13
        .bind(&room_info.time_control)    // $14
        .bind(room_info.id)               // $15
        .fetch_one(&self.pool)
        .await
    }

    // 简化版：仅在访客加入时更新 visitor_id 与 status，避免其它字段绑定差异导致失败
    pub async fn update_room_visitor_simple(&self, id: i32, visitor_id: Option<Uuid>, status: &str) -> Result<RoomInfo, Error> {
        sqlx::query_as::<_, RoomInfo>(
            r#"
            UPDATE room_infos SET
                visitor_id = $1,
                status = $2,
                last_activity_at = NOW()
            WHERE id = $3 RETURNING *
            "#,
        )
        .bind(visitor_id)
        .bind(status)
        .bind(id)
        .fetch_one(&self.pool)
        .await
    }

    // Mark rooms as finished if no activity for more than 24 hours
    pub async fn finish_expired_rooms_24h(&self) -> Result<i64, Error> {
        let rows = sqlx::query(
            r#"
            UPDATE room_infos
            SET status = 'finished'
            WHERE status <> 'finished'
              AND COALESCE(last_activity_at, created_at) < NOW() - INTERVAL '24 hours'
            "#,
        )
        .execute(&self.pool)
        .await?;
        Ok(rows.rows_affected() as i64)
    }

    // List recent rooms for a user (owner or visitor)
    pub async fn list_recent_rooms(&self, user_id: Uuid, status: Option<&str>, limit: i64, offset: i64) -> Result<Vec<crate::entity::RecentRoomSummary>, Error> {
        let base = r#"
            SELECT r.room_id,
                   r.owner_id,
                   ou.username AS owner_username,
                   r.visitor_id,
                   vu.username AS visitor_username,
                   r.status,
                   r.model,
                   r.moves,
                   r.winner,
                   r.created_at,
                   r.last_activity_at
            FROM room_infos r
            JOIN users ou ON ou.user_id = r.owner_id
            LEFT JOIN users vu ON r.visitor_id IS NOT NULL AND vu.user_id = r.visitor_id
            WHERE (r.owner_id = $1 OR r.visitor_id = $1)
        "#;
        if let Some(s) = status {
            let query = format!("{} AND r.status = $2 ORDER BY r.last_activity_at DESC LIMIT $3 OFFSET $4", base);
            sqlx::query_as::<_, crate::entity::RecentRoomSummary>(&query)
                .bind(user_id)
                .bind(s)
                .bind(limit)
                .bind(offset)
                .fetch_all(&self.pool)
                .await
        } else {
            let query = format!("{} ORDER BY r.last_activity_at DESC LIMIT $2 OFFSET $3", base);
            sqlx::query_as::<_, crate::entity::RecentRoomSummary>(&query)
                .bind(user_id)
                .bind(limit)
                .bind(offset)
                .fetch_all(&self.pool)
                .await
        }
    }
    

    // Reserved for future use
    #[allow(dead_code)]
    pub async fn get_room_by_id(&self, id: i32) -> Result<RoomInfo, Error> {
        sqlx::query_as::<_, RoomInfo>("SELECT * FROM room_infos WHERE id = $1")
            .bind(id)
            .fetch_one(&self.pool)
            .await
    }

    #[allow(dead_code)]
    pub async fn delete_room(&self, id: i32) -> Result<(), Error> {
        sqlx::query("DELETE FROM room_infos WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // 新增：用户评分相关操作
    pub async fn create_user_ranking(&self, user_id: &Uuid, model: i32) -> Result<UserRanking, Error> {
        sqlx::query_as::<_, UserRanking>(
            r#"
            INSERT INTO user_rankings (user_id, model, rating, rd, vol, games_played, wins, losses, draws)
            VALUES ($1, $2, 1500.0, 350.0, 0.06, 0, 0, 0, 0)
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(model)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn get_user_ranking(&self, user_id: &Uuid, model: i32) -> Result<UserRanking, Error> {
        sqlx::query_as::<_, UserRanking>(
            "SELECT * FROM user_rankings WHERE user_id = $1 AND model = $2"
        )
        .bind(user_id)
        .bind(model)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn update_user_ranking(&self, ranking: &UserRanking) -> Result<UserRanking, Error> {
        sqlx::query_as::<_, UserRanking>(
            r#"
            UPDATE user_rankings SET
                rating = $1, rd = $2, vol = $3, games_played = $4, wins = $5, losses = $6, draws = $7, updated_at = NOW()
            WHERE user_id = $8 AND model = $9 RETURNING *
            "#,
        )
        .bind(ranking.rating)
        .bind(ranking.rd)
        .bind(ranking.vol)
        .bind(ranking.games_played)
        .bind(ranking.wins)
        .bind(ranking.losses)
        .bind(ranking.draws)
        .bind(ranking.user_id)
        .bind(ranking.model)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn get_leaderboard(&self, model: i32, limit: i32) -> Result<Vec<LeaderboardEntry>, Error> {
        let rows = sqlx::query(
            r#"
            SELECT
                u.username,
                ur.rating,
                ur.rd,
                ur.games_played,
                ur.wins,
                ur.losses,
                ur.draws
            FROM user_rankings ur
            JOIN users u ON ur.user_id = u.user_id
            WHERE ur.model = $1 AND ur.games_played > 0
            ORDER BY ur.rating DESC
            LIMIT $2
            "#
        )
        .bind(model)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        let mut leaderboard = Vec::new();
        for row in rows {
            let entry = LeaderboardEntry {
                username: row.get::<String, _>("username"),
                rating: row.get::<f64, _>("rating"),
                rd: row.get::<f64, _>("rd"),
                games_played: row.get::<i32, _>("games_played"),
                wins: row.get::<i32, _>("wins"),
                losses: row.get::<i32, _>("losses"),
                draws: row.get::<i32, _>("draws"),
            };
            leaderboard.push(entry);
        }

        Ok(leaderboard)
    }
}

// Helper functions for password hashing
fn hash_password(password: &str) -> Result<String, Error> {
    hash(password, DEFAULT_COST).map_err(|e| {
        Error::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            e.to_string(),
        ))
    })
}

fn verify_password(password: &str, hash: &str) -> Result<bool, Error> {
    verify(password, hash).map_err(|e| {
        Error::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            e.to_string(),
        ))
    })
}
