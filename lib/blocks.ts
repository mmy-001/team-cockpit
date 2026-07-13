export type BlockType = "paragraph" | "heading_1" | "heading_2" | "heading_3" | "bulleted_list_item" | "numbered_list_item" | "quote" | "divider" | "image" | "video";

export type EditorBlock = {
  id: string;
  type: BlockType;
  content: string;
  url?: string;
};

export function toNotionBlocks(blocks: EditorBlock[]): any[] {
  return blocks.map((b) => {
    switch (b.type) {
      case "paragraph":
        return { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: b.content } }] } };
      case "heading_1":
        return { object: "block", type: "heading_1", heading_1: { rich_text: [{ type: "text", text: { content: b.content } }] } };
      case "heading_2":
        return { object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: b.content } }] } };
      case "heading_3":
        return { object: "block", type: "heading_3", heading_3: { rich_text: [{ type: "text", text: { content: b.content } }] } };
      case "bulleted_list_item":
        return { object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ type: "text", text: { content: b.content } }] } };
      case "numbered_list_item":
        return { object: "block", type: "numbered_list_item", numbered_list_item: { rich_text: [{ type: "text", text: { content: b.content } }] } };
      case "quote":
        return { object: "block", type: "quote", quote: { rich_text: [{ type: "text", text: { content: b.content } }] } };
      case "divider":
        return { object: "block", type: "divider", divider: {} };
      case "image":
        return {
          object: "block",
          type: "image",
          image: { type: "external", external: { url: b.url ?? "" } },
        };
      case "video":
        return {
          object: "block",
          type: "video",
          video: { type: "external", external: { url: b.url ?? "" } },
        };
      default:
        return { object: "block", type: "paragraph", paragraph: { rich_text: [] } };
    }
  });
}

