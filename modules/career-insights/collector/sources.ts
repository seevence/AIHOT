import type {
  CareerSourceAdapter,
  CareerSourceDefinition,
} from "./index";

export const CAREER_SOURCE_DEFINITIONS: readonly CareerSourceDefinition[] = [
  {
    source_key: "alibaba-official-careers",
    label: "阿里巴巴官方招聘",
    kind: "company_careers",
    entry_url: "https://talent.alibaba.com/",
    access: "playwright",
    enabled: false,
    notes:
      "尚未试抓；仅考虑公开动态页面，不访问需登录内容，不绕过验证码或访问控制。启用前须确认具体列表 URL、公开可访问性、访问频率和字段映射。",
  },
  {
    source_key: "tencent-official-careers",
    label: "腾讯官方招聘",
    kind: "company_careers",
    entry_url: "https://careers.tencent.com/",
    access: "playwright",
    enabled: false,
    notes:
      "尚未试抓；仅考虑公开动态页面，不访问需登录内容，不绕过验证码或访问控制。启用前须确认具体列表 URL、公开可访问性、访问频率和字段映射。",
  },
  {
    source_key: "bytedance-official-careers",
    label: "字节跳动官方招聘",
    kind: "company_careers",
    entry_url: "https://jobs.bytedance.com/",
    access: "playwright",
    enabled: false,
    notes:
      "尚未试抓；仅考虑公开动态页面，不访问需登录内容，不绕过验证码或访问控制。启用前须确认具体列表 URL、公开可访问性、访问频率和字段映射。",
  },
  {
    source_key: "state-council-policy",
    label: "中国政府网政策文件库",
    kind: "government_policy",
    entry_url: "https://www.gov.cn/zhengce/zhengceku/",
    access: "http",
    enabled: false,
    notes:
      "尚未试抓；仅访问公开政策页面，遵守网站条款并限制访问频率，不绕过访问控制。启用前须确认具体列表 URL、公开可访问性和解析方式。",
  },
  {
    source_key: "ndrc-policy",
    label: "国家发展改革委政策发布",
    kind: "government_policy",
    entry_url: "https://www.ndrc.gov.cn/xxgk/zcfb/",
    access: "http",
    enabled: false,
    notes:
      "尚未试抓；仅访问公开政策页面，遵守网站条款并限制访问频率，不绕过访问控制。启用前须确认具体列表 URL、公开可访问性和解析方式。",
  },
];

export const CAREER_SOURCE_ADAPTERS: readonly CareerSourceAdapter[] = [];