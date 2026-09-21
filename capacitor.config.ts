import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "cn.ryan.wfmap",
  appName: "WF MAP",
  webDir: "dist",
  android: { allowMixedContent: false, backgroundColor: "#f0ede7" },
  plugins: {
    SplashScreen: {
      backgroundColor: "#f4980f",
      launchAutoHide: true,
      launchFadeOutDuration: 200,
      launchShowDuration: 3000,
    },
  },
};

export default config;
