import { createApp } from "vue";

import App from "./App.vue";
import { registerPwa } from "./services/pwa";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/primitives.css";
import "./styles/motion.css";

window.addEventListener("load", () => {
  void registerPwa();
});

createApp(App).mount("#app");
