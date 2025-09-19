#include "Goban.h"
#include "Color.h"
#include "Point.h"
#include "Vec.h"
#include "Grid.h"

#include <algorithm>

namespace {
inline Color to_color(int color) {
    if (color == 1) {
        return BLACK;
    }
    if (color == 2 || color == -1) {
        return WHITE;
    }
    return BLACK;
}

inline int to_board_value(int color) {
    if (color == 1) {
        return 1;
    }
    if (color == 2 || color == -1) {
        return -1;
    }
    return 0;
}
}

extern "C" {
    void* create_estimator(int width, int height) {
        return new Goban(width, height);
    }

    void destroy_estimator(void* estimator) {
        delete static_cast<Goban*>(estimator);
    }

    void set_stone(void* estimator, int x, int y, int color) {
        auto* g = static_cast<Goban*>(estimator);
        Point p(x, y);
        g->at(p) = to_board_value(color);
    }

    void estimate_score(
        void* estimator,
        int player_to_move,
        int trials,
        float tolerance,
        float* ownership,
        int* width,
        int* height
    ) {
        auto* g = static_cast<Goban*>(estimator);
        *width = g->width;
        *height = g->height;

        Color player = to_color(player_to_move);
        Grid result = g->estimate(player, trials, tolerance, false);

        for (int y = 0; y < g->height; ++y) {
            for (int x = 0; x < g->width; ++x) {
                Point p(x, y);
                ownership[y * g->width + x] = result[p];
            }
        }
    }

    void compute_territory(
        void* estimator,
        float* territory,
        int* width,
        int* height
    ) {
        auto* g = static_cast<Goban*>(estimator);
        *width = g->width;
        *height = g->height;

        Grid result = g->computeTerritory();

        for (int y = 0; y < g->height; ++y) {
            for (int x = 0; x < g->width; ++x) {
                Point p(x, y);
                territory[y * g->width + x] = result[p];
            }
        }
    }

    void get_dead_stones(
        void* estimator,
        int player_to_move,
        int trials,
        float tolerance,
        int* dead_stones,
        int* count,
        int max_count
    ) {
        auto* g = static_cast<Goban*>(estimator);
        Color player = to_color(player_to_move);

        if (!g->isLastDeadValid(player)) {
            g->estimate(player, trials, tolerance, false);
        }

        const Vec& dead = g->getLastDead();
        int limit = dead.size;
        if (limit > max_count) {
            limit = max_count;
        }

        *count = limit;
        for (int i = 0; i < limit; ++i) {
            dead_stones[i * 2] = dead[i].x;
            dead_stones[i * 2 + 1] = dead[i].y;
        }
    }
}
