use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, ChildStdout, Command},
    sync::Mutex,
};
use std::sync::Arc;
use once_cell::sync::Lazy;
use crate::score_estimator;

#[derive(Debug, Deserialize)]
pub struct AiGenmoveRequest {
    pub board_size: u8,          // 7 | 9 | 13 | 19
    pub next_to_move: String,    // "black" | "white"
    pub moves: Vec<MoveItem>,    // game history in order
    pub komi: Option<f32>,       // default 7.5
    pub rules: Option<String>,   // e.g. "Chinese"
    // Optional list of moves ("x,y") that should be avoided under
    // Quantum dual-board + SSK legality computed on the frontend.
    pub forbidden: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct MoveItem {
    pub color: String,   // "black" | "white"
    pub position: String // "x,y" (1-based)
}

#[derive(Debug, Serialize)]
pub struct AiGenmoveResponse {
    pub move_coord: String,   // e.g. "D16" or "pass" or "resign"
}

#[derive(Debug, Deserialize)]
pub struct ScoreEstimateRequest {
    pub boards: Vec<ScoreEstimateBoardRequest>,
}

#[derive(Debug, Deserialize)]
pub struct ScoreEstimateBoardRequest {
    pub board_size: u8,
    pub black_stones: Vec<String>,
    pub white_stones: Vec<String>,
    pub next_to_move: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ScoreEstimateResponse {
    pub boards: Vec<ScoreEstimateBoardResponse>,
}

#[derive(Debug, Serialize)]
pub struct ScoreEstimateBoardResponse {
    pub board_index: usize,
    pub board_size: u8,
    pub ownership: Vec<f32>,
    pub winrate: f32,
    pub score_lead: f32,
    pub dead_stones: Vec<i32>, // 死子坐标列表 [x1, y1, x2, y2, ...]
}

fn xy_to_gtp(pos: &str, size: u8) -> io::Result<String> {
    let (x_s, y_s) = pos
        .split_once(',')
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "invalid pos"))?;
    let x: i32 = x_s.trim().parse().map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "invalid x"))?;
    let y: i32 = y_s.trim().parse().map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "invalid y"))?;
    if x < 1 || y < 1 || x as u8 > size || y as u8 > size {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "pos out of bounds"));
    }
    let gtp_row = (size as i32) - x + 1;
    let mut col_idx = y as u8;
    let col_char = if col_idx <= 8 { // A..H
        (b'A' + (col_idx - 1)) as char
    } else { // skip 'I'
        (b'A' + col_idx) as char
    };
    Ok(format!("{}{}", col_char, gtp_row))
}

fn color_to_gtp(color: &str) -> &'static str {
    match color.to_ascii_lowercase().as_str() {
        "b" | "black" => "B",
        "w" | "white" => "W",
        _ => "B",
    }
}

fn gtp_to_xy(coord: &str, size: u8) -> io::Result<String> {
    let c = coord.trim().to_ascii_uppercase();
    if c == "PASS" || c == "RESIGN" { return Ok(c); }
    if c.len() < 2 { return Err(io::Error::new(io::ErrorKind::InvalidInput, "bad gtp")); }
    let bytes = c.as_bytes();
    let col = bytes[0] as char;
    let row: i32 = c[1..].parse().map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "bad row"))?;
    let y = if col < 'I' { (col as u8 - b'A') as i32 + 1 } else { (col as u8 - b'A') as i32 }; // skip I
    let x = (size as i32) - row + 1;
    if x < 1 || y < 1 || x as u8 > size || y as u8 > size {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "gtp out of bounds"));
    }
    Ok(format!("{},{}", x, y))
}

