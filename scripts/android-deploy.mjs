import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const localTools = resolve(root, ".tools");
const sdk =
  process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? resolve(localTools, "android-sdk");
const adb = resolve(sdk, "platform-tools/adb");
const apk = resolve(root, "android/app/build/outputs/apk/debug/app-debug.apk");
const bundledJdk = existsSync(localTools)
  ? readdirSync(localTools).find((name) => {
      return name.startsWith("jdk-");
    })
  : undefined;
const javaHome =
  process.env.JAVA_HOME ??
  (bundledJdk ? resolve(localTools, bundledJdk, "Contents/Home") : undefined);
const environment = {
  ...process.env,
  ANDROID_HOME: sdk,
  GRADLE_USER_HOME: resolve(localTools, "gradle"),
  ...(javaHome ? { JAVA_HOME: javaHome } : {}),
};

if (!existsSync(adb)) {
  console.error(`未找到 adb：${adb}`);
  process.exit(1);
}

const devicesResult = spawnSync(adb, ["devices"], { encoding: "utf8" });
if (devicesResult.status !== 0) {
  process.stderr.write(devicesResult.stderr);
  process.exit(devicesResult.status ?? 1);
}

const devices = devicesResult.stdout
  .split("\n")
  .slice(1)
  .map((line) => {
    return line.trim().split(/\s+/);
  })
  .filter(([, status]) => {
    return status === "device";
  })
  .map(([serial]) => {
    return serial;
  });

if (devices.length !== 1) {
  console.error(`需要且只能连接一台已授权设备，当前检测到 ${devices.length} 台。`);
  process.exit(1);
}

const serial = devices[0];

function run(command, arguments_) {
  const result = spawnSync(command, arguments_, {
    cwd: root,
    env: environment,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("vp", ["run", "android:sync"]);
run("node", ["scripts/android-build.mjs", ":app:assembleDebug"]);

if (!existsSync(apk)) {
  console.error(`未找到 debug APK：${apk}`);
  process.exit(1);
}

run(adb, ["-s", serial, "install", "-r", "--fastdeploy", apk]);
run(adb, ["-s", serial, "shell", "am", "force-stop", "cn.ryan.wfmap.debug"]);
run(adb, [
  "-s",
  serial,
  "shell",
  "am",
  "start",
  "-n",
  "cn.ryan.wfmap.debug/cn.ryan.wfmap.MainActivity",
]);

console.log("\n开发版已覆盖安装并启动；应用内容来自 APK，不依赖电脑上的开发服务器。\n");
