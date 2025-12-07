export default {
  // 基本格式化
  semi: false, // 行尾不加分号
  singleQuote: true, // JS/TS 使用单引号
  printWidth: 100, // 一行最长 100 个字符
  tabWidth: 2, // 缩进 2 个空格
  useTabs: false, // 不使用 Tab

  // 尾逗号和空格
  trailingComma: "all", // 尾逗号，方便 git diff 干净
  bracketSpacing: true, // 对象大括号内有空格

  // 箭头函数和 JSX
  arrowParens: "avoid", // 单参数箭头函数不加括号
  jsxSingleQuote: false, // JSX 内使用双引号

  // 换行和空格
  endOfLine: "lf", // Unix 换行符
  htmlWhitespaceSensitivity: "ignore", // HTML/JSX 空格敏感度忽略
  proseWrap: "preserve", // Markdown 保留换行

  // TypeScript / Vue / JSON / Markdown
  embeddedLanguageFormatting: "auto", // 内嵌语言自动格式化
  quoteProps: "as-needed", // 对象属性按需加引号
  bracketSameLine: false, // JSX 标签闭合 > 是否另起一行

  // 团队协作
  requirePragma: false, // 不强制文件加 @format
  insertPragma: false, // 不插入 @format 注释
};
