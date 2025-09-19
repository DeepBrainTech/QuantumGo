use std::ffi::c_void;

// FFI绑定到简化的C++估算器
extern "C" {
    fn create_estimator(width: i32, height: i32) -> *mut c_void;
    fn destroy_estimator(estimator: *mut c_void);
    fn set_stone(estimator: *mut c_void, x: i32, y: i32, color: i32);
    fn estimate_score(
        estimator: *mut c_void,
        player_to_move: i32,
        trials: i32,
        tolerance: f32,
        ownership: *mut f32,
        width: *mut i32,
        height: *mut i32,
    );
    fn compute_territory(
        estimator: *mut c_void,
        territory: *mut f32,
        width: *mut i32,
        height: *mut i32,
    );
    fn get_dead_stones(
        estimator: *mut c_void,
        player_to_move: i32,
        trials: i32,
        tolerance: f32,
        dead_stones: *mut i32,
        count: *mut i32,
        max_count: i32,
    );
}

pub struct ScoreEstimator {
    estimator: *mut c_void,
    width: i32,
    height: i32,
}

impl ScoreEstimator {
    pub fn new(width: i32, height: i32) -> Self {
        unsafe {
            let estimator = create_estimator(width, height);
            Self {
                estimator,
                width,
                height,
            }
        }
    }

    pub fn set_stone(&self, x: i32, y: i32, color: i32) {
        unsafe {
            set_stone(self.estimator, x, y, color);
        }
    }

    pub fn estimate_score(&self, player_to_move: i32, trials: i32, tolerance: f32) -> Vec<f32> {
        let size = (self.width * self.height) as usize;
        let mut ownership = vec![0.0f32; size];
        let mut width = 0i32;
        let mut height = 0i32;

        unsafe {
            estimate_score(
                self.estimator,
                player_to_move,
                trials,
                tolerance,
                ownership.as_mut_ptr(),
                &mut width,
                &mut height,
            );
        }

        ownership
    }

    pub fn compute_territory(&self) -> Vec<f32> {
        let size = (self.width * self.height) as usize;
        let mut territory = vec![0.0f32; size];
        let mut width = 0i32;
        let mut height = 0i32;

        unsafe {
            compute_territory(
                self.estimator,
                territory.as_mut_ptr(),
                &mut width,
                &mut height,
            );
        }

        territory
    }

    pub fn get_dead_stones(
        &self,
        player_to_move: i32,
        trials: i32,
        tolerance: f32,
    ) -> Vec<(i32, i32)> {
        let max_count = 1000; // 最大死子数量
        let mut dead_stones = vec![0i32; max_count * 2];
        let mut count = 0i32;

        unsafe {
            get_dead_stones(
                self.estimator,
                player_to_move,
                trials,
                tolerance,
                dead_stones.as_mut_ptr(),
                &mut count,
                max_count as i32,
            );
        }

        let mut result = Vec::new();
        for i in 0..count as usize {
            let x = dead_stones[i * 2];
            let y = dead_stones[i * 2 + 1];
            result.push((x, y));
        }

        result
    }
}

impl Drop for ScoreEstimator {
    fn drop(&mut self) {
        unsafe {
            destroy_estimator(self.estimator);
        }
    }
}

// 将我们的数据格式转换为score-estimator格式
pub fn estimate_board_score(
    board_size: u8,
    black_stones: &[String],
    white_stones: &[String],
    next_to_move: Option<&str>,
    trials: i32,
    tolerance: f32,
) -> Result<(Vec<f32>, Vec<f32>, Vec<(i32, i32)>), String> {
    let estimator = ScoreEstimator::new(board_size as i32, board_size as i32);

    // 设置黑子
    for stone in black_stones {
        let (x, y) = parse_position(stone)?;
        estimator.set_stone(x - 1, y - 1, 1); // 1表示黑色
    }

    // 设置白子
    for stone in white_stones {
        let (x, y) = parse_position(stone)?;
        estimator.set_stone(x - 1, y - 1, 2); // 2表示白色
    }

    // 确定下一步玩家
    let player_to_move = match next_to_move.unwrap_or("black") {
        "black" => 1,
        "white" => 2,
        _ => 1,
    };

    // 估算分数
    let ownership = estimator.estimate_score(player_to_move, trials, tolerance);
    let territory = estimator.compute_territory();
    let dead_stones = estimator.get_dead_stones(player_to_move, trials, tolerance);

    Ok((ownership, territory, dead_stones))
}

// 估算死子
fn parse_position(pos: &str) -> Result<(i32, i32), String> {
    let parts: Vec<&str> = pos.split(',').collect();
    if parts.len() != 2 {
        return Err("Invalid position format".to_string());
    }

    let x: i32 = parts[0].parse().map_err(|_| "Invalid x coordinate")?;
    let y: i32 = parts[1].parse().map_err(|_| "Invalid y coordinate")?;

    Ok((x, y))
}