export function fromNotionBlocks(blocks: any[]): EditorBlock[] {
  return blocks
    .filter((b) => b && b.type)
    .map((b) => {
      const type = b.type as BlockType;
      if (type === "divider") return { id: b.id ?? cryptoRandomId(), type, content: "" };
      if (type === "image") {
        const url = b.image?.external?.url ?? b.image?.file?.url ?? "";
        return { id: b.id ?? cryptoRandomId(), type, content: "", url };
      }
      if (type === "video") {
        const url = b.video?.external?.url ?? b.video?.file?.url ?? "";
        return { id: b.id ?? cryptoRandomId(), type, content: "", url };
      }
      const text = (b[type]?.rich_text ?? [])
        .map((t: any) => t.plain_text ?? t.text?.content ?? "")
        .join("");
      return { id: b.id ?? cryptoRandomId(), type, content: text };
    });
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function createBlock(type: BlockType = "paragraph", content = ""): EditorBlock {
  return { id: cryptoRandomId(), type, content };
}

// ---- 纯文本 ↔ blocks 互转（用于自由编辑器） ----

/** 模板默认文本 */
export const TEMPLATE_TEXT = `一、已完成
- 任务A：已完成XX模块开发，上线后转化率提升 X%
- 任务B：输出竞品分析报告 1 份，核心发现如下…

二、进行中
- 任务C：进行中，预计本周五完成初版，下周一评审
- 任务D：方案设计中，计划下周三交付 PRD

三、问题同步
- 风险A：XX 依赖方未按时交付接口，已沟通确认延至下周二
- 阻塞B：设计方案待领导审批，建议周三前推动定稿

四、下周计划
1. 完成任务C的UI评审并根据反馈修改
2. 启动任务E的技术调研，输出可行性方案`;

/**
 * 将 blocks 数组转回纯文本（用于在 textarea 中展示已有周报）
 * 图片/视频块用特殊标记表示。
 */
export function blocksToText(blocks: EditorBlock[]): string {
  const lines: string[] = [];
  let numIdx = 0;
  blocks.forEach((b) => {
    switch (b.type) {
      case "heading_1":
        if (lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");
        lines.push(b.content);
        break;
      case "heading_2":
        if (lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");
        lines.push(b.content);
        break;
      case "heading_3":
        lines.push(b.content);
        break;
      case "bulleted_list_item":
        lines.push(`- ${b.content}`);
        numIdx = 0;
        break;
      case "numbered_list_item":
        numIdx++;
        lines.push(`${numIdx}. ${b.content}`);
        break;
      case "paragraph":
        if (b.content.trim()) {
          lines.push(b.content);
          numIdx = 0;
        } else {
          lines.push("");
        }
        break;
      case "quote":
        lines.push(`> ${b.content}`);
        numIdx = 0;
        break;
      case "divider":
        lines.push("---");
        numIdx = 0;
        break;
      case "image":
        lines.push(b.url ? `[图片: ${b.url}]` : "[图片]");
        numIdx = 0;
        break;
      case "video":
        lines.push(b.url ? `[视频: ${b.url}]` : "[视频]");
        numIdx = 0;
        break;
    }
  });
  return lines.join("\n");
}

/**
 * 将纯文本解析为 blocks 数组。
 * 规则：
 * - 以「一、」「二、」「三、」「四、」开头的行 → heading_1
 * - 以「- 」开头的行 → bulleted_list_item
 * - 以「数字. 」开头的行 → numbered_list_item
 * - 以「> 」开头 → quote
 * - 以「---」开头的行 → divider
 * - 空行 → 跳过
 * - 其他 → paragraph
 */
export function textToBlocks(text: string): EditorBlock[] {
  const lines = text.split("\n");
  const blocks: EditorBlock[] = [];
  let numIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    // 跳过纯空行（但保留段落间的分隔感）
    if (line.trim() === "") {
      numIdx = 0;
      continue;
    }

    const trimmed = line.trimStart();
    if (/^[一二三四五六七八九十]、/.test(trimmed)) {
      blocks.push(createBlock("heading_1", trimmed));
      numIdx = 0;
    } else if (trimmed.startsWith("- ")) {
      blocks.push(createBlock("bulleted_list_item", trimmed.slice(2)));
      numIdx = 0;
    } else if (/^\d+\.\s/.test(trimmed)) {
      numIdx++;
      const content = trimmed.replace(/^\d+\.\s/, "");
      blocks.push(createBlock("numbered_list_item", content));
    } else if (trimmed.startsWith("> ")) {
      blocks.push(createBlock("quote", trimmed.slice(2)));
      numIdx = 0;
    } else if (trimmed === "---" || trimmed.match(/^-{3,}$/)) {
      blocks.push(createBlock("divider"));
      numIdx = 0;
    } else {
      blocks.push(createBlock("paragraph", trimmed));
      numIdx = 0;
    }
  }
  return blocks;
}

/** 一键排版：规范化 textarea 中的文本格式 */
export function autoFormatText(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let currentSection: string | null = null;
  let numIdx = 0;
  let anyContent = false;
  let lastWasEmpty = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (trimmed === "") {
      numIdx = 0;
      continue; // 跳过所有空行，后续统一加间距
    }

    anyContent = true;

    // 检测节标题（支持多种写法）
    const headingMatch = trimmed.match(/^[一二三四五六七八九十]、\s*(.+)/);
    if (headingMatch) {
      if (result.length > 0) result.push("");
      result.push(`${headingMatch[0]}`);
      currentSection = headingMatch[1].trim();
      numIdx = 0;
      lastWasEmpty = false;
      continue;
    }

    // 也支持 "已完成" "进行中" 等直接作为标题（没有数字前缀时）
    // 去掉 !currentSection 限制，允许多个松散标题按顺序出现
    const looseHeadingMatch = trimmed.match(/^(已完成|进行中|问题同步|下周计划)\s*$/);
    if (looseHeadingMatch) {
      const sectionMap: Record<string, string> = {
        "已完成": "一、已完成",
        "进行中": "二、进行中",
        "问题同步": "三、问题同步",
        "下周计划": "四、下周计划",
      };
      if (result.length > 0) result.push("");
      result.push(sectionMap[looseHeadingMatch[1]]);
      currentSection = looseHeadingMatch[1];
      numIdx = 0;
      lastWasEmpty = false;
      continue;
    }

    // 提取内容（去除已有的格式前缀）
    let content = trimmed;
    content = content.replace(/^[-*•]\s+/, "");     // 去除 -, *, •
    content = content.replace(/^\d+[.、]\s*/, "");  // 去除 1. 1、
    content = content.replace(/^>\s+/, "");          // 去除 >
    content = content.trim();

    if (!content) {
      numIdx = 0;
      continue;
    }

    // 根据当前 section 确定格式
    if (currentSection === "下周计划") {
      numIdx++;
      result.push(`${numIdx}. ${content}`);
    } else if (currentSection && (currentSection.includes("已完成") || currentSection.includes("进行中") || currentSection.includes("问题"))) {
      result.push(`- ${content}`);
    } else if (currentSection) {
      // 未知 section，统一用 bullet
      result.push(`- ${content}`);
    } else {
      // 无节标题的行，保持原样（可能用户还在编辑中）
      result.push(`- ${content}`);
    }

    lastWasEmpty = false;
  }

  // 如果没有任何节标题，智能插入完整模板结构
  const hasHeading = result.some((l) => /^[一二三四五六七八九十]、/.test(l));
  if (!hasHeading && anyContent) {
    result.unshift("", "一、已完成");
  }

  // 规范化间距：最多1个空行
  return result.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * 将 AI 返回的 sections 转为纯文本（用于填入 textarea）。
 * 确保四个板块都存在，缺失的板块会保留标题但内容留空提示。
 */
export function sectionsToText(summary: string, sections: Record<string, string[]>): { summary: string; text: string } {
  const sectionConfig: [string, string][] = [
    ["已完成", "一、已完成"],
    ["进行中", "二、进行中"],
    ["问题同步", "三、问题同步"],
    ["下周计划", "四、下周计划"],
  ];

  const lines: string[] = [];
  sectionConfig.forEach(([key, title]) => {
    lines.push(title);
    const items = sections[key];
    if (Array.isArray(items) && items.length > 0) {
      const validItems = items.filter((item) => typeof item === "string" && item.trim().length > 0);
      if (validItems.length > 0) {
        if (key === "下周计划") {
          validItems.forEach((item, idx) => lines.push(`${idx + 1}. ${item}`));
        } else {
          validItems.forEach((item) => lines.push(`- ${item}`));
        }
      } else {
        lines.push("- （待补充）");
      }
    } else {
      lines.push("- （待补充）");
    }
    lines.push("");
  });

  return {
    summary: typeof summary === "string" ? summary.trim() : "",
    text: lines.join("\n").trim(),
  };
}
