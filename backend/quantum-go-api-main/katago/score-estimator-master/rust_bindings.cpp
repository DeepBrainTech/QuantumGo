#include "Goban.h"
#include <vector>
#include <cstring>

// 禁用调试输出
#undef DEBUG

extern "C" {
    // 创建棋盘
    void* create_goban(int width, int height) {
        return new Goban(width, height);
    }
    
    // 销毁棋盘
    void destroy_goban(void* goban) {
        delete static_cast<Goban*>(goban);
    }
    
    // 设置棋子
    void set_stone(void* goban, int x, int y, int color) {
        Goban* g = static_cast<Goban*>(goban);
        Point p(x, y);
        g->at(p) = color;
    }
    
    // 估算分数
    void estimate_score(void* goban, int player_to_move, int trials, float tolerance, 
                       float* ownership, int* width, int* height) {
        Goban* g = static_cast<Goban*>(goban);
        *width = g->width;
        *height = g->height;
        
        Grid result = g->estimate(static_cast<Color>(player_to_move), trials, tolerance, false);
        
        // 将结果复制到ownership数组
        for (int y = 0; y < g->height; y++) {
            for (int x = 0; x < g->width; x++) {
                Point p(x, y);
                ownership[y * g->width + x] = result[p];
            }
        }
    }
    
    // 计算领地
    void compute_territory(void* goban, float* territory, int* width, int* height) {
        Goban* g = static_cast<Goban*>(goban);
        *width = g->width;
        *height = g->height;
        
        Grid result = g->computeTerritory();
        
        // 将结果复制到territory数组
        for (int y = 0; y < g->height; y++) {
            for (int x = 0; x < g->width; x++) {
                Point p(x, y);
                territory[y * g->width + x] = result[p];
            }
        }
    }
    
    // 获取死子
    void get_dead_stones(void* goban, int trials, float tolerance, 
                        int* dead_stones, int* count, int max_count) {
        Goban* g = static_cast<Goban*>(goban);
        
        // 创建一个空的rollout结果用于比较
        Grid rollout_pass(g->width, g->height);
        Vec dead = g->getDead(trials, tolerance, rollout_pass);
        
        *count = 0;
        for (int i = 0; i < dead.size() && i < max_count; i++) {
            dead_stones[i * 2] = dead[i].x;
            dead_stones[i * 2 + 1] = dead[i].y;
            (*count)++;
        }
    }
}
