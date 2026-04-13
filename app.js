const form = document.getElementById("lessonForm");
const resultCard = document.getElementById("resultCard");
const resultEmpty = document.getElementById("resultEmpty");
const historyList = document.getElementById("historyList");
const historyItemTemplate = document.getElementById("historyItemTemplate");
const generateBtn = document.getElementById("generateBtn");
const regenerateBtn = document.getElementById("regenerateBtn");
const saveBtn = document.getElementById("saveBtn");
const copyBtn = document.getElementById("copyBtn");
const exportBtn = document.getElementById("exportBtn");
const lessonTemplate = document.getElementById("lessonTemplate");
const templateRefreshBtn = document.getElementById("templateRefreshBtn");
const templateHint = document.getElementById("templateHint");
const storageKey = "kindergarten-lessons";
const kindergartenPromptKeywords = ["3-6岁", "生活化", "游戏化", "合作探究", "观察表达", "动手操作", "情绪情感", "社会交往", "审美体验"];
const dailyInspirations = [
  {
    title: "春天小花园观察课",
    bullets: ["从真实生活经验出发", "兼顾表达、操作与合作", "语言温柔，步骤可直接上课"]
  },
  {
    title: "会变的影子朋友",
    bullets: ["从光影现象进入探索", "鼓励幼儿观察和表达", "适合游戏化操作"]
  },
  {
    title: "小脚丫去探路",
    bullets: ["结合身体感知与路线探索", "支持合作闯关", "自然融入规则意识"]
  },
  {
    title: "找一找春天的颜色",
    bullets: ["关注颜色变化和审美体验", "适合户外观察", "鼓励小组交流"]
  },
  {
    title: "会响的瓶瓶罐罐",
    bullets: ["从生活材料中发现声音", "适合动手操作", "支持比较与分类"]
  },
  {
    title: "我的情绪小表情",
    bullets: ["帮助幼儿认识情绪", "适合角色表达", "可以配合游戏互动"]
  }
];


const allowedAgeGroups = ["小班（3-4岁）", "中班（4-5岁）", "大班（5-6岁）", "混龄班"];
const allowedActivityTypes = ["语言活动", "艺术活动", "科学探索", "健康活动", "社会活动", "音乐律动", "户外游戏", "区域活动"];
const allowedGoals = ["认知发展", "语言表达", "动手操作", "情绪情感", "社会交往", "审美创造"];
let lastPayload = null;
let currentResult = null;
let currentPresetSuggestion = null;

const templates = {
  "春天观察课": {
    title: "春天观察课",
    ageGroup: "中班（4-5岁）",
    activityType: "科学探索",
    goals: ["认知发展", "语言表达", "社会交往"],
    customGoal: "引导幼儿观察春天植物和天气的变化。",
    creativeRequirement: "希望融入观察记录、合作讨论和自然材料。"
  },
  "生活习惯养成": {
    ageGroup: "小班（3-4岁）",
    activityType: "社会活动",
    goals: ["情绪情感", "社会交往", "动手操作"],
    customGoal: "培养幼儿整理物品和保持卫生的习惯。",
    creativeRequirement: "希望加入情景表演和儿歌提醒。"
  },
  "绘本延伸活动": {
    ageGroup: "大班（5-6岁）",
    activityType: "语言活动",
    goals: ["语言表达", "审美创造", "认知发展"],
    customGoal: "围绕绘本内容展开理解、表达和创编。",
    creativeRequirement: "希望包含角色扮演、故事续编和小组分享。"
  },
  "户外探索游戏": {
    ageGroup: "混龄班",
    activityType: "户外游戏",
    goals: ["动手操作", "社会交往", "情绪情感"],
    customGoal: "组织幼儿在户外进行观察、合作和身体锻炼。",
    creativeRequirement: "希望突出合作闯关和自然探索。"
  }
};

function init() {
  renderDailyInspiration();
  renderHistory();
  bindEvents();
}

