# 燕大终端 HarmonyOS 版

燕山大学教务系统第三方客户端，使用 Next.js 构建本地页面，并由 HarmonyOS ArkTS 与 ArkWeb 承载。应用并非学校官方产品。

鸿蒙工程位于 `harmony/`。`app/`、`components/`、`lib/`、`providers/` 等目录包含鸿蒙版依赖的共享页面、认证和查询逻辑。共享代码中的部分跨平台适配仍是当前构建依赖。

## 构建

安装锁定的前端依赖，并配置 DevEco Studio 与 HarmonyOS SDK：

```powershell
pnpm install --frozen-lockfile
pnpm run build:harmony:hap
```

未签名产物位于 `harmony/entry/build/default/outputs/default/entry-default-unsigned.hap`。设备安装通常需要自行配置开发者签名。构建、安全边界和设备验收说明见 [鸿蒙工程说明](harmony/README.md)。

本项目遵循 GPL-3.0，详见 [LICENSE](LICENSE)。
