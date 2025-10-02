import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import IndexPage from "../views/IndexPage/index.vue";
import RoomPage from "../views/RoomPage/index.vue";
import AIPage from "../views/AIPage/index.vue";
import LoginPage from "../views/LoginPage/index.vue";
import LeaderboardPage from "../views/LeaderboardPage/index.vue";
import LobbyPage from "../views/LobbyPage/index.vue";
import RecentPage from "../views/RecentPage/index.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "Index",
    component: IndexPage
  },
  {
    path: "/room/:id",
    name: "Room",
    component: RoomPage
  },
  {
    path: "/login",
    name: "Login",
    component: LoginPage
  },
  {
    path: "/leaderboard",
    name: "Leaderboard",
    component: LeaderboardPage
  },
  {
    path: "/recent",
    name: "Recent",
    component: RecentPage
  },
  {
    path: "/lobby",
    name: "Lobby",
    component: LobbyPage
  },
  {
    path: "/ai/:id",
    name: "AIBattle",
    component: AIPage
  },
  // {
  //   path: "/join/:id",
  //   name: "Join",
  //   component: JoinPage
  // },
  {
    path: "/:pathMatch(.*)*",
    redirect: "/"
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

export default router;
