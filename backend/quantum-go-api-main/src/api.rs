use crate::entity::{RoomInfo, RoomSummary, User, LeaderboardEntry};
use axum::{Json, extract::State, http::StatusCode};
use serde::Deserialize;
use uuid::Uuid;
use crate::katago::{
    AiGenmoveRequest,
    AiGenmoveResponse,
    AiDualGenmoveRequest,
    AiDualGenmoveResponse,
    genmove_with_katago,
    genmove_dual_with_katago,
    ScoreEstimateRequest,
    ScoreEstimateResponse,
    estimate_with_score_estimator,
};
use crate::jwt::verify_jwt_token;

type ApiResult<T> = Result<(StatusCode, Json<T>), (StatusCode, Json<serde_json::Value>)>;

#[derive(Deserialize)]
pub struct RegisterRequest {
    username: String,
    password: String,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    username: String,
    password: String,
}

#[derive(Deserialize)]
pub struct JwtLoginRequest {
    token: String,
}

#[derive(serde::Serialize)]
pub struct JwtLoginResponse {
    user_id: Uuid,
    username: String,
    wordpress_id: u64,
}

#[derive(Deserialize)]
pub struct CreateRoomRequest {
    user_id: Uuid,
    model: i32,
    countdown: i32,
    game_mode: Option<String>,
    komi: Option<f64>,
    time_control: Option<serde_json::Value>,
    // Phase 1 lobby options (optional)
    is_public: Option<bool>,
    is_listed: Option<bool>,
    allow_spectate: Option<bool>,
}

#[derive(Deserialize)]
pub struct GetGameInfo {
    room_id: Uuid,
}

#[derive(Deserialize)]
pub struct ListRoomsRequest {
    model: Option<i32>,
    page: Option<i32>,
    size: Option<i32>,
}

#[derive(Deserialize)]
pub struct RecentRoomsRequest {
    user_id: Uuid,
    status: Option<String>, // optional: 'waiting' | 'playing' | 'finished'
    page: Option<i32>,
    size: Option<i32>,
}

#[derive(Deserialize)]
pub struct GetLeaderboardRequest {
    model: i32,
    limit: Option<i32>,
}

#[derive(Deserialize)]
pub struct GetUserProfileRequest {
    user_id: Uuid,
    model: i32,
}

#[derive(serde::Serialize)]
pub struct UserProfileResponse {
    pub user_id: Uuid,
    pub username: String,
    pub rating: f64,
    pub rd: f64,
    pub games_played: i32,
    pub wins: i32,
    pub losses: i32,
    pub draws: i32,
}

#[axum::debug_handler]
pub async fn register(
    State(state): State<crate::ws::AppState>,
    Json(req): Json<RegisterRequest>,
) -> ApiResult<User> {
    match state.db.create_user(&req.username, &req.password).await {
        Ok(user) => Ok((StatusCode::CREATED, Json(user))),
        Err(err) => Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": format!("Failed to create user: {}", err)
            })),
        )),
    }
}

#[axum::debug_handler]
pub async fn login(
    State(state): State<crate::ws::AppState>,
    Json(req): Json<LoginRequest>,
) -> ApiResult<User> {
    match state.db.verify_user(&req.username, &req.password).await {
        Ok(user) => Ok((StatusCode::OK, Json(user))),
        Err(_) => Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({
                "error": "Invalid username or password"
            })),
        )),
    }
}

