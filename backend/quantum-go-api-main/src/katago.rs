use serde::{Deserialize, Serialize};
use std::io;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{ChildStdin, Command},
};

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

pub async fn genmove_with_katago(req: AiGenmoveRequest) -> Result<AiGenmoveResponse, io::Error> {
    let bin = std::env::var("KATAGO_BIN").map_err(|_| io::Error::new(io::ErrorKind::NotFound, "KATAGO_BIN not set"))?;
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

    let mut stdin = child.stdin.take().ok_or_else(|| io::Error::new(io::ErrorKind::Other, "no stdin"))?;
    let stdout = child.stdout.take().ok_or_else(|| io::Error::new(io::ErrorKind::Other, "no stdout"))?;
    let mut reader = BufReader::new(stdout);

    async fn send(stdin: &mut ChildStdin, cmd: &str) -> io::Result<()> {
        stdin.write_all(cmd.as_bytes()).await?;
        stdin.write_all(b"\n").await?;
        stdin.flush().await
    }

    send(&mut stdin, &format!("boardsize {}", req.board_size)).await?;
    let _ = read_gtp_reply(&mut reader).await?;
    send(&mut stdin, &format!("komi {}", req.komi.unwrap_or(7.5))).await?;
    let _ = read_gtp_reply(&mut reader).await?;
    send(&mut stdin, "clear_board").await?;
    let _ = read_gtp_reply(&mut reader).await?;

    for m in &req.moves {
        let color = color_to_gtp(&m.color);
        let coord = xy_to_gtp(&m.position, req.board_size)?;
        send(&mut stdin, &format!("play {} {}", color, coord)).await?;
        let _ = read_gtp_reply(&mut reader).await?;
    }

    let color = color_to_gtp(&req.next_to_move);
    send(&mut stdin, &format!("genmove {}", color)).await?;
    let ans = read_gtp_reply(&mut reader).await?;
    let _ = send(&mut stdin, "quit").await;
    let _ = child.kill().await;

    Ok(AiGenmoveResponse { move_coord: ans })
}
