import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 5089);
const apiKey = process.env.OPENAI_API_KEY || "";
const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.nofx.online/").replace(/\/+$/, "");
const model = "gpt-5.4-mini";
const allowedAgeGroups = ["小班（3-4岁）", "中班（4-5岁）", "大班（5-6岁）", "混龄班"];
const allowedActivityTypes = ["语言活动", "艺术活动", "科学探索", "健康活动", "社会活动", "音乐律动", "户外游戏", "区域活动"];
const allowedGoals = ["认知发展", "语言表达", "动手操作", "情绪情感", "社会交往", "审美创造"];
const promptKeywordPool = ["3-6岁", "生活化", "游戏化", "合作探究", "观察表达", "动手操作", "情绪情感", "社会交往", "审美体验"];

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

app.get("/api/config", (_req, res) => {
  res.json({
    port,
    model,
    baseUrl,
    hasApiKey: Boolean(apiKey)
  });
});

app.post("/api/generate", async (req, res) => {
  if (!apiKey) {
    return res.status(400).json({ error: "未检测到 OPENAI_API_KEY，请先配置 .env 文件。" });
  }

  const { ageGroup, activityType, goals, customGoal, creativeRequirement, promptKeywords } = req.body || {};

  if (!ageGroup || !activityType) {
    return res.status(400).json({ error: "请先填写幼儿年龄段与活动类型。" });
  }

  const normalizedGoals = Array.isArray(goals) ? goals.filter((goal) => allowedGoals.includes(goal)) : [];
  const mergedGoals = customGoal ? [...normalizedGoals, customGoal] : normalizedGoals;
  const mergedPromptKeywords = normalizePromptKeywords(promptKeywords);

  const systemPrompt = [
    "你是一名专业的中国幼儿园一线教研老师。",
    "你擅长为3-6岁幼儿生成真实可落地的一日活动教案。",
    "内容必须符合幼儿园教育场景，语言温暖、专业、具体。",
    "必须杜绝小学化、学科化、机械训练导向。",
    "请优先围绕这些关键词组织内容：",
    mergedPromptKeywords.join("、"),
    "输出必须是合法 JSON，不要输出 markdown 代码块。"
  ].join("\n");

  const userPrompt = {
    task: "请生成一份幼儿园活动教案",
    requirements: {
      ageGroup,
      activityType,
      goals: mergedGoals,
      creativeRequirement: creativeRequirement || "无",
      promptKeywords: mergedPromptKeywords
    },
    outputSchema: {
      title: "活动名称",
      ageGroup: "适用年龄段",
      duration: "活动时长",
      goals: ["活动目标1", "活动目标2"],
      preparation: {
        materials: ["材料1"],
        experience: ["经验准备1"]
      },
      process: [
        { step: "导入", content: "..." },
        { step: "展开", content: "..." },
        { step: "结束", content: "..." }
      ],
      notes: ["注意事项1"],
      extensions: ["活动延伸1"]
    }
  };

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(userPrompt, null, 2) }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || data?.message || "AI 接口请求失败。",
        details: data
      });
    }

    const rawContent = data?.choices?.[0]?.message?.content;
    if (!rawContent) {
      return res.status(502).json({ error: "AI 未返回可用内容。", details: data });
    }

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return res.status(502).json({ error: "AI 返回内容不是合法 JSON。", rawContent });
    }

    return res.json({ result: parsed, usage: data?.usage || null });
  } catch (error) {
    return res.status(500).json({
      error: "服务端请求失败，请检查接口地址、模型名或网络。",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post("/api/preset-suggest", async (req, res) => {
  if (!apiKey) {
    return res.status(400).json({ error: "未检测到 OPENAI_API_KEY，请先配置 .env 文件。" });
  }

  const { ageGroup, activityType, goals, customGoal, creativeRequirement, promptKeywords, templateName } = req.body || {};
  const fallbackAgeGroup = normalizeChoice(ageGroup, allowedAgeGroups, "中班（4-5岁）");
  const fallbackActivityType = normalizeChoice(activityType, allowedActivityTypes, "科学探索");
  const fallbackGoals = normalizeGoals(goals);
  const mergedPromptKeywords = normalizePromptKeywords(promptKeywords);
  const fallbackTitle = buildPresetFallbackTitle({ activityType: fallbackActivityType, promptKeywords: mergedPromptKeywords, templateName });

  const systemPrompt = [
    "你是一名专业的中国幼儿园课程设计老师。",
    "请生成一套可直接用于表单填写的幼儿园活动项目建议。",
    "内容必须严格适合3-6岁幼儿，避免小学化、学科化、机械训练语言。",
    "活动名称必须是具体、单一、可直接上课的项目名，要像“会变的影子朋友”“找一找春天的颜色”“小脚丫去探路”这样有画面感。",
    "禁止输出“3-6岁项目建议”“刷新项目”“活动建议”“科学探索·生活化”这类泛标题、年龄段套话或拼接标题。",
    "标题不要包含年龄段、模板名、关键词列表或泛化说明，只输出项目本身的名字。",
    "输出必须是合法 JSON，且只能从允许选项中选择年龄段、活动类型和目标。",
    `允许的年龄段：${allowedAgeGroups.join("、")}`,
    `允许的活动类型：${allowedActivityTypes.join("、")}`,
    `允许的目标标签：${allowedGoals.join("、")}`,
    `优先关键词：${mergedPromptKeywords.join("、")}`,
    "不要输出任何解释性文字。"
  ].join("\n");

  const userPrompt = {
    task: "请生成一组新的幼儿园活动项目建议",
    context: {
      templateName: templateName || "未选择",
      currentValues: {
        ageGroup: fallbackAgeGroup,
        activityType: fallbackActivityType,
        goals: fallbackGoals,
        customGoal: customGoal || "",
        creativeRequirement: creativeRequirement || ""
      },
      promptKeywords: mergedPromptKeywords
    },
    outputSchema: {
      title: "会变的影子朋友",
      ageGroup: "小班（3-4岁）",
      activityType: "科学探索",
      goals: ["认知发展", "语言表达"],
      customGoal: "围绕生活经验展开温和具体的活动目标。",
      creativeRequirement: "希望融入游戏化、动手操作和合作表达。",
      promptKeywords: ["生活化", "游戏化"],
      note: "标题必须是具体项目名，不要写泛标题。"
    }
  };

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(userPrompt, null, 2) }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || data?.message || "AI 接口请求失败。",
        details: data
      });
    }

    const rawContent = data?.choices?.[0]?.message?.content;
    if (!rawContent) {
      return res.status(502).json({ error: "AI 未返回可用内容。", details: data });
    }

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return res.status(502).json({ error: "AI 返回内容不是合法 JSON。", rawContent });
    }

    return res.json({ result: normalizePresetResult(parsed, {
      templateName: templateName || "",
      activityType: fallbackActivityType,
      fallbackTitle,
      customGoal: customGoal || "",
      creativeRequirement: creativeRequirement || "",
      promptKeywords: mergedPromptKeywords
    }), usage: data?.usage || null });
  } catch (error) {
    return res.status(500).json({
      error: "服务端请求失败，请检查接口地址、模型名或网络。",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Kindergarten lesson generator is running at http://localhost:${port}`);
});

function normalizePresetResult(result, context = {}) {
  return {
    title: normalizePresetTitle(result?.title, context),
    ageGroup: normalizeChoice(result?.ageGroup, allowedAgeGroups, "中班（4-5岁）"),
    activityType: normalizeChoice(result?.activityType, allowedActivityTypes, "科学探索"),
    goals: normalizeGoals(result?.goals),
    customGoal: normalizeText(result?.customGoal, "围绕幼儿生活经验展开观察、表达和合作。"),
    creativeRequirement: normalizeText(result?.creativeRequirement, "希望融入游戏化、动手操作和温和互动。"),
    promptKeywords: normalizePromptKeywords(result?.promptKeywords)
  };
}

function normalizePresetTitle(value, context = {}) {
  const normalized = String(value || "").trim();
  if (normalized && isConcretePresetTitle(normalized)) {
    return normalized;
  }

  if (context.fallbackTitle && isConcretePresetTitle(context.fallbackTitle)) {
    return String(context.fallbackTitle).trim();
  }

  return buildPresetFallbackTitle(context);
}

function isConcretePresetTitle(title) {
  const normalized = String(title || "").trim();
  if (!normalized) {
    return false;
  }

  const genericPatterns = [
    /^\d+[-~～至]?\d*岁.*$/,
    /项目建议$/,
    /活动建议$/,
    /刷新项目$/,
    /未命名/,
    /3-6岁/,
    /小学化/,
    /科学探索[·:：]?生活化$/,
    /[·:：]\s*生活化$/,
    /[·:：]\s*游戏化$/
  ];

  return !genericPatterns.some((pattern) => pattern.test(normalized));
}

function buildPresetFallbackTitle(context = {}) {
  const templateName = String(context.templateName || "").trim();
  const activityType = String(context.activityType || "").trim();
  const keywords = normalizePromptKeywords(context.promptKeywords);
  const keyword = keywords.find((item) => {
    const normalized = String(item).trim();
    return normalized && normalized !== "3-6岁";
  }) || "";

  if (templateName && isConcretePresetTitle(templateName)) {
    return templateName;
  }

  if (activityType && keyword) {
    return `${activityType}·${keyword}`;
  }

  if (activityType) {
    return `${activityType}小探索`;
  }

  if (keyword) {
    return `${keyword}小探索`;
  }

  return "会变的影子朋友";
}

function normalizeGoals(goals) {
  const values = Array.isArray(goals) ? goals : [];
  const filtered = [...new Set(values.map((goal) => String(goal || "").trim()).filter((goal) => allowedGoals.includes(goal)))];
  if (filtered.length >= 2) {
    return filtered.slice(0, 3);
  }

  for (const goal of ["认知发展", "语言表达", "动手操作"]) {
    if (!filtered.includes(goal)) {
      filtered.push(goal);
    }
    if (filtered.length >= 2) {
      break;
    }
  }

  return filtered.slice(0, 3);
}

function normalizePromptKeywords(keywords) {
  const values = Array.isArray(keywords) ? keywords : [];
  const merged = [...new Set([...promptKeywordPool, ...values.map((item) => String(item || "").trim()).filter(Boolean)])];
  return merged.slice(0, 12);
}

function normalizeChoice(value, allowed, fallback) {
  const normalized = String(value || "").trim();
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeText(value, fallback) {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}