#[axum::debug_handler]
pub async fn create_room(
    State(state): State<crate::ws::AppState>,
    Json(req): Json<CreateRoomRequest>,
) -> ApiResult<serde_json::Value> {
    let room_id = Uuid::new_v4();
    
 
    let (status, phase) = ("waiting".to_string(), None);
    
    let room_info = RoomInfo {
        id: 0,
        room_id,
        owner_id: req.user_id,
        visitor_id: None,
        status,
        round: "black".to_string(),
        winner: None,
        board: serde_json::Value::Object(serde_json::Map::new()),
        moves: 0,
        white_lost: 0,
        black_lost: 0,
        countdown: req.countdown,
        model: req.model,
        chessman_records: serde_json::Value::Array(vec![]),
        phase,
        komi: req.komi.unwrap_or(7.5),
        time_control: req.time_control,
        is_public: req.is_public.unwrap_or(true),
        is_listed: req.is_listed.unwrap_or(true),
        allow_spectate: req.allow_spectate.unwrap_or(true),
        created_at: chrono::Utc::now(),
        last_activity_at: chrono::Utc::now(),
    };

    match state.db.create_room(&room_info).await {
        Ok(_) => Ok((
            StatusCode::CREATED,
            Json(serde_json::json!({ "room_id": room_id })),
        )),
        Err(err) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": format!("Failed to create room: {}", err)
            })),
        )),
    }
}

#[axum::debug_handler]
pub async fn get_game_info(
    State(state): State<crate::ws::AppState>,
    Json(req): Json<GetGameInfo>,
) -> ApiResult<RoomInfo> {
    // Auto-finish expired rooms before returning state
    let _ = state.db.finish_expired_rooms_24h().await;
    match state.db.get_room_by_room_id(req.room_id).await {
        Ok(room_info) => Ok((StatusCode::OK, Json(room_info))),
        Err(_) => Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "error": "Room not found"
            })),
        )),
    }
}

#[axum::debug_handler]
pub async fn get_leaderboard(
    State(state): State<crate::ws::AppState>,
    Json(req): Json<GetLeaderboardRequest>,
) -> ApiResult<Vec<LeaderboardEntry>> {
    let limit = req.limit.unwrap_or(50);
    
    if ![7, 9, 13, 19].contains(&req.model) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Invalid model size"
            })),
        ));
    }

    match state.db.get_leaderboard(req.model, limit).await {
        Ok(leaderboard) => Ok((StatusCode::OK, Json(leaderboard))),
        Err(err) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": format!("Failed to get leaderboard: {}", err)
            })),
        )),
    }
}

#[axum::debug_handler]
pub async fn ai_genmove(
    _state: State<crate::ws::AppState>,
    Json(req): Json<AiGenmoveRequest>,
) -> ApiResult<AiGenmoveResponse> {
    match genmove_with_katago(req).await {
        Ok(resp) => Ok((StatusCode::OK, Json(resp))),
        Err(err) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("katago error: {}", err) })),
        )),
    }
}

#[axum::debug_handler]
pub async fn list_rooms(
    State(state): State<crate::ws::AppState>,
    Json(req): Json<ListRoomsRequest>,
) -> ApiResult<Vec<RoomSummary>> {
    let page = req.page.unwrap_or(1).max(1) as i64;
    let size = req.size.unwrap_or(20).clamp(1, 100) as i64;
    let offset = (page - 1) * size;
    match state.db.list_public_waiting_rooms_summary(req.model, size, offset).await {
        Ok(rooms) => Ok((StatusCode::OK, Json(rooms))),
        Err(err) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Failed to list rooms: {}", err) })),
        )),
    }
}

#[axum::debug_handler]
pub async fn recent_rooms(
    State(state): State<crate::ws::AppState>,
    Json(req): Json<RecentRoomsRequest>,
) -> ApiResult<Vec<crate::entity::RecentRoomSummary>> {
    // Auto-finish expired rooms first
    let _ = state.db.finish_expired_rooms_24h().await;
    let page = req.page.unwrap_or(1).max(1) as i64;
    let size = req.size.unwrap_or(20).clamp(1, 100) as i64;
    let offset = (page - 1) * size;
    match state
        .db
        .list_recent_rooms(req.user_id, req.status.as_deref(), size, offset)
        .await
    {
        Ok(rooms) => Ok((StatusCode::OK, Json(rooms))),
        Err(err) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": format!("Failed to list recent rooms: {}", err)
            })),
        )),
    }
}

