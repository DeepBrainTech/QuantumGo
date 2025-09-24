use crate::entity::{RoomInfo, User, LeaderboardEntry};
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
pub struct CreateRoomRequest {
    user_id: Uuid,
    model: i32,
    countdown: i32,
    game_mode: Option<String>,
    komi: Option<f64>,
}

#[derive(Deserialize)]
pub struct GetGameInfo {
    room_id: Uuid,
}

#[derive(Deserialize)]
pub struct GetLeaderboardRequest {
    model: i32,
    limit: Option<i32>,
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