async fn read_gtp_reply(reader: &mut (impl AsyncBufReadExt + Unpin)) -> io::Result<String> {
    let mut first_line = String::new();
    loop {
        first_line.clear();
        let n = reader.read_line(&mut first_line).await?;
        if n == 0 { return Err(io::Error::new(io::ErrorKind::UnexpectedEof, "gtp closed")); }
        if first_line.starts_with('=') || first_line.starts_with('?') { break; }
    }
    // consume until blank line
    loop {
        let mut line = String::new();
        let n = reader.read_line(&mut line).await?;
        if n == 0 || line.trim().is_empty() { break; }
    }
    Ok(first_line[1..].trim().to_string())
}

struct KataGoEngine {
    child: Child,
    stdin: ChildStdin,
    reader: BufReader<ChildStdout>,
}

impl KataGoEngine {
    async fn new() -> io::Result<Self> {
        // Prefer a pre-extracted binary if present to avoid AppImage extraction cost
        let mut bin = std::env::var("KATAGO_BIN").map_err(|_| io::Error::new(io::ErrorKind::NotFound, "KATAGO_BIN not set"))?;
        if let Ok(real) = std::env::var("KATAGO_BIN_REAL") {
            if !real.trim().is_empty() {
                bin = real;
            }
        }
        let model = std::env::var("KATAGO_MODEL").map_err(|_| io::Error::new(io::ErrorKind::NotFound, "KATAGO_MODEL not set"))?;
        let cfg = std::env::var("KATAGO_GTP_CONFIG").map_err(|_| io::Error::new(io::ErrorKind::NotFound, "KATAGO_GTP_CONFIG not set"))?;
        let overrides = std::env::var("KATAGO_OVERRIDES").unwrap_or_else(|_| "ponderingEnabled=false".to_string());

        let mut child = Command::new(bin)
            .arg("gtp")
            .arg("-model").arg(model)
            .arg("-config").arg(cfg)
            .arg("-override-config").arg(overrides)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .spawn()?;

        let stdin = child.stdin.take().ok_or_else(|| io::Error::new(io::ErrorKind::Other, "no stdin"))?;
        let stdout = child.stdout.take().ok_or_else(|| io::Error::new(io::ErrorKind::Other, "no stdout"))?;
        let reader = BufReader::new(stdout);

        Ok(KataGoEngine { child, stdin, reader })
    }

    async fn send(&mut self, cmd: &str) -> io::Result<()> {
        self.stdin.write_all(cmd.as_bytes()).await?;
        self.stdin.write_all(b"\n").await?;
        self.stdin.flush().await
    }

    async fn genmove(&mut self, req: &AiGenmoveRequest) -> io::Result<AiGenmoveResponse> {
        self.send(&format!("boardsize {}", req.board_size)).await?;
        let _ = read_gtp_reply(&mut self.reader).await?;
        self.send(&format!("komi {}", req.komi.unwrap_or(7.5))).await?;
        let _ = read_gtp_reply(&mut self.reader).await?;
        self.send("clear_board").await?;
        let _ = read_gtp_reply(&mut self.reader).await?;

        for m in &req.moves {
            let color = color_to_gtp(&m.color);
            let coord = xy_to_gtp(&m.position, req.board_size)?;
            self.send(&format!("play {} {}", color, coord)).await?;
            let _ = read_gtp_reply(&mut self.reader).await?;
        }

        let color = color_to_gtp(&req.next_to_move);
        self.send(&format!("genmove {}", color)).await?;
        let ans = read_gtp_reply(&mut self.reader).await?;
        Ok(AiGenmoveResponse { move_coord: ans })
    }
}

static ENGINE_POOL: Lazy<Mutex<HashMap<u8, Arc<Mutex<KataGoEngine>>>>> = Lazy::new(|| Mutex::new(HashMap::new()));

