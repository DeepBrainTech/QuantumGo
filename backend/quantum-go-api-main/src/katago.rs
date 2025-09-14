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

#[derive(Debug, Deserialize)]
pub struct AiGenmoveRequest {
    pub board_size: u8,          // 9 | 13 | 19
    pub next_to_move: String,    // "black" | "white"
    pub moves: Vec<MoveItem>,    // game history in order
    pub komi: Option<f32>,       // default 7.5
    pub rules: Option<String>,   // e.g. "Chinese"
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
    let engine_arc = {
        let mut pool = ENGINE_POOL.lock().await;
        if let Some(engine) = pool.get(&req.board_size) {
            engine.clone()
        } else {
            let engine = Arc::new(Mutex::new(KataGoEngine::new().await?));
            pool.insert(req.board_size, engine.clone());
            engine
        }
    };

    // Use the engine exclusively for this request
    let mut engine = engine_arc.lock().await;
    match engine.genmove(&req).await {
        Ok(resp) => Ok(resp),
        Err(_e) => {
            // Try respawn once if engine broke (e.g. killed)
            let mut pool = ENGINE_POOL.lock().await;
            let new_engine = Arc::new(Mutex::new(KataGoEngine::new().await?));
            pool.insert(req.board_size, new_engine.clone());
            drop(pool);
            let mut eng = new_engine.lock().await;
            eng.genmove(&req).await
        }
    }
}
