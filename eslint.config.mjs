import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
    baseDirectory: __dirname,
});

const eslintConfig = [
    ...compat.extends("next/core-web-vitals", "next/typescript"),
    {
        rules: {
            "react/no-unescaped-entities": "off", // 允许在 HTML 中直接使用引号和撇号
            "@typescript-eslint/no-unused-vars": "off", // 允许存在未使用的变量/图标
            "@typescript-eslint/no-explicit-any": "off", // 允许使用 any 类型
            "react-hooks/exhaustive-deps": "warn", // 将 Hook 依赖项错误降级为警告
        },
    },
];

export default eslintConfig;
