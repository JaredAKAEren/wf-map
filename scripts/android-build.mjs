import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";

function findArtifacts(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return findArtifacts(path);
    }
    return [".apk", ".aab"].includes(extname(entry.name)) ? [path] : [];
  });
}

const root = process.cwd();
const localTools = resolve(root, ".tools");
const bundledJdk = existsSync(localTools)
  ? readdirSync(localTools).find((name) => {
      return name.startsWith("jdk-");
    })
  : undefined;
const javaHome =
  process.env.JAVA_HOME ??
  (bundledJdk ? resolve(localTools, bundledJdk, "Contents/Home") : undefined);
const sdk =
  process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? resolve(localTools, "android-sdk");
if (
  !javaHome ||
  !existsSync(resolve(javaHome, "bin/java")) ||
  !existsSync(resolve(sdk, "platforms/android-36"))
) {
  console.error("缺少 JDK 21 或 Android SDK 36。请按 README 配置 JAVA_HOME 与 ANDROID_HOME。");
  process.exit(1);
}
const requestedTasks = process.argv.slice(2);
const gradleTasks = requestedTasks.length ? requestedTasks : [":app:assembleDebug"];
const artifactTasks = gradleTasks.filter((task) => {
  return /(?:^|:)(?:assemble|bundle)/i.test(task);
});
const outputsDirectory = resolve(root, "android/app/build/outputs");
const artifactsBeforeBuild = new Map(
  findArtifacts(outputsDirectory).map((path) => {
    return [path, statSync(path).mtimeMs];
  }),
);
const result = spawnSync("./gradlew", [...gradleTasks, "--no-daemon"], {
  cwd: resolve(root, "android"),
  stdio: "inherit",
  env: {
    ...process.env,
    JAVA_HOME: javaHome,
    ANDROID_HOME: sdk,
    GRADLE_USER_HOME: resolve(localTools, "gradle"),
  },
});

const status = result.status ?? 1;
if (status === 0 && artifactTasks.length > 0) {
  const artifactExtensions = new Set(
    artifactTasks.map((task) => {
      return /bundle/i.test(task) ? ".aab" : ".apk";
    }),
  );
  const buildTypes = new Set(
    artifactTasks.flatMap((task) => {
      return task.match(/(?:debug|release)$/i)?.[0].toLowerCase() ?? [];
    }),
  );
  const candidates = findArtifacts(outputsDirectory)
    .filter((path) => {
      return artifactExtensions.has(extname(path));
    })
    .filter((path) => {
      if (buildTypes.size === 0) {
        return true;
      }
      const pathSegments = path.toLowerCase().split(/[\\/]/);
      return [...buildTypes].some((buildType) => {
        return pathSegments.includes(buildType);
      });
    })
    .toSorted((left, right) => {
      return statSync(right).mtimeMs - statSync(left).mtimeMs;
    });
  const changedArtifacts = candidates.filter((path) => {
    const previousModifiedTime = artifactsBeforeBuild.get(path);
    return previousModifiedTime === undefined || statSync(path).mtimeMs > previousModifiedTime;
  });
  const artifacts = changedArtifacts.length > 0 ? changedArtifacts : candidates.slice(0, 1);

  if (artifacts.length > 0) {
    console.log("\n构建产物：");
    for (const artifact of artifacts) {
      console.log(`- ${artifact}`);
    }
  }
}

process.exit(status);
