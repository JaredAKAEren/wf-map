# WF 逛展地图

为逛上海 WF 展会制作的 Android 离线地图，用于浏览展馆、查找展位，并为展位添加现场照片、商品信息图等贴图。地图和展位资料随应用提供，无需账号或后端服务。

## 主要功能

- **地图浏览**：在一张连续地图中查看 W1—W5，支持展馆切换、拖动、双指缩放和双击放大。
- **展位搜索**：按已收录的名称、拼音、首字母或展位编号搜索，支持英文名称的轻微拼写容错；选择结果后定位并展示详情。
- **展位贴图**：展开贴图后，点击图片列表中的加号，通过 Android 系统选择器添加图片；点击图片查看原图，长按图片（桌面端右键）显示解除关联按钮，点击其他位置关闭。图片已关联其他展位时，需确认后才能改绑。应用只保存原图引用，不复制、移动或删除原图。
- **视图恢复**：重新打开应用时恢复地图视野和正在查看的展位。
- **离线使用**：地图、搜索和本地贴图关联在设备上完成。

目前随包提供 W1—W5 底图；W2—W5 已录入企业展位和个人展商图中清晰可辨的展位数据，W1 已录入底图主分区及个人展商图中的 620 条细分记录，均支持搜索、点击和贴图关联。W1 已人工确认 619 条名称，另有 1 条看不清，保留编号待补录。

## 技术栈

- **Vue 3 + TypeScript**：界面、地图交互与搜索逻辑。
- **Reka UI**：界面基础组件。
- **Vite+**：开发服务器、构建与工程工具。
- **Capacitor + Java**：Android 打包及系统图片访问；使用 Preferences 保存视图状态，SQLite 保存贴图关联。

## 本地开发

先按 [Vite+ 安装说明](https://viteplus.dev/guide/)安装 `vp`，然后克隆仓库并启动开发服务器：

```sh
git clone https://github.com/JaredAKAEren/wf-map.git
cd wf-map
vp env install
vp install --frozen-lockfile
vp run dev
```

打开终端显示的本地地址即可预览。项目使用 Node.js **24.20.0** 和 pnpm **11.25.0**，分别由 `.node-version` 和 `package.json` 固定；Vite+ 可管理对应版本。所有项目命令均在仓库根目录执行。

浏览器可用于开发地图和搜索界面，系统图片选择与关联需要在 Android 应用中使用。

构建 Web 静态资源：

```sh
vp run build
```

产物位于 `dist/`。地图图片在 `public/maps/`，展位名称、检索词和坐标在 `src/data/exhibition.ts`；补充展位资料时需保持已有展位 ID 不变，以保留贴图关联。

## Android 构建

### 环境准备

完成上述依赖安装后，还需安装：

- **JDK 21**。
- **Android SDK Platform 36**。
- **Android SDK Build-Tools 35.0.0**，对应项目所用 [Android Gradle Plugin 的默认版本](https://developer.android.com/build/releases/agp-8-13-0-release-notes)。
- **Android SDK Platform-Tools**，用于通过 USB 安装应用。

可通过 Android Studio 的 SDK Manager 安装 SDK 组件并接受许可；选择 Build-Tools 版本时需勾选 **Show Package Details**。也可使用 [Android 命令行工具](https://developer.android.com/tools/sdkmanager)安装。

以下构建命令适用于 macOS / Linux。将环境变量中的路径替换为本机实际安装位置：

```sh
export JAVA_HOME="/path/to/jdk-21"
export ANDROID_HOME="/path/to/android-sdk"
```

`JAVA_HOME` 应指向包含 `bin/java` 的目录，`ANDROID_HOME` 应指向包含 `platforms/` 和 `build-tools/` 的 SDK 根目录。只配置 Android Studio 内的 JDK 或 `android/local.properties` 不足以运行本仓库的构建脚本，仍需设置这两个环境变量。

仓库已包含 Gradle Wrapper，无需另行安装 Gradle。首次安装依赖和构建需要联网下载工具及依赖；运行应用时可离线使用。

### 生成 APK

```sh
vp run android:debug
```

该命令会依次构建 Web 资源、同步到 Android 工程并生成 APK，无需手动执行同步。构建成功后终端会显示产物路径，默认位于：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

生成的是使用本地调试签名的开发版，无需配置发布密钥。开发版包名为 `cn.ryan.wfmap.debug`，与正式版可同时安装，数据相互独立。

应用最低安装版本为 Android 10（API 29），Web 界面的构建兼容基线为 Chromium 111 及以上。Android 系统版本与 WebView 版本独立，使用前请更新设备上的 Android System WebView。

### 安装到手机

在手机上启用 USB 调试，通过 USB 连接电脑并授权。仅连接一台设备时，在仓库根目录运行：

```sh
vp run android:deploy
```

该命令会重新构建、覆盖安装并启动开发版。修改代码后可再次运行，无需在手机上连接开发服务器。

## 反馈与维护

这是我根据个人逛展需求开发和维护的项目。如果遇到使用问题或发现展位资料有误，欢迎在 [Issues](https://github.com/JaredAKAEren/wf-map/issues) 中反馈，并尽量附上设备信息、复现步骤或相关截图。

项目按个人需求维护，不接受新功能请求。如果你有不同的使用需求，欢迎 fork 后自行扩展。