function renderDailyInspiration() {
  const inspiration = pickDailyInspiration();
  const titleEl = document.querySelector(".hero-card-body h2");
  const listEl = document.querySelector(".hero-card-body ul");

  if (!titleEl || !listEl || !inspiration) {
    return;
  }

  titleEl.textContent = inspiration.title;
  listEl.innerHTML = inspiration.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function pickDailyInspiration() {
  const now = new Date();
  const todayKey = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
  const hash = Array.from(todayKey).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return dailyInspirations[hash % dailyInspirations.length];
}

function handleGenerate(event) {
  event.preventDefault();
  const payload = buildGenerationPayload();
  lastPayload = payload;
  generateLesson(payload);
}

function bindEvents() {
  form.addEventListener("submit", handleGenerate);
  regenerateBtn.addEventListener("click", () => {
    if (!currentResult) {
      window.alert("请先生成一次教案。");
      return;
    }
    const payload = collectFormData();
    lastPayload = payload;
    generateLesson(payload);
  });

  saveBtn.addEventListener("click", () => {
    if (!currentResult) {
      window.alert("请先生成教案后再保存。");
      return;
    }
    saveCurrentResult();
  });

  copyBtn.addEventListener("click", async () => {
    if (!currentResult) {
      window.alert("暂无可复制内容。");
      return;
    }
    await navigator.clipboard.writeText(formatLessonAsText(currentResult));
    window.alert("教案已复制到剪贴板。");
  });

  lessonTemplate.addEventListener("change", applyTemplate);
  templateRefreshBtn.addEventListener("click", handleTemplateRefresh);
  exportBtn.addEventListener("click", () => {
    if (!currentResult) {
      window.alert("暂无可导出内容。");
      return;
    }
    exportText(currentResult);
  });
}

function buildGenerationPayload() {
  const payload = collectFormData();
  const promptKeywords = currentPresetSuggestion?.promptKeywords?.length
    ? [...kindergartenPromptKeywords, ...currentPresetSuggestion.promptKeywords]
    : kindergartenPromptKeywords;
  return {
    ...payload,
    promptKeywords
  };
}

function applyTemplate() {
  const template = templates[lessonTemplate.value];
  currentPresetSuggestion = null;
  updateTemplateHint();
  if (!template) return;
  hydrateForm({
    title: template.title,
    ageGroup: template.ageGroup,
    activityType: template.activityType,
    goals: template.goals,
    customGoal: template.customGoal,
    creativeRequirement: template.creativeRequirement
  });
}

async function handleTemplateRefresh() {
  const payload = collectFormData();
  setTemplateRefreshState(true);
  updateTemplateHint("正在刷新一套更适合 3-6 岁幼儿园场景的项目建议…");

  try {
    const response = await fetch("/api/preset-suggest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...payload,
        templateName: lessonTemplate.value ? (lessonTemplate.selectedOptions[0]?.textContent?.trim() || "") : "",
        promptKeywords: kindergartenPromptKeywords
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "刷新失败");
    }

    const suggestion = normalizePresetSuggestion(data.result, payload);
    currentPresetSuggestion = suggestion;
    hydrateForm(suggestion);
    updateTemplateHint(`已刷新一套幼儿园项目：${suggestion.title}。可继续微调后生成教案。关键词：${joinText(suggestion.promptKeywords.slice(0, 4))}。`);
  } catch (error) {
    updateTemplateHint("刷新失败，当前仍可继续手动选择模板并生成教案。");
    window.alert(error instanceof Error ? error.message : "刷新失败，请稍后再试。");
  } finally {
    setTemplateRefreshState(false);
  }
}

async function generateLesson(payload) {
  if (!payload.ageGroup || !payload.activityType) {
    window.alert("请先选择年龄段和活动类型。");
    return;
  }

  setGeneratingState(true);

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "生成失败");
    }

    currentResult = normalizeResult(data.result);
    renderResult(currentResult);
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "生成失败，请稍后再试。");
  } finally {
    setGeneratingState(false);
  }
}

function normalizeResult(result) {
  return {
    title: result?.title || "未命名活动",
    ageGroup: result?.ageGroup || "未填写",
    duration: result?.duration || "约 20-30 分钟",
    goals: ensureArray(result?.goals),
    preparation: {
      materials: ensureArray(result?.preparation?.materials),
      experience: ensureArray(result?.preparation?.experience)
    },
    process: Array.isArray(result?.process) ? result.process : [],
    notes: ensureArray(result?.notes),
    extensions: ensureArray(result?.extensions)
  };
}

function normalizePresetSuggestion(result, fallback = {}) {
  const title = normalizePresetTitle(result?.title, fallback);
  const ageGroup = pickAllowedValue(result?.ageGroup, allowedAgeGroups, fallback.ageGroup || "中班（4-5岁）");
  const activityType = pickAllowedValue(result?.activityType, allowedActivityTypes, fallback.activityType || "科学探索");
  const goals = normalizeGoals(result?.goals, fallback.goals);
  const promptKeywords = normalizePromptKeywords(result?.promptKeywords);

  return {
    title,
    ageGroup,
    activityType,
    goals,
    customGoal: normalizeText(result?.customGoal, fallback.customGoal || "围绕幼儿生活经验展开观察、表达和合作。"),
    creativeRequirement: normalizeText(result?.creativeRequirement, fallback.creativeRequirement || "希望融入游戏化、动手操作和温和互动。"),
    promptKeywords
  };
}

