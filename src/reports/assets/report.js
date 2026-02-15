/* Report script: expects global DATA to be set before this runs */

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function stripTrailingSeverityAndScore(text) {
  if (!text || !String(text).trim()) return "";
  var lines = text.trim().split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean);
  while (lines.length > 0) {
    var last = lines[lines.length - 1];
    if (/^\s*\d{1,3}\s*$/.test(last)) { lines.pop(); continue; }
    if (/^\s*(critical|high|medium|low|none)\s*$/i.test(last)) { lines.pop(); continue; }
    break;
  }
  return lines.join("\n").trim();
}

function renderLlmOutput(text) {
  if (!text || !String(text).trim()) return "";
  text = stripTrailingSeverityAndScore(text);
  if (!text) return "";
  var parts = [];
  var re = /```(\w*)\n?([\s\S]*?)```/g;
  var lastIndex = 0;
  var m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      var prose = text.slice(lastIndex, m.index).trim();
      if (prose) parts.push({ type: "prose", content: prose });
    }
    var lang = (m[1] || "").trim();
    var code = (m[2] || "").trim();
    parts.push({ type: "code", lang: lang, content: code });
    lastIndex = re.lastIndex;
  }
  var tail = text.slice(lastIndex).trim();
  if (tail) {
    var openIdx = tail.indexOf("```");
    if (openIdx !== -1) {
      var prosePart = tail.slice(0, openIdx).trim();
      if (prosePart) parts.push({ type: "prose", content: prosePart });
      var afterOpen = tail.slice(openIdx + 3).trim();
      var newline = afterOpen.indexOf("\n");
      var lang = newline === -1 ? "" : afterOpen.slice(0, newline).trim();
      if (!/^\w+$/.test(lang)) { lang = ""; newline = -1; }
      var codeContent = newline === -1 ? afterOpen : afterOpen.slice(newline + 1).trim();
      parts.push({ type: "code", lang: lang, content: codeContent });
    } else {
      parts.push({ type: "prose", content: tail });
    }
  }
  return parts
    .map(function (p) {
      if (p.type === "prose")
        return '<div class="llm-prose">' + escapeHtml(p.content).replace(/\n/g, "<br>") + "</div>";
      var langLabel = p.lang ? p.lang.charAt(0).toUpperCase() + p.lang.slice(1) : "Code";
      return (
        '<div class="code-block"><span class="lang-label">' +
        escapeHtml(langLabel) +
        "</span><pre><code>" +
        escapeHtml(p.content) +
        "</code></pre></div>"
      );
    })
    .join("");
}

function langFromFile(file) {
  var ext = (file || "").split(".").pop() || "";
  var map = {
    ts: "TypeScript",
    tsx: "TSX",
    js: "JavaScript",
    jsx: "JSX",
    py: "Python",
    mjs: "JavaScript",
    cjs: "JavaScript",
    vue: "Vue",
    css: "CSS",
    html: "HTML",
    json: "JSON",
    md: "Markdown",
  };
  return map[ext] || ext || "Code";
}

function codeBlockHtml(code, fileOrLang) {
  var lang;
  if (
    typeof fileOrLang === "string" &&
    fileOrLang &&
    !fileOrLang.includes(".") &&
    !fileOrLang.includes("/")
  )
    lang = fileOrLang.charAt(0).toUpperCase() + fileOrLang.slice(1);
  else lang = langFromFile(fileOrLang);
  return (
    '<div class="code-block"><span class="lang-label">' +
    escapeHtml(lang) +
    "</span><pre><code>" +
    escapeHtml(code) +
    "</code></pre></div>"
  );
}

function worstSeverity(items) {
  if (!items.length) return "none";
  return items.reduce(function (a, b) {
    if (a === "critical" || b.severity === "critical") return "critical";
    if (b.severity === "high") return "high";
    return b.severity;
  }, "low");
}

