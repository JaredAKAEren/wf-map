import { createApp } from "vue";

import App from "./App.vue";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/primitives.css";
import "./styles/motion.css";

if (import.meta.env.VITE_WF_PAGES === "1" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    });
  });
}

createApp(App).mount("#app");