function normalizePresetTitle(value, fallback = {}) {
  const normalized = String(value || "").trim();
  if (normalized && !["刷新项目", "未命名活动", "未命名项目", "活动建议"].includes(normalized)) {
    return normalized;
  }

  return buildPresetFallbackTitle(fallback);
}

function buildPresetFallbackTitle(fallback = {}) {
  const activityType = String(fallback.activityType || "").trim();
  const keywords = normalizePromptKeywords(fallback.promptKeywords);
  const keyword = keywords[0] ? String(keywords[0]).trim() : "";

  if (activityType && keyword) {
    return `${activityType}·${keyword}`;
  }

  if (activityType) {
    return `${activityType}项目建议`;
  }

  if (keyword) {
    return `${keyword}项目建议`;
  }

  return "刷新项目";
}

function normalizeGoals(goals, fallbackGoals = []) {
  const merged = [
    ...ensureArray(goals),
    ...ensureArray(fallbackGoals)
  ]
    .map((goal) => goal.trim())
    .filter((goal) => allowedGoals.includes(goal));

  const uniqueGoals = [...new Set(merged)];
  if (uniqueGoals.length >= 2) {
    return uniqueGoals.slice(0, 3);
  }

  const fallback = ["认知发展", "语言表达", "动手操作"];
  for (const goal of fallback) {
    if (!uniqueGoals.includes(goal)) {
      uniqueGoals.push(goal);
    }
    if (uniqueGoals.length >= 2) break;
  }

  return uniqueGoals.slice(0, 3);
}

function normalizePromptKeywords(keywords) {
  const values = ensureArray(keywords)
    .map((item) => item.trim())
    .filter(Boolean);
  const merged = [...new Set([...kindergartenPromptKeywords, ...values])];
  return merged.slice(0, 12);
}

function pickAllowedValue(value, allowedValues, fallback) {
  const normalized = String(value || "").trim();
  return allowedValues.includes(normalized) ? normalized : fallback;
}