// Treemap: size by complexity + hotspot + line count; boost by LLM debt score so it's reflected
var fileScores = DATA.fileMetrics.map(function (m) {
  var base =
    (m.cyclomaticComplexity || 0) * 2 +
    (m.hotspotScore || 0) * 50 +
    (m.lineCount || 0) / 10;
  var llmBoost = (m.llmFileScore != null ? m.llmFileScore : 0) * 3;
  return { file: m.file, score: Math.max(base + llmBoost, llmBoost || base) };
}).filter(function (x) { return x.score > 0; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 60);

var maxScore = Math.max.apply(null, fileScores.map(function (x) { return x.score; }).concat(1));
var debtByFile = new Map();
DATA.debtItems.forEach(function (d) {
  var arr = debtByFile.get(d.file) || [];
  arr.push(d);
  debtByFile.set(d.file, arr);
});

var treemapEl = document.getElementById("treemap");
fileScores.forEach(function (_ref) {
  var file = _ref.file;
  var score = _ref.score;
  var items = debtByFile.get(file) || [];
  var fileM = DATA.fileMetrics.find(function (m) { return m.file === file; });
  var llmScore =
    fileM && fileM.llmFileScore != null ? " (LLM debt: " + fileM.llmFileScore + "/100)" : "";
  var severity = (fileM && fileM.llmSeverity) ? fileM.llmSeverity : worstSeverity(items);
  var cell = document.createElement("div");
  cell.className = "treemap-cell";
  cell.dataset.severity = severity;
  cell.style.flex = String((score / maxScore) * 100) + " 1 80px";
  cell.style.minWidth = "72px";
  cell.title = file + llmScore;
  cell.textContent = file.split("/").pop() || file;
  cell.addEventListener("click", function () { showDetail(file, items); });
  treemapEl.appendChild(cell);
});

// Priority quadrants
var highImpact = DATA.debtItems
  .filter(function (d) { return d.severity === "high" || d.severity === "critical"; })
  .slice(0, 5);
document.getElementById("q1").innerHTML = highImpact
  .slice(0, 3)
  .map(function (d) { return '<li style="font-size:0.8rem">' + escapeHtml(d.file) + "</li>"; })
  .join("");
document.getElementById("q2").innerHTML = highImpact
  .slice(3, 6)
  .map(function (d) { return '<li style="font-size:0.8rem">' + escapeHtml(d.file) + "</li>"; })
  .join("");

// Debt list: one row per file; static = worst severity across that file's issues, LLM = file's rating
var sev = { critical: 4, high: 3, medium: 2, low: 1 };
var list = document.getElementById("debtList");
var filesWithDebt = Array.from(debtByFile.keys()).sort(function (fa, fb) {
  var itemsA = debtByFile.get(fa);
  var itemsB = debtByFile.get(fb);
  var worstA = itemsA.length ? Math.max.apply(null, itemsA.map(function (d) { return sev[d.severity] || 0; })) : 0;
  var worstB = itemsB.length ? Math.max.apply(null, itemsB.map(function (d) { return sev[d.severity] || 0; })) : 0;
  if (worstB !== worstA) return worstB - worstA;
  return fa.localeCompare(fb);
});
filesWithDebt.forEach(function (file) {
  var items = debtByFile.get(file);
  var worstSeverityVal = items.length ? items.reduce(function (best, d) {
    return (sev[d.severity] || 0) > (sev[best.severity] || 0) ? d : best;
  }, items[0]) : null;
  var staticSeverity = worstSeverityVal ? worstSeverityVal.severity : "low";
  var fileM = DATA.fileMetrics.find(function (m) { return m.file === file; });
  var fileLlmSeverity = fileM && fileM.llmSeverity ? fileM.llmSeverity : null;
  var staticBadge = '<span class="badge badge-' + staticSeverity + '" title="Static analysis (worst of ' + items.length + ' issue(s))">' + staticSeverity + "</span>";
  var llmRating = fileLlmSeverity
    ? '<span class="badge badge-' + fileLlmSeverity + '" title="LLM rating for this file">' + fileLlmSeverity + "</span>"
    : '<span class="debt-list-llm-none">—</span>';
  var titleText = items.length === 1
    ? items[0].title
    : worstSeverityVal.title + " (+" + (items.length - 1) + " more)";
  var ratingsRow =
    '<div class="debt-list-ratings">' +
    '<span class="debt-list-rating"><span class="debt-list-rating-label">Static</span> ' + staticBadge + "</span>" +
    '<span class="debt-list-rating"><span class="debt-list-rating-label">LLM</span> ' + llmRating + "</span>" +
    "</div>";
  var li = document.createElement("li");
  li.innerHTML =
    '<span class="title">' +
    escapeHtml(titleText) +
    "</span> " +
    ratingsRow +
    '<span class="meta">' + escapeHtml(file) + "</span>";
  li.addEventListener("click", function () { showDetail(file, items); });
  list.appendChild(li);
});

function showDetail(file, items) {
  var panel = document.getElementById("detail");
  var fileMetric = DATA.fileMetrics.find(function (m) { return m.file === file; });
  var worstItem = items.length ? items.reduce(function (best, d) {
    return (sev[d.severity] || 0) > (sev[best.severity] || 0) ? d : best;
  }, items[0]) : null;
  var staticSeverity = worstItem ? worstItem.severity : "low";

  document.getElementById("detailTitle").textContent = items.length === 1
    ? (items[0].title || "Debt item")
    : items.length + " static issues";
  document.getElementById("detailFile").textContent = file;

  var explanationEl = document.getElementById("detailExplanation");
  var parts = [];
  parts.push(
    '<div class="detail-severities">' +
    '<span class="detail-sev"><strong>Static</strong> <span class="badge badge-' + staticSeverity + '">' + staticSeverity + "</span> (worst of " + items.length + ")</span> " +
    '<span class="detail-sev"><strong>LLM</strong> ' +
    (fileMetric && fileMetric.llmSeverity ? '<span class="badge badge-' + fileMetric.llmSeverity + '">' + fileMetric.llmSeverity + "</span>" : "<span class=\"debt-list-llm-none\">—</span>") +
    "</span></div>"
  );
  parts.push('<div class="detail-static-desc"><strong>Static issues</strong><ul class="detail-issues-list">');
  items.forEach(function (item) {
    parts.push(
      '<li><span class="badge badge-' + item.severity + '">' + item.severity + "</span> " +
      escapeHtml(item.title || "Issue") +
      (item.line ? " <span class=\"detail-line\">line " + item.line + "</span>" : "")
    );
    if (item.description)
      parts.push('<div class="detail-issue-desc">' + escapeHtml(item.description).replace(/\n/g, "<br>") + "</div>");
    parts.push("</li>");
  });
  parts.push("</ul></div>");
  parts.push('<div class="detail-llm-label"><strong>LLM assessment</strong></div>');
  if (fileMetric && (fileMetric.llmRawAssessment || fileMetric.llmAssessment)) {
    if (fileMetric.llmRawAssessment)
      parts.push('<div class="llm-output">' + renderLlmOutput(fileMetric.llmRawAssessment) + "</div>");
    else
      parts.push('<div class="llm-output"><div class="llm-prose">' + escapeHtml(fileMetric.llmAssessment).replace(/\n/g, "<br>") + "</div></div>");
    explanationEl.classList.add("has-llm-output");
  } else {
    parts.push('<div class="llm-prose detail-no-llm">No LLM assessment for this file.</div>');
    explanationEl.classList.remove("has-llm-output");
  }
  explanationEl.innerHTML = parts.join("");

  var codeEl = document.getElementById("detailSuggestedCode");
  if (fileMetric && fileMetric.llmSuggestedCode) {
    codeEl.style.display = "block";
    codeEl.innerHTML = "<strong>Suggested refactor</strong>" + codeBlockHtml(fileMetric.llmSuggestedCode, fileMetric.language || file);
  } else {
    codeEl.style.display = "none";
    codeEl.textContent = "";
  }

  var fileAssessEl = document.getElementById("detailFileAssessment");
  fileAssessEl.style.display = "none";
  fileAssessEl.textContent = "";

  panel.classList.add("show");
  panel.onclick = function (e) {
    if (e.target === panel) panel.classList.remove("show");
  };
}