pub async fn genmove_with_katago(req: AiGenmoveRequest) -> Result<AiGenmoveResponse, io::Error> {
    // Get or create a persistent engine for this board size
    let mut engine_arc = {
        let mut pool = ENGINE_POOL.lock().await;
        if let Some(engine) = pool.get(&req.board_size) {
            engine.clone()
        } else {
            let engine = Arc::new(Mutex::new(KataGoEngine::new().await?));
            pool.insert(req.board_size, engine.clone());
            engine
        }
    };
    // Build a quick lookup set of forbidden xy positions
    let forbidden: std::collections::HashSet<String> = req
        .forbidden
        .clone()
        .unwrap_or_default()
        .into_iter()
        .collect();

    // Use the engine exclusively for this request; retry a few times if suggestion is forbidden.
    let mut attempts = 0usize;
    let max_attempts = 5usize;
    let mut engine = engine_arc.lock().await;
    loop {
        let res = engine.genmove(&req).await;
        match res {
            Ok(resp) => {
                // If we don't have a forbidden set, return as-is
                if forbidden.is_empty() { return Ok(resp); }
                let xy = match gtp_to_xy(&resp.move_coord, req.board_size) {
                    Ok(v) => v,
                    Err(_) => return Ok(resp),
                };
                if xy == "PASS" || xy == "RESIGN" { return Ok(resp); }
                if !forbidden.contains(&xy) { return Ok(resp); }
                attempts += 1;
                if attempts >= max_attempts {
                    // Could not obtain a legal move; fall back to pass
                    return Ok(AiGenmoveResponse { move_coord: "pass".to_string() });
                }
                // Respawn engine to change random seed and try again
                drop(engine);
                let mut pool = ENGINE_POOL.lock().await;
                let new_arc = Arc::new(Mutex::new(KataGoEngine::new().await?));
                pool.insert(req.board_size, new_arc.clone());
                drop(pool);
                engine_arc = new_arc.clone();
                engine = engine_arc.lock().await;
                continue;
            }
            Err(_) => {
                // Engine error: respawn once per failure and retry
                attempts += 1;
                if attempts >= max_attempts {
                    return Err(io::Error::new(io::ErrorKind::Other, "katago failed"));
                }
                drop(engine);
                let mut pool = ENGINE_POOL.lock().await;
                let new_arc = Arc::new(Mutex::new(KataGoEngine::new().await?));
                pool.insert(req.board_size, new_arc.clone());
                drop(pool);
                engine_arc = new_arc.clone();
                engine = engine_arc.lock().await;
                continue;
            }
        }
    }
}

// 使用score-estimator的新实现
pub async fn estimate_with_score_estimator(
    req: ScoreEstimateRequest,
) -> Result<ScoreEstimateResponse, io::Error> {
    if req.boards.is_empty() {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "no boards provided"));
    }
    
    let mut responses = Vec::with_capacity(req.boards.len());
    
    for (idx, board) in req.boards.iter().enumerate() {
        // 使用score-estimator进行估算
        let (ownership, territory, dead_pairs) = score_estimator::estimate_board_score(
            board.board_size,
            &board.black_stones,
            &board.white_stones,
            board.next_to_move.as_deref(),
            1000, // trials
            0.4,  // tolerance
        ).map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;
        
        // 获取死子信息
        // 将死子坐标转换为扁平数组
        let mut dead_stones_flat = Vec::new();
        for (x, y) in dead_pairs {
            dead_stones_flat.push(x);
            dead_stones_flat.push(y);
        }
        
        // 计算胜率和分数领先
        let mut black_territory = 0.0;
        let mut white_territory = 0.0;
        
        for &value in &territory {
            if value > 0.0 {
                black_territory += value;
            } else if value < 0.0 {
                white_territory += value.abs();
            }
        }
        
        let score_lead = black_territory - white_territory;
        let winrate = if score_lead > 0.0 { 0.5 + (score_lead / 100.0).min(0.5) } else { 0.5 - (score_lead.abs() / 100.0).min(0.5) };
        
        responses.push(ScoreEstimateBoardResponse {
            board_index: idx,
            board_size: board.board_size,
            ownership,
            winrate: winrate.max(0.0).min(1.0),
            score_lead,
            dead_stones: dead_stones_flat,
        });
    }
    
    Ok(ScoreEstimateResponse { boards: responses })
}
