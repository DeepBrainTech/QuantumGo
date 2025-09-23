use std::path::Path;

fn main() {
    let score_estimator_dir = "katago/score-estimator-master";

    if !Path::new(score_estimator_dir).exists() {
        panic!(
            "Score estimator directory not found: {}",
            score_estimator_dir
        );
    }

    cc::Build::new()
        .cpp(true)
        .std("c++17")
        .define("NOMINMAX", None)
        .define("WIN32_LEAN_AND_MEAN", None)
        .define("DEBUG", Some("1"))
        .file(format!("{}/Goban.cc", score_estimator_dir))
        .file(format!("{}/simple_estimator.cpp", score_estimator_dir))
        .include(score_estimator_dir)
        .opt_level(2)
        .compile("score_estimator");

    println!("cargo:rustc-link-lib=m");

    println!("cargo:rerun-if-changed={}/Goban.cc", score_estimator_dir);
    println!("cargo:rerun-if-changed={}/Goban.h", score_estimator_dir);
    println!("cargo:rerun-if-changed={}/Color.h", score_estimator_dir);
    println!("cargo:rerun-if-changed={}/Point.h", score_estimator_dir);
    println!("cargo:rerun-if-changed={}/Vec.h", score_estimator_dir);
    println!("cargo:rerun-if-changed={}/Grid.h", score_estimator_dir);
    println!("cargo:rerun-if-changed={}/ThreadPool.h", score_estimator_dir);
    println!("cargo:rerun-if-changed={}/constants.h", score_estimator_dir);
    println!("cargo:rerun-if-changed={}/log.h", score_estimator_dir);
}
