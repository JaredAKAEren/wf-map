import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "cn.ryan.wfmap",
  appName: "WF MAP",
  webDir: "dist",
  android: { allowMixedContent: false },
};

export default config;
