use std::path::Path;

fn main() {
    let score_estimator_dir = "katago/score-estimator-master";
    
    // 检查score-estimator目录是否存在
    if !Path::new(score_estimator_dir).exists() {
        panic!("Score estimator directory not found: {}", score_estimator_dir);
    }

    // 编译简化的C++源文件
    cc::Build::new()
        .cpp(true)
        .std("c++17")
        .file(format!("{}/simple_estimator.cpp", score_estimator_dir))
        .opt_level(2)
        .compile("score_estimator");

    // 链接数学库
    println!("cargo:rustc-link-lib=m");
    
    // 重新构建如果源文件改变
    println!("cargo:rerun-if-changed={}/Goban.cc", score_estimator_dir);
    println!("cargo:rerun-if-changed={}/rust_bindings.cpp", score_estimator_dir);
    println!("cargo:rerun-if-changed={}/Goban.h", score_estimator_dir);
    println!("cargo:rerun-if-changed={}/Color.h", score_estimator_dir);
    println!("cargo:rerun-if-changed={}/Point.h", score_estimator_dir);
    println!("cargo:rerun-if-changed={}/Vec.h", score_estimator_dir);
    println!("cargo:rerun-if-changed={}/Grid.h", score_estimator_dir);
    println!("cargo:rerun-if-changed={}/ThreadPool.h", score_estimator_dir);
    println!("cargo:rerun-if-changed={}/constants.h", score_estimator_dir);
    println!("cargo:rerun-if-changed={}/log.h", score_estimator_dir);
}
