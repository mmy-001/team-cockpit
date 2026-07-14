import { NextRequest, NextResponse } from "next/server";

/**
 * 规范化 AI 可能返回的各种 section key，统一映射到中文标准 key。
 * AI 可能返回英文 key、大小写变体、中文简写等。
 */
function normalizeSectionKeys(sections: Record<string, any>): Record<string, string[]> {
  const result: Record<string, string[]> = {
    "已完成": [],
    "进行中": [],
    "问题同步": [],
    "下周计划": [],
  };

  const keyMap: Record<string, string> = {
    // 中文标准
    "已完成": "已完成", "完成": "已完成", "已完成的": "已完成",
    "进行中": "进行中", "进行": "进行中", "进行中的": "进行中", "推进中": "进行中",
    "问题同步": "问题同步", "问题": "问题同步", "风险": "问题同步", "阻塞": "问题同步", "问题与风险": "问题同步",
    "下周计划": "下周计划", "计划": "下周计划", "下周": "下周计划",
    // 英文
    "completed": "已完成", "done": "已完成", "finished": "已完成",
    "in_progress": "进行中", "in-progress": "进行中", "ongoing": "进行中", "progress": "进行中",
    "problems": "问题同步", "issues": "问题同步", "risks": "问题同步", "blockers": "问题同步", "problem": "问题同步",
    "next_week": "下周计划", "next-week": "下周计划", "plan": "下周计划", "next": "下周计划",
  };

  for (const [key, value] of Object.entries(sections)) {
    const normalized = keyMap[key] || keyMap[key.toLowerCase()] || keyMap[key.replace(/[\s_-]/g, "")];
    const target = normalized || "已完成"; // 无法识别的 key 归入"已完成"

    if (Array.isArray(value)) {
      const items = value
        .filter((item: any) => item !== null && item !== undefined)
        .map((item: any) => {
          const str = typeof item === "string" ? item : (item?.content || item?.text || JSON.stringify(item));
          return str.trim();
        })
        .filter((item: string) => item.length > 0);
      result[target] = [...result[target], ...items];
    } else if (typeof value === "string" && value.trim()) {
      result[target].push(value.trim());
    }
  }

  return result;
}

/**
 * 修复 AI 返回的常见 JSON 格式错误（尾部逗号、中文引号等）。
 */
function repairJSON(raw: string): string {
  let fixed = raw;
  // 移除尾部逗号（在 } 或 ] 之前）
  fixed = fixed.replace(/,(\s*[}\]])/g, "$1");
  // 替换中文引号为英文引号
  fixed = fixed.replace(/\u201c/g, '"').replace(/\u201d/g, '"').replace(/\u2018/g, "'").replace(/\u2019/g, "'");
  return fixed;
}

/**
 * 当 AI 没有返回 summary 时，从 sections 中自动生成一个兜底摘要。
 */
function generateFallbackSummary(sections: Record<string, string[]>): string {
  const completed = sections["已完成"] || [];
  const inProgress = sections["进行中"] || [];
  if (completed.length > 0 && inProgress.length > 0) {
    return `本周${completed[0]}，同时推进${inProgress[0]}`;
  }
  if (completed.length > 0) return completed[0];
  if (inProgress.length > 0) return `本周推进：${inProgress[0]}`;
  return "本周工作概览";
}

/**
 * 将纯文本回复按中文数字标题拆解为四段式结构。
 * 当 AI 没有返回 JSON 时，作为最后的保底方案。
 */
