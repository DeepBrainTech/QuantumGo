#include <vector>
#include <algorithm>
#include <cmath>

// 简化的分数估算器实现
class SimpleEstimator {
public:
    int width;
    int height;
private:
    std::vector<int> board;
    
public:
    SimpleEstimator(int w, int h) : width(w), height(h) {
        board.resize(w * h, 0);
    }
    
    void setStone(int x, int y, int color) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
            board[y * width + x] = color;
        }
    }
    
    std::vector<float> estimateOwnership(int playerToMove) {
        std::vector<float> ownership(width * height, 0.0f);
        
        // 简单的领地估算算法
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int idx = y * width + x;
                int stone = board[idx];
                
                if (stone == 1) { // 黑子
                    ownership[idx] = 1.0f;
                } else if (stone == 2) { // 白子
                    ownership[idx] = -1.0f;
                } else { // 空位
                    // 简单的距离估算
                    float blackInfluence = 0.0f;
                    float whiteInfluence = 0.0f;
                    
                    for (int dy = 0; dy < height; dy++) {
                        for (int dx = 0; dx < width; dx++) {
                            int stoneIdx = dy * width + dx;
                            int stoneType = board[stoneIdx];
                            
                            if (stoneType != 0) {
                                float distance = std::sqrt((x - dx) * (x - dx) + (y - dy) * (y - dy));
                                float influence = 1.0f / (1.0f + distance);
                                
                                if (stoneType == 1) {
                                    blackInfluence += influence;
                                } else if (stoneType == 2) {
                                    whiteInfluence += influence;
                                }
                            }
                        }
                    }
                    
                    if (blackInfluence > whiteInfluence) {
                        ownership[idx] = blackInfluence / (blackInfluence + whiteInfluence);
                    } else if (whiteInfluence > blackInfluence) {
                        ownership[idx] = -whiteInfluence / (blackInfluence + whiteInfluence);
                    }
                }
            }
        }
        
        return ownership;
    }
    
    std::vector<float> computeTerritory() {
        std::vector<float> territory(width * height, 0.0f);
        
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int idx = y * width + x;
                int stone = board[idx];
                
                if (stone == 1) { // 黑子
                    territory[idx] = 1.0f;
                } else if (stone == 2) { // 白子
                    territory[idx] = -1.0f;
                } else { // 空位
                    // 简单的领地计算
                    float blackTerritory = 0.0f;
                    float whiteTerritory = 0.0f;
                    
                    for (int dy = 0; dy < height; dy++) {
                        for (int dx = 0; dx < width; dx++) {
                            int stoneIdx = dy * width + dx;
                            int stoneType = board[stoneIdx];
                            
                            if (stoneType != 0) {
                                float distance = std::sqrt((x - dx) * (x - dx) + (y - dy) * (y - dy));
                                float influence = 1.0f / (1.0f + distance * 0.5f);
                                
                                if (stoneType == 1) {
                                    blackTerritory += influence;
                                } else if (stoneType == 2) {
                                    whiteTerritory += influence;
                                }
                            }
                        }
                    }
                    
                    if (blackTerritory > whiteTerritory) {
                        territory[idx] = blackTerritory - whiteTerritory;
                    } else if (whiteTerritory > blackTerritory) {
                        territory[idx] = -(whiteTerritory - blackTerritory);
                    }
                }
            }
        }
        
        return territory;
    }
};

extern "C" {
    // 创建估算器
    void* create_estimator(int width, int height) {
        return new SimpleEstimator(width, height);
    }
    
    // 销毁估算器
    void destroy_estimator(void* estimator) {
        delete static_cast<SimpleEstimator*>(estimator);
    }
    
    // 设置棋子
    void set_stone(void* estimator, int x, int y, int color) {
        SimpleEstimator* est = static_cast<SimpleEstimator*>(estimator);
        est->setStone(x, y, color);
    }
    
    // 估算分数
    void estimate_score(void* estimator, int player_to_move, int trials, float tolerance, 
                       float* ownership, int* width, int* height) {
        SimpleEstimator* est = static_cast<SimpleEstimator*>(estimator);
        *width = est->width;
        *height = est->height;
        
        std::vector<float> result = est->estimateOwnership(player_to_move);
        
        // 将结果复制到ownership数组
        for (size_t i = 0; i < result.size(); i++) {
            ownership[i] = result[i];
        }
    }
    
    // 计算领地
    void compute_territory(void* estimator, float* territory, int* width, int* height) {
        SimpleEstimator* est = static_cast<SimpleEstimator*>(estimator);
        *width = est->width;
        *height = est->height;
        
        std::vector<float> result = est->computeTerritory();
        
        // 将结果复制到territory数组
        for (size_t i = 0; i < result.size(); i++) {
            territory[i] = result[i];
        }
    }
    
    // 获取死子（简化版本，返回空）
    void get_dead_stones(void* estimator, int trials, float tolerance, 
                        int* dead_stones, int* count, int max_count) {
        *count = 0;
    }
}
