# WF 逛展地图

为逛上海 WF 展会制作的离线地图，提供 Android 应用和可安装的网页版，用于浏览展馆、查找展位，并为展位添加现场照片、商品信息图等贴图。地图和展位资料随应用提供，无需账号或后端服务。

## 主要功能

- **地图浏览**：在一张连续地图中查看 W1—W5，支持点击展馆切换、长按当前展馆后左右滑动切馆、拖动地图、双指缩放和双击放大。
- **展位搜索**：按已收录的名称、拼音、首字母或展位编号搜索，支持英文名称的轻微拼写容错；选择结果后定位并展示详情。
- **收藏与筛选**：收藏感兴趣的展位，支持按“已贴图”“已收藏”筛选，并在筛选结果中继续搜索。
- **展位贴图**：为展位添加现场照片、商品信息图等图片，支持查看原图、调整图片所属展位和解除关联。
- **视图恢复**：重新打开应用时恢复地图视野和正在查看的展位。
- **离线使用**：地图、搜索和本地贴图关联在设备上完成。
- **添加到桌面**：网页版首次访问提供安装提示，也可随时点击“安装”查看步骤。

目前随包提供 W1—W5 底图；W2—W5 已录入企业展位和个人展商图中清晰可辨的展位数据，W1 已录入底图主分区及个人展商图中的 620 条细分记录，均支持搜索、点击和贴图关联。W1 已人工确认 619 条名称，另有 1 条看不清，保留编号待补录。

## 技术栈

- **Vue 3 + TypeScript**：界面、地图交互与搜索逻辑。
- **Reka UI**：界面基础组件。
- **Vite+**：开发服务器、构建与工程工具。
- **Capacitor + Java**：Android 打包及系统图片访问；使用 Preferences 保存视图状态，SQLite 保存贴图关联。
- **PWA + IndexedDB**：网页版缓存地图与界面资源，并在浏览器本地保存贴图。

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

浏览器中也可添加、查看和管理贴图。浏览器与 Android 应用的贴图数据互不共享。

构建 Web 静态资源：

```sh
vp run build
```

产物位于 `dist/`。地图图片在 `public/maps/`，展位名称、检索词和坐标在 `src/data/exhibition.ts`；补充展位资料时需保持已有展位 ID 不变，以保留贴图关联。

## 网页版与离线安装

启用 Pages 并完成发布后，网页版地址为 [GitHub Pages](https://JaredAKAEren.github.io/wf-map/)。首次在线打开并等待页面右上角出现“安装”入口后，即可从浏览器菜单或页面入口添加到桌面。iPhone/iPad 通过浏览器的“分享”菜单选择“添加到主屏幕”。请先安装，再从桌面应用内添加贴图；iOS 浏览器和桌面应用不会共享已有的浏览器贴图数据。

网页版贴图仅保存在当前浏览器或已安装应用的本地存储中，不会上传或跨设备同步。清除站点数据、卸载应用或浏览器回收存储空间可能使贴图副本丢失；设备相册中的源文件不会受影响。为当前仓库生成 GitHub Pages 产物：

```sh
vp run build:pages
vp run test:pages
```

如需在本地浏览器查看安装入口、弹窗和离线行为，运行：

```sh
vp run preview:pages
```

Pages 构建使用 `/wf-map/` 路径并生成 Web App Manifest 与 Service Worker；普通 `vp run build` 仍用于 Android，同一份资源不会注册网页 Service Worker。`.github/workflows/pages.yml` 会在 `main` 更新后检查并部署 `dist/`；仓库 Pages 的 Source 设置为 **GitHub Actions**。

已安装或已缓存的网页版会继续使用当前版本；联网时在后台缓存新版本，全部准备完成后提示刷新。离线或更新失败时不会清除当前可用缓存。

## 常见问题

### 小米浏览器 PWA 无法选择文件

小米 HyperOS 系统浏览器安装到桌面的 PWA 可能无法打开系统图片选择器：点击“添加贴图”后不会弹出选择界面，继续点击也没有反应。这是小米浏览器 PWA 容器的兼容限制，与网站的照片权限无关。可尝试使用其他浏览器安装。

### 添加到桌面前需要开启什么权限？

Android 浏览器添加到桌面前，需要在该浏览器的系统权限中允许“桌面快捷方式”或“主屏幕快捷方式”。如果确认安装后只打开了浏览器的应用信息，或桌面没有出现图标，请开启该权限，再返回页面刷新并重试安装。

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