function parsePlainTextToSections(text: string): { summary: string; sections: Record<string, string[]> } {
  const sectionTitles = ["一、", "二、", "三、", "四、"];
  const sectionKeys = ["已完成", "进行中", "问题同步", "下周计划"];
  const sections: Record<string, string[]> = {
    "已完成": [],
    "进行中": [],
    "问题同步": [],
    "下周计划": [],
  };

  // 按中文数字标题拆分
  const parts: string[] = [];
  const positions: { idx: number; title: string }[] = [];

  sectionTitles.forEach((title) => {
    const idx = text.indexOf(title);
    if (idx !== -1) {
      positions.push({ idx, title });
    }
  });
  positions.sort((a, b) => a.idx - b.idx);

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].idx;
    const end = i + 1 < positions.length ? positions[i + 1].idx : text.length;
    parts.push(text.slice(start, end));
  }

  // 如果没有中文标题，检查是否有 markdown 标题
  if (parts.length === 0) {
    const mdSectionTitles = ["# 已完成", "## 已完成", "# 进行中", "## 进行中", "# 问题同步", "## 问题同步", "# 下周计划", "## 下周计划"];
    const mdPositions: { idx: number; title: string }[] = [];
    mdSectionTitles.forEach((title) => {
      const idx = text.indexOf(title);
      if (idx !== -1) mdPositions.push({ idx, title });
    });
    mdPositions.sort((a, b) => a.idx - b.idx);
    for (let i = 0; i < mdPositions.length; i++) {
      const start = mdPositions[i].idx;
      const end = i + 1 < mdPositions.length ? mdPositions[i + 1].idx : text.length;
      parts.push(text.slice(start, end));
    }
  }

  // 如果连 markdown 标题都没有，按换行拆分成"已完成"
  if (parts.length === 0) {
    parts.push(text);
  }

  // 每个 part 对应一个 section
  for (let i = 0; i < Math.min(parts.length, 4); i++) {
    const key = sectionKeys[i];
    const content = parts[i];
    // 去掉标题行
    const body = content
      .replace(/^[一二三四五六七八九十]、\s*\S*/g, "")      // 中文标题
      .replace(/^#{1,3}\s*\S*/gm, "")                       // markdown 标题
      .trim();
    // 按行拆分，去掉空白和格式标记
    const items = body
      .split("\n")
      .map((l) => l.replace(/^[-*•]\s*/, "").replace(/^\d+[.、]\s*/, "").trim())
      .filter((l) => l.length > 0);
    if (items.length > 0) {
      sections[key] = items;
    }
  }

  return {
    summary: sections["已完成"]?.[0]?.slice(0, 80) ?? "",
    sections,
  };
}

/**
 * 从 AI 回复中提取 JSON，支持多种包裹格式，包括带 markdown 列表前缀的 JSON。
 */
function extractJSON(reply: string): string | null {
  const strategies = [
    // 1. 标准 markdown 代码块 (```json ... ```)
    () => {
      const m = reply.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      return m ? m[1].trim() : null;
    },
    // 2. 非标准代码块
    () => {
      const m = reply.match(/```([\s\S]*?)```/);
      return m ? m[1].trim() : null;
    },
    // 3. 先清理 markdown 列表前缀（如 AI 把 JSON 每行前加了 "- "），再提取 { ... }
    () => {
      const cleaned = reply
        .split('\n')
        .map((l) => l.replace(/^[-*•]\s+/, '').replace(/^>\s+/, '').replace(/^\d+\.\s+/, '').trim())
        .join('\n');
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const jsonStr = cleaned.slice(firstBrace, lastBrace + 1).trim();
        try {
          JSON.parse(jsonStr);
          return jsonStr;
        } catch {
          return null;
        }
      }
      return null;
    },
    // 4. 原始文本中查找 { ... }
    () => {
      const firstBrace = reply.indexOf("{");
      const lastBrace = reply.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        return reply.slice(firstBrace, lastBrace + 1).trim();
      }
      return null;
    },
    // 5. 尝试用 [ ... ] 包裹
    () => {
      const firstBracket = reply.indexOf("[");
      const lastBracket = reply.lastIndexOf("]");
      if (firstBracket !== -1 && lastBracket > firstBracket) {
        const arr = reply.slice(firstBracket, lastBracket + 1);
        return `{"sections":{"已完成":${arr},"进行中":[],"问题同步":[],"下周计划":[]},"summary":""}`;
      }
      return null;
    },
  ];

  for (const strategy of strategies) {
    const result = strategy();
    if (result) {
      try {
        JSON.parse(result);
        return result;
      } catch {
        // 这个策略的结果不是有效 JSON，试下一个
        continue;
      }
    }
  }
  return null;
}

/**
 * MiniMax AI 结构化周报 —— 将口语/打字输入转为四段式周报内容。
 */