#[axum::debug_handler]
pub async fn get_user_profile(
    State(state): State<crate::ws::AppState>,
    Json(req): Json<GetUserProfileRequest>,
    ) -> ApiResult<UserProfileResponse> {
    // fetch user
    let user = match state.db.get_user_by_user_id(req.user_id).await {
        Ok(u) => u,
        Err(_) => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "User not found" })),
            ));
        }
    };
    // fetch ranking (create if missing)
    let ranking = match state.db.get_user_ranking(&user.user_id, req.model).await {
        Ok(r) => r,
        Err(_) => match state.db.create_user_ranking(&user.user_id, req.model).await {
            Ok(r) => r,
            Err(e) => {
                return Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({ "error": format!("Failed to get ranking: {}", e) })),
                ));
            }
        },
    };

    let resp = UserProfileResponse {
        user_id: user.user_id,
        username: user.username,
        rating: ranking.rating,
        rd: ranking.rd,
        games_played: ranking.games_played,
        wins: ranking.wins,
        losses: ranking.losses,
        draws: ranking.draws,
    };

    Ok((StatusCode::OK, Json(resp)))
}

#[axum::debug_handler]
pub async fn score_estimate(
    _state: State<crate::ws::AppState>,
    Json(req): Json<ScoreEstimateRequest>,
) -> ApiResult<ScoreEstimateResponse> {
    match estimate_with_score_estimator(req).await {
        Ok(resp) => Ok((StatusCode::OK, Json(resp))),
        Err(err) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("score estimate error: {}", err) })),
        )),
    }
}

#[axum::debug_handler]
pub async fn ai_genmove_dual(
    _state: State<crate::ws::AppState>,
    Json(req): Json<AiDualGenmoveRequest>,
) -> ApiResult<AiDualGenmoveResponse> {
    match genmove_dual_with_katago(req).await {
        Ok(resp) => Ok((StatusCode::OK, Json(resp))),
        Err(err) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("katago dual-genmove error: {}", err) })),
        )),
    }
}

/// WordPress SSO - JWT Token登录
/// 
/// 验证WordPress传来的JWT token，如果用户不存在则自动创建
#[axum::debug_handler]
pub async fn jwt_login(
    State(state): State<crate::ws::AppState>,
    Json(req): Json<JwtLoginRequest>,
) -> ApiResult<JwtLoginResponse> {
    tracing::info!("JWT login attempt with token: {}", &req.token[..std::cmp::min(50, req.token.len())]);
    
    // 验证JWT token
    let claims = match verify_jwt_token(&req.token) {
        Ok(c) => {
            tracing::info!("JWT token verified successfully for user: {}", c.username);
            c
        },
        Err(e) => {
            tracing::error!("JWT token verification failed: {}", e);
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "error": format!("Invalid token: {}", e)
                })),
            ));
        }
    };
    
    // 检查token是否过期（额外检查）
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    if claims.exp < now {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({
                "error": "Token expired"
            })),
        ));
    }
    
    // 检查用户是否存在，不存在则自动创建
    let user = match state.db.get_user_by_username(&claims.username).await {
        Ok(u) => u,
        Err(_) => {
            // 用户不存在，自动创建
            // 使用WordPress ID作为密码的一部分（用户无需知道这个密码）
            let temp_password = format!("wp_sso_{}", claims.sub);
            match state.db.create_user(&claims.username, &temp_password).await {
                Ok(u) => {
                    tracing::info!(
                        "Auto-created user from WordPress SSO: username={}, wordpress_id={}", 
                        claims.username, 
                        claims.sub
                    );
                    u
                }
                Err(e) => {
                    return Err((
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({
                            "error": format!("Failed to create user: {}", e)
                        })),
                    ));
                }
            }
        }
    };
    
    tracing::info!(
        "JWT SSO login successful: user_id={}, username={}, wordpress_id={}", 
        user.user_id, 
        user.username, 
        claims.sub
    );
    
    Ok((
        StatusCode::OK,
        Json(JwtLoginResponse {
            user_id: user.user_id,
            username: user.username,
            wordpress_id: claims.sub,
        }),
    ))
}