function normalizeText(value, fallback) {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function ensureArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function renderResult(result) {
  resultEmpty.classList.add("hidden");
  resultCard.classList.remove("hidden");
  resultCard.innerHTML = `
    <section class="result-header">
      <span class="panel-kicker">活动教案</span>
      <h4>${escapeHtml(result.title)}</h4>
      <div class="result-meta">
        <span>${escapeHtml(result.ageGroup)}</span>
        <span>${escapeHtml(result.duration)}</span>
      </div>
    </section>

    ${renderTagSection("活动目标", result.goals)}
    ${renderPreparationSection(result.preparation)}
    ${renderProcessSection(result.process)}
    ${renderListSection("注意事项", result.notes)}
    ${renderListSection("活动延伸", result.extensions)}
  `;
}

function renderTagSection(title, items) {
  const list = items.length ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>暂无内容</li>";
  return `
    <section class="result-section">
      <h5>${title}</h5>
      <ul class="goal-list">${list}</ul>
    </section>
  `;
}

function renderPreparationSection(preparation) {
  return `
    <section class="result-section">
      <h5>活动准备</h5>
      <ul>
        <li><strong>材料准备：</strong>${escapeHtml(joinText(preparation.materials))}</li>
        <li><strong>经验准备：</strong>${escapeHtml(joinText(preparation.experience))}</li>
      </ul>
    </section>
  `;
}

function renderProcessSection(process) {
  const content = process.length
    ? process
        .map(
          (item) => `
            <div class="process-item">
              <strong>${escapeHtml(item.step || "活动环节")}</strong>
              <div>${escapeHtml(item.content || "")}</div>
            </div>
          `
        )
        .join("")
    : `<div class="process-item"><strong>活动过程</strong><div>暂无内容</div></div>`;

  return `
    <section class="result-section">
      <h5>活动过程</h5>
      <div class="process-list">${content}</div>
    </section>
  `;
}

function renderListSection(title, items) {
  const list = items.length ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>暂无内容</li>";
  return `
    <section class="result-section">
      <h5>${title}</h5>
      <ul>${list}</ul>
    </section>
  `;
}

function saveCurrentResult() {
  const history = getHistory();
  const record = {
    id: crypto.randomUUID(),
    savedAt: new Date().toLocaleString("zh-CN"),
    form: lastPayload,
    result: currentResult
  };

  history.unshift(record);
  localStorage.setItem(storageKey, JSON.stringify(history.slice(0, 12)));
  renderHistory();
  window.alert("已保存到本地历史记录。");
}

function renderHistory() {
  const history = getHistory();
  historyList.innerHTML = "";

  if (!history.length) {
    historyList.innerHTML = '<div class="history-meta">还没有保存的教案，先生成一份试试吧。</div>';
    return;
  }

  history.forEach((item) => {
    const fragment = historyItemTemplate.content.cloneNode(true);
    const openButton = fragment.querySelector(".history-open");
    const deleteButton = fragment.querySelector(".history-delete");
    fragment.querySelector(".history-title").textContent = item.result?.title || "未命名活动";
    fragment.querySelector(".history-meta").textContent = `${item.form?.ageGroup || "-"} · ${item.form?.activityType || "-"} · ${item.savedAt}`;
    fragment.querySelector(".history-preview").textContent = item.form?.creativeRequirement || item.result?.duration || "点击可重新打开";

    openButton.addEventListener("click", () => {
      currentResult = item.result;
      lastPayload = item.form;
      hydrateForm(item.form);
      renderResult(item.result);
      updateTemplateHint("已打开历史教案，可继续编辑或重新生成。");
    });

    deleteButton.addEventListener("click", () => {
      deleteHistoryItem(item.id);
    });

    historyList.appendChild(fragment);
  });
}

function collectFormData() {
  const goals = Array.from(document.querySelectorAll('input[name="goal"]:checked')).map((input) => input.value);
  return {
    ageGroup: document.getElementById("ageGroup").value,
    activityType: document.getElementById("activityType").value,
    goals,
    customGoal: document.getElementById("customGoal").value.trim(),
    creativeRequirement: document.getElementById("creativeRequirement").value.trim()
  };
}

function hydrateForm(formData = {}) {
  document.getElementById("ageGroup").value = formData.ageGroup || "";
  document.getElementById("activityType").value = formData.activityType || "";
  document.getElementById("customGoal").value = formData.customGoal || "";
  document.getElementById("creativeRequirement").value = formData.creativeRequirement || "";
  syncLessonTemplateOption(formData.title || "");

  const selectedGoals = new Set(formData.goals || []);
  document.querySelectorAll('input[name="goal"]').forEach((input) => {
    input.checked = selectedGoals.has(input.value);
  });
}

function syncLessonTemplateOption(title) {
  const nextTitle = String(title || "").trim();
  const hasOption = [...lessonTemplate.options].some((option) => option.value === nextTitle);

  if (hasOption || !nextTitle) {
    lessonTemplate.value = nextTitle;
    return nextTitle;
  }

  const customValue = "__refreshed__";
  let refreshedOption = lessonTemplate.querySelector(`option[value="${customValue}"]`);
  if (!refreshedOption) {
    refreshedOption = document.createElement("option");
    refreshedOption.value = customValue;
    lessonTemplate.appendChild(refreshedOption);
  }

  refreshedOption.textContent = nextTitle;
  lessonTemplate.value = customValue;
  return customValue;
}

function deleteHistoryItem(id) {
  const nextHistory = getHistory().filter((item) => item.id !== id);
  localStorage.setItem(storageKey, JSON.stringify(nextHistory));
  renderHistory();
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "[]");
  } catch {
    return [];
  }
}

function setGeneratingState(isGenerating) {
  generateBtn.disabled = isGenerating;
  regenerateBtn.disabled = isGenerating;
  exportBtn.disabled = isGenerating;
  generateBtn.textContent = isGenerating ? "正在生成中…" : "一键生成教案";
}

function setTemplateRefreshState(isRefreshing) {
  templateRefreshBtn.disabled = isRefreshing;
  templateRefreshBtn.setAttribute("aria-busy", String(isRefreshing));
  templateRefreshBtn.textContent = isRefreshing ? "…" : "↻";
}

function updateTemplateHint(message) {
  templateHint.textContent = message || "点击刷新可换一套更适合 3-6 岁幼儿园场景的项目配置。";
}

function formatLessonAsText(result) {
  return [
    `活动名称：${result.title}`,
    `适用年龄段：${result.ageGroup}`,
    `活动时长：${result.duration}`,
    "",
    "活动目标：",
    ...result.goals.map((item, index) => `${index + 1}. ${item}`),
    "",
    "活动准备：",
    `材料准备：${joinText(result.preparation.materials)}`,
    `经验准备：${joinText(result.preparation.experience)}`,
    "",
    "活动过程：",
    ...result.process.map((item, index) => `${index + 1}. ${item.step}：${item.content}`),
    "",
    "注意事项：",
    ...result.notes.map((item, index) => `${index + 1}. ${item}`),
    "",
    "活动延伸：",
    ...result.extensions.map((item, index) => `${index + 1}. ${item}`)
  ].join("\n");
}

function joinText(items) {
  return items.length ? items.join("；") : "暂无内容";
}

function exportText(result) {
  const blob = new Blob([formatLessonAsText(result)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${result.title || "幼儿园教案"}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

updateTemplateHint();
init();
