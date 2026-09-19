// Vite+ 的通用 TypeScript 检查识别 SFC 导入；模板与 props 仍由 vue-tsc 完整检查。
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent;
  export default component;
}