export async function POST(req: NextRequest) {
  // 去除 BOM 字符（\uFEFF = 65279），避免 fetch header 编码失败
  const apiKey = (process.env.MINIMAX_API_KEY || "").replace(/\uFEFF/g, "").trim();
  if (!apiKey) {
    return NextResponse.json({ error: "未配置 MINIMAX_API_KEY" }, { status: 500 });
  }

  let body: { content: string; author?: string; week?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  if (!body.content?.trim()) {
    return NextResponse.json({ error: "请提供内容" }, { status: 400 });
  }

  const systemPrompt = `你是一个专业的周报助手。你的任务是将用户提供的工作笔记/内容整理成标准四段式周报。

你必须严格按照以下 JSON 格式输出，不要添加任何解释、前言或后缀文字。整个回复必须是有效的 JSON：

{
  "summary": "用一句话概括本周核心工作进展和成果，需要有实际信息量",
  "sections": {
    "已完成": ["已完成的工作条目1", "已完成的工作条目2"],
    "进行中": ["正在进行中的工作条目1", "正在进行中的工作条目2"],
    "问题同步": ["遇到的风险/阻塞1", "遇到的风险/阻塞2"],
    "下周计划": ["下周具体任务1", "下周具体任务2"]
  }
}

关键规则：
1. summary 必须是对全部内容的归纳总结，不能照搬原文某一句话，要提炼核心信息
2. 每条条目使用简洁、可执行的语言，15-40字为宜
3. 已完成条目中如果用户提供了量化数据（如提升X%、完成N个、转化率等），请保留并引用；如果用户没有提供，则如实陈述，严禁编造任何数据
4. 问题同步条目只提取用户明确提到的问题/风险/阻塞，不要凭空推断
5. 下周计划条目只提取用户明确提到的计划内容，不要自行添加用户未提及的任务
6. 严格只使用用户输入中实际出现的信息，禁止编造、推断或脑补任何不存在的数字、数据或事实
7. 如果用户输入中没有涉及某个板块（已完成/进行中/问题同步/下周计划），该板块的数组应为空数组 []`;

  try {
    const res = await fetch("https://api.minimax.chat/v1/text/chatcompletion_v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "abab6.5s-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: body.content },
        ],
        temperature: 0.3,
        top_p: 0.9,
        reply_constraints: { sender_type: "BOT", sender_name: "周报助手" },
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData?.base_resp?.status_msg || errData?.error?.message || `AI 请求失败 (${res.status})`;
      return NextResponse.json({ error: errMsg }, { status: 502 });
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content ?? "";

    if (!reply || reply.trim().length === 0) {
      return NextResponse.json({ error: "AI 返回了空内容，请重试" }, { status: 502 });
    }

    // ====== 策略1: 尝试解析 JSON ======
    const jsonStr = extractJSON(reply);
    if (jsonStr) {
      let parsed: any = null;
      // 先尝试直接解析，失败则修复后再解析
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        const repaired = repairJSON(jsonStr);
        try {
          parsed = JSON.parse(repaired);
        } catch {
          // 修复后仍失败，抛给后续策略
        }
      }

      if (parsed) {
        // 情况A: 标准格式 { summary, sections }
        if (parsed.sections && typeof parsed.sections === "object") {
          const validSections = normalizeSectionKeys(parsed.sections);
          const summary = typeof parsed.summary === "string" && parsed.summary.trim()
            ? parsed.summary.trim()
            : generateFallbackSummary(validSections);
          return NextResponse.json({ summary, sections: validSections });
        }

        // 情况B: AI 直接将 section 作为顶层 key（如 { "已完成": [...], "进行中": [...] }）
        const knownKeys = ["已完成", "进行中", "问题同步", "下周计划",
          "完成", "进行", "问题", "计划", "下周",
          "completed", "in_progress", "in-progress", "problems", "next_week"];
        const hasSectionLikeKey = knownKeys.some((k) => k in parsed && Array.isArray(parsed[k]));
        if (hasSectionLikeKey) {
          const validSections = normalizeSectionKeys(parsed);
          const summary = typeof parsed.summary === "string" && parsed.summary.trim()
            ? parsed.summary.trim()
            : generateFallbackSummary(validSections);
          return NextResponse.json({ summary, sections: validSections });
        }

        // 情况C: parsed 是数组，每个元素有 { section, items } 结构
        if (Array.isArray(parsed) && parsed.length > 0) {
          const rawSections: Record<string, string[]> = {};
          for (const item of parsed) {
            if (item && typeof item === "object") {
              const secName = item.section || item.title || item.name || item.type;
              const secItems = item.items || item.content || item.data;
              if (secName && secItems) {
                rawSections[secName] = Array.isArray(secItems) ? secItems : [String(secItems)];
              }
            }
          }
          if (Object.keys(rawSections).length > 0) {
            const validSections = normalizeSectionKeys(rawSections);
            const summary = generateFallbackSummary(validSections);
            return NextResponse.json({ summary, sections: validSections });
          }
        }
      }
    }

    // ====== 策略2: AI 返回了非 JSON 格式，尝试按中文标题拆分 ======
    const fallback = parsePlainTextToSections(reply);
    if (Object.values(fallback.sections).some((arr) => arr.length > 0)) {
      return NextResponse.json(fallback);
    }

    // ====== 策略3: 彻底失败，返回错误 ======
    console.error("[AI format error] unexpected reply:", reply.slice(0, 200));
    return NextResponse.json(
      { error: "AI 返回格式异常，请重试或手动整理" },
      { status: 422 }
    );
  } catch (err: any) {
    console.error("[AI route error]", err);
    return NextResponse.json({ error: `AI 服务异常: ${err.message || "未知错误"}` }, { status: 500 });
  }
}
