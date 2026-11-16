export const SKILL_DICTIONARY_VERSION = "0.1" as const;
export const THEME_DICTIONARY_VERSION = "0.1" as const;

export const SKILL_ALIASES: Readonly<Record<string, string>> = {
  python: "python",
  py: "python",
  sql: "sql",
  "机器学习": "machine_learning",
  "machine learning": "machine_learning",
  ml: "machine_learning",
  "深度学习": "deep_learning",
  "deep learning": "deep_learning",
  pytorch: "pytorch",
  tensorflow: "tensorflow",
  "大语言模型": "large_language_models",
  大模型: "large_language_models",
  llm: "large_language_models",
  llms: "large_language_models",
  "自然语言处理": "natural_language_processing",
  nlp: "natural_language_processing",
  "计算机视觉": "computer_vision",
  cv: "computer_vision",
  "数据分析": "data_analysis",
  "数据挖掘": "data_mining",
  "数据工程": "data_engineering",
  spark: "spark",
  java: "java",
  javascript: "javascript",
  typescript: "typescript",
  react: "react",
  "node.js": "nodejs",
  nodejs: "nodejs",
};

export const THEME_LABELS: Readonly<Record<string, string>> = {
  artificial_intelligence: "人工智能",
  ai_innovation: "人工智能创新",
  digital_economy: "数字经济",
  industrial_digitalization: "产业数字化",
  data_infrastructure: "数据基础设施",
  talent_development: "人才培养",
  employment_promotion: "就业促进",
};