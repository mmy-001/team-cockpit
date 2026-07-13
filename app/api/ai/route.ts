import { NextRequest, NextResponse } from "next/server";

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
  let lastIndex = -1;
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
 * 从 AI 回复中提取 JSON，支持多种包裹格式。
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
    // 3. 直接 { ... } 包裹的 JSON（贪婪匹配最后一个}）
    () => {
      const firstBrace = reply.indexOf("{");
      const lastBrace = reply.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        return reply.slice(firstBrace, lastBrace + 1).trim();
      }
      return null;
    },
    // 4. 尝试用 [ ... ] 包裹（有些人可能返回数组）
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
  const apiKey = process.env.MINIMAX_API_KEY;
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
3. 已完成条目必须包含量化数据（如提升X%、完成N个、转化率等）
4. 问题同步条目必须说明风险点和建议方案
5. 下周计划条目要包含交付物和大致时间节点
6. 如果用户内容中某个板块没有信息，对应的数组也不能为空，请根据上下文推断合理内容，确保四个板块都有条目`;

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
      const parsed = JSON.parse(jsonStr);
      // 验证必要字段
      if (parsed.summary && parsed.sections) {
        // 确保四个 section 都存在
        const validSections: Record<string, string[]> = {
          "已完成": Array.isArray(parsed.sections["已完成"]) ? parsed.sections["已完成"] : [],
          "进行中": Array.isArray(parsed.sections["进行中"]) ? parsed.sections["进行中"] : [],
          "问题同步": Array.isArray(parsed.sections["问题同步"]) ? parsed.sections["问题同步"] : [],
          "下周计划": Array.isArray(parsed.sections["下周计划"]) ? parsed.sections["下周计划"] : [],
        };
        return NextResponse.json({
          summary: typeof parsed.summary === "string" ? parsed.summary : String(parsed.summary || ""),
          sections: validSections,
        });
      }
    }

    // ====== 策略2: AI 返回了非 JSON 格式，尝试按中文标题拆分 ======
    const fallback = parsePlainTextToSections(reply);
    if (Object.values(fallback.sections).some((arr) => arr.length > 0)) {
      return NextResponse.json(fallback);
    }

    // ====== 策略3: 彻底失败，返回错误 ======
    return NextResponse.json(
      {
        error: "AI 返回格式异常，请重试或手动整理",
        debug: reply.slice(0, 300),
      },
      { status: 422 }
    );
  } catch (err: any) {
    console.error("[AI route error]", err);
    return NextResponse.json({ error: `AI 服务异常: ${err.message || "未知错误"}` }, { status: 500 });
  }
}
