/*!
 * app.js —— 微积分作业查分台（学生端）
 * 视图：首页 / 我的完成情况 / 参考答案
 */
(function () {
  "use strict";

  var META_URL = "data/meta.json";
  var RECORDS_URL = "data/records.json";
  var SESSION_KEY = "calc-session-v1";

  var state = {
    meta: null,
    records: null,
    session: null,
    activeAnswer: null
  };

  var STATUS_TEXT = {
    missing: "未交",
    submitted: "已交 · 待批改",
    late: "迟交 · 待批改",
    graded: "已批改",
    late_graded: "迟交 · 已批改"
  };
  var STATUS_CLASS = {
    missing: "st-missing",
    submitted: "st-submitted",
    late: "st-late",
    graded: "st-graded",
    late_graded: "st-late-graded"
  };
  var SUBMITTED_SET = { submitted: true, late: true, graded: true, late_graded: true };

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fetchJSON(url) {
    return fetch(url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  var toastTimer = null;
  function toast(msg, ms) {
    var el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.hidden = true;
    }, ms || 3200);
  }

  function fmtDate(iso, withTime) {
    if (!iso) return "";
    try {
      var d = new Date(iso);
      return new Intl.DateTimeFormat("zh-CN", {
        month: "long",
        day: "numeric",
        hour: withTime ? "2-digit" : undefined,
        minute: withTime ? "2-digit" : undefined,
        hour12: false
      }).format(d);
    } catch (e) {
      return iso;
    }
  }

  function fmtDue(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    var diffDays = Math.ceil((d.getTime() - Date.now()) / 86400000);
    var base = "截止 " + fmtDate(iso, true);
    if (diffDays < 0) return base + "（已截止）";
    if (diffDays === 0) return base + "（今天截止）";
    if (diffDays === 1) return base + "（明天截止）";
    return base;
  }

  function slugLabel(slug) {
    return String(slug || "").toUpperCase();
  }

  function saveSession(payload) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch (e) { /* ignore */ }
  }
  function loadSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) { /* ignore */ }
  }

  /* ---------------- 首页 ---------------- */
  function renderHeader() {
    var site = state.meta.site || {};
    document.title = site.title || "微积分 · 作业查分台";
    $("#site-title").textContent = site.title || "微积分 · 作业查分台";
    $("#site-sub").textContent =
      (site.courseName || "") + " · " + (site.teacher || "") + " · " + (site.semester || "");
    $("#hero-eyebrow").textContent = site.courseName || "你好，欢迎打开作业本";
    if (site.shortNote) $("#hero-note").textContent = site.shortNote;
    $("#policy-note").textContent = site.policyNote || "";
    $("#footer-contact").textContent =
      "如有问题请联系任课老师：" + (site.contact || "");

    var demo = state.meta.demo;
    var banner = $("#demo-banner");
    banner.hidden = !demo;
    $("#demo-hint").hidden = !demo;
    if (demo) {
      banner.innerHTML =
        "<strong>演示模式</strong><span>学号 <code>20260001</code> · 查询码 <code>math2026</code>（正式启用时老师会关闭演示）</span>";
    }
  }

  function renderHomeAnnouncements() {
    var box = $("#home-announcements");
    var list = (state.meta.announcements || []).slice().reverse();
    if (!list.length) {
      box.innerHTML = '<p class="announce-body">暂无公告。</p>';
      return;
    }
    box.innerHTML = list
      .map(function (a) {
        return (
          '<div class="announce-item">' +
          '<div class="announce-title"><span>' + esc(a.title) + "</span>" +
          '<span class="announce-date">' + esc(fmtDate(a.date)) + "</span></div>" +
          (a.body ? '<p class="announce-body">' + esc(a.body) + "</p>" : "") +
          "</div>"
        );
      })
      .join("");
  }

  function renderHomeAssignments() {
    var box = $("#home-assignments");
    var list = state.meta.assignments || [];
    if (!list.length) {
      box.innerHTML = '<p class="announce-body">作业安排即将发布。</p>';
      return;
    }
    box.innerHTML = list
      .map(function (a) {
        var published = a.answer && a.answer.published;
        var due = a.due ? new Date(a.due) : null;
        var overdue = due && due.getTime() < Date.now();
        var titleHtml = published
          ? '<a href="#/answers/' + encodeURIComponent(a.slug) + '">' + esc(a.title) + "</a>"
          : esc(a.title);
        var topics = (a.topics || []).join(" · ");
        return (
          '<div class="mini-row">' +
          '<div class="mini-index">' + esc(slugLabel(a.slug)) + "</div>" +
          "<div>" +
          '<div class="mini-title">' + titleHtml + "</div>" +
          '<div class="mini-meta">' + esc(topics) + "</div>" +
          '<div class="mini-due">' + esc(fmtDue(a.due)) + "</div>" +
          "</div>" +
          '<div style="text-align:right">' +
          '<span class="pill ' + (published ? "pill-on" : "pill-off") + '">' +
          (published ? "参考答案已公布" : "参考答案未公布") +
          "</span>" +
          (overdue ? ' <span class="pill pill-done">已截止</span>' : ' <span class="pill pill-due">进行中</span>') +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  /* ---------------- 登录 / 我的记录 ---------------- */
  function getRecordBySid(sid) {
    var list = state.records.records || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].sid === sid) return list[i];
    }
    return null;
  }

  function showLogin() {
    $("#login-card").hidden = false;
    $("#me-content").hidden = true;
  }

  function renderMeView() {
    if (!state.session) {
      showLogin();
      return;
    }
    $("#login-card").hidden = true;
    $("#me-content").hidden = false;

    var p = state.session;
    $("#me-name-line").textContent = p.name + " · 学号 " + p.sid;
    $("#me-title-line").textContent = p.name + " 同学的作业记录";

    var list = state.meta.assignments || [];
    var graded = [];
    var submitted = 0;
    list.forEach(function (a) {
      var rec = (p.assignments || {})[a.slug];
      if (!rec) return;
      if (SUBMITTED_SET[rec.status]) submitted++;
      if (rec.status === "graded" || rec.status === "late_graded") graded.push(rec);
    });
    var avgPct = null;
    var sumPct = 0;
    graded.forEach(function (g) {
      var max = typeof g.max === "number" ? g.max : 100;
      if (typeof g.score === "number") sumPct += (g.score / max) * 100;
    });
    if (graded.length) avgPct = Math.round(sumPct / graded.length);

    var stats = [
      { num: list.length, label: "作业总数", cls: "" },
      { num: submitted, label: "已提交", cls: "amber" },
      { num: graded.length, label: "已批改", cls: "green" },
      { num: avgPct === null ? "—" : avgPct, label: "平均分（百分制）", cls: "" }
    ];
    $("#me-stats").innerHTML = stats
      .map(function (s) {
        return (
          '<div class="stat-item ' + s.cls + '">' +
          '<span class="stat-num">' + esc(s.num) + "</span>" +
          '<span class="stat-label">' + esc(s.label) + "</span></div>"
        );
      })
      .join("");

    var rowsHtml = list
      .map(function (a, idx) {
        var rec = (p.assignments || {})[a.slug] || { status: "missing" };
        var st = STATUS_TEXT[rec.status] || rec.status || "未交";
        var stCls = STATUS_CLASS[rec.status] || "st-missing";
        var published = a.answer && a.answer.published;
        var showAnswer = published
          ? '<a class="btn btn-ghost btn-sm" href="#/answers/' + encodeURIComponent(a.slug) + '">参考答案</a>'
          : "";
        var hasScore = (rec.status === "graded" || rec.status === "late_graded") &&
          typeof rec.score === "number";
        var scoreHtml;
        if (hasScore) {
          var maxTxt = typeof rec.max === "number" ? " / " + rec.max : "";
          scoreHtml =
            '<div class="seal ' + (rec.status === "late_graded" ? "seal-late-graded" : "seal-graded") + '">' +
            '<span class="seal-score">' + esc(rec.score) + "</span>" +
            '<span class="seal-max">' + esc(maxTxt.replace(" / ", "满分 ")) + "</span></div>";
        } else {
          scoreHtml = '<span class="no-score">—</span>';
        }
        var hasComment = rec.comment && rec.comment.trim();
        var actions = "";
        if (hasComment) {
          actions +=
            '<button class="link-btn toggle-comment" type="button" data-row="' + idx + '">查看批注</button>';
        }
        if (showAnswer) actions += showAnswer;

        return (
          '<div class="record-row" style="--i:' + idx + '">' +
          '<div class="rr-index">' + esc(slugLabel(a.slug)) + "</div>" +
          "<div>" +
          '<div class="rr-title">' + esc(a.title) + "</div>" +
          '<div class="rr-sub">' + esc(fmtDue(a.due)) + "</div>" +
          "</div>" +
          '<div class="rr-status"><span class="stamp ' + stCls + '">' + esc(st) + "</span></div>" +
          '<div class="rr-score">' + scoreHtml + "</div>" +
          '<div class="rr-actions">' + actions + "</div>" +
          (hasComment
            ? '<div class="record-comment" id="comment-' + idx + '" hidden><b>老师批注：</b>' +
              esc(rec.comment) + "</div>"
            : "") +
          "</div>"
        );
      })
      .join("");

    var emptyNote =
      '<p class="announce-body" style="margin:10px 0">这里还没有作业记录。老师发布批改结果后，刷新本页即可看到。</p>';
    $("#me-record-list").innerHTML = list.length ? rowsHtml : emptyNote;
  }

  function bindMeEvents() {
    $("#login-form").addEventListener("submit", onLogin);
    $("#btn-logout").addEventListener("click", function () {
      state.session = null;
      clearSession();
      showLogin();
      $("#login-sid").focus();
      toast("已退出登录");
    });
    $("#btn-print").addEventListener("click", function () {
      window.print();
    });
    $("#demo-hint").addEventListener("click", function () {
      $("#login-sid").value = "20260001";
      $("#login-code").value = "math2026";
      $("#login-code").focus();
    });
    $("#me-record-list").addEventListener("click", function (ev) {
      var btn = ev.target.closest(".toggle-comment");
      if (!btn) return;
      var row = btn.getAttribute("data-row");
      var box = document.getElementById("comment-" + row);
      if (!box) return;
      box.hidden = !box.hidden;
      btn.textContent = box.hidden ? "查看批注" : "收起批注";
    });
  }

  async function onLogin(ev) {
    ev.preventDefault();
    var errBox = $("#login-error");
    errBox.hidden = true;
    var sid = $("#login-sid").value.trim();
    var code = $("#login-code").value;
    if (!sid || !code) {
      errBox.textContent = "请输入学号和查询码。";
      errBox.hidden = false;
      return;
    }
    var submitBtn = $('button[type="submit"]', ev.target);
    submitBtn.disabled = true;
    submitBtn.textContent = "正在核对…";
    try {
      var rec = getRecordBySid(sid);
      if (!rec) throw new Error("not found");
      var payload = await CalcCrypto.decryptPayload(rec, code);
      if (!payload || payload.sid !== sid) throw new Error("bad");
      state.session = payload;
      saveSession(payload);
      renderMeView();
      toast("登录成功，" + payload.name + " 同学");
    } catch (e) {
      errBox.textContent = "学号或查询码不正确，请重新输入。若查询码遗失，请联系老师。";
      errBox.hidden = false;
      $("#login-code").select();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "查 询";
    }
  }

  /* ---------------- 参考答案 ---------------- */
  function publishedAssignments() {
    return (state.meta.assignments || []).filter(function (a) {
      return a.answer && a.answer.published;
    });
  }

  function renderAnswerTabs(activeSlug) {
    var list = publishedAssignments();
    var tabs = $("#answer-tabs");
    tabs.innerHTML = list
      .map(function (a) {
        return (
          '<button class="answer-tab ' + (a.slug === activeSlug ? "active" : "") +
          '" type="button" data-slug="' + esc(a.slug) + '">' + esc(slugLabel(a.slug)) + "</button>"
        );
      })
      .join("");
    $$(".answer-tab", tabs).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var slug = btn.getAttribute("data-slug");
        location.hash = "#/answers/" + encodeURIComponent(slug);
      });
    });
  }

  function renderAnswersView(param) {
    var list = publishedAssignments();
    var policy = $("#answer-policy");
    policy.textContent =
      (state.meta.site && state.meta.site.policyNote) ||
      "参考答案在批改完成后按老师安排公布。";

    if (!list.length) {
      renderAnswerTabs(null);
      $("#answer-content").hidden = true;
      showGate("暂无已公布的参考答案", "答案将在对应作业截止、批改完成后陆续发布，请留意首页公告。", false);
      return;
    }
    if (param) {
      var all = state.meta.assignments || [];
      var known = null;
      for (var k = 0; k < all.length; k++) {
        if (all[k].slug === param) known = all[k];
      }
      if (known && !(known.answer && known.answer.published)) {
        renderAnswerTabs(null);
        showGate("该作业的参考答案尚未公布", "老师会在批改完成后发布。公布后本页会自动出现该作业。", false);
        return;
      }
    }
    var target = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].slug === param) target = list[i];
    }
    if (!target) target = list[0];
    renderAnswerTabs(target.slug);
    loadAnswer(target);
  }

  function showGate(title, body, showLoginBtn) {
    var gate = $("#answer-gate");
    $("#answer-content").hidden = true;
    gate.hidden = false;
    gate.innerHTML =
      '<div class="gate-icon">锁</div>' +
      "<h3>" + esc(title) + "</h3>" +
      "<p>" + esc(body) + "</p>" +
      (showLoginBtn
        ? '<p style="margin-top:16px"><a class="btn btn-primary" href="#/me">登录我的账号</a></p>'
        : "");
  }

  async function loadAnswer(a) {
    var gate = $("#answer-gate");
    var content = $("#answer-content");
    gate.hidden = true;
    content.hidden = true;

    var needsSubmit = a.answer.requiresSubmission;
    var rec = state.session && (state.session.assignments || {})[a.slug];
    var submitted = !!(rec && SUBMITTED_SET[rec.status]);
    if (needsSubmit && !state.session) {
      showGate(
        "本作业参考答案需要登录后查看",
        "老师设置了“提交作业后才能查看参考答案”。请先登录你的账号。",
        true
      );
      return;
    }
    if (needsSubmit && !submitted) {
      showGate(
        "本作业的参考答案需要先提交作业",
        "检测到你还没有提交这份作业的记录。请先按时完成并提交，待记录更新后再来查看。",
        false
      );
      return;
    }

    content.innerHTML = '<div class="answer-loading">正在载入答案…</div>';
    content.hidden = false;
    try {
      var res = await fetch("answers/" + encodeURIComponent(a.slug) + ".md", { cache: "no-store" });
      if (!res.ok) throw new Error("missing file");
      var md = await res.text();
      var html = renderMarkdown(md);
      var headNote = a.answer.releaseNote
        ? '<div class="release-note"><b>' + esc(a.title) + "</b>：" +
          esc(a.answer.releaseNote) + "</div>"
        : "";
      content.innerHTML = headNote + '<div class="answer-body">' + html + "</div>";
      if (typeof katex !== "undefined" && katex.render) {
        $$(".math-inline,.math-display", content).forEach(function (span) {
          var tex = span.getAttribute("data-tex") || "";
          try {
            katex.render(tex, span, {
              displayMode: span.classList.contains("math-display"),
              throwOnError: false,
              strict: false
            });
          } catch (err) {
            span.textContent = tex;
          }
        });
      }
      content.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      showGate("答案暂时无法打开", "对应的答案文件尚未上传，或访问时出现问题。请稍后再试，或联系老师。", false);
    }
  }

  /* ---------- Markdown + KaTeX 渲染 ---------- */
  var MARK_RE = /⟦(\d+)⟧/g;

  function maskFences(md) {
    var parts = [];
    var idx = 0;
    var re = /```[\s\S]*?```/g;
    var m;
    var out = "";
    var last = 0;
    while ((m = re.exec(md))) {
      out += md.slice(last, m.index) + "⟦" + idx + "⟧";
      parts.push({ kind: "code", text: m[0] });
      idx++;
      last = re.lastIndex;
    }
    out += md.slice(last);
    return { text: out, parts: parts };
  }

  function maskMath(md, parts) {
    var i = parts.length;
    var mark = function (tex, display) {
      parts.push({ kind: display ? "display" : "inline", text: tex });
      return "⟦" + i++ + "⟧";
    };
    var s = md;
    s = s.replace(/\$\$([\s\S]+?)\$\$/g, function (_, tex) {
      return mark(tex.trim(), true);
    });
    s = s.replace(/\\\[([\s\S]+?)\\\]/g, function (_, tex) {
      return mark(tex.trim(), true);
    });
    s = s.replace(/\$([^$\n]+?)\$/g, function (_, tex) {
      return mark(tex.trim(), false);
    });
    s = s.replace(/\\\(([\s\S]+?)\\\)/g, function (_, tex) {
      return mark(tex.trim(), false);
    });
    return s;
  }

  function renderMarkdown(md) {
    if (typeof marked === "undefined" || !marked.parse) {
      return '<p class="err-note">Markdown 渲染组件未正确加载，请检查 assets/vendor/marked 是否存在。</p>';
    }
    var masked = maskFences(md);
    var text = maskMath(masked.text, masked.parts);
    var html = "";
    try {
      html = marked.parse(text);
    } catch (e) {
      return '<p class="err-note">答案排版出错：' + esc(e.message) + "</p>";
    }
    var host = document.createElement("div");
    host.innerHTML = html;
    restoreTokens(host, masked.parts);
    return host.innerHTML;
  }

  function restoreTokens(container, parts) {
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      var text = node.nodeValue;
      if (!text || !MARK_RE.test(text)) return;
      MARK_RE.lastIndex = 0;
      var parent = node.parentNode;
      var frag = document.createDocumentFragment();
      var last = 0;
      var m;
      while ((m = MARK_RE.exec(text))) {
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var item = parts[parseInt(m[1], 10)];
        frag.appendChild(makeMathNode(item));
        last = m.index + m[0].length;
      }
      MARK_RE.lastIndex = 0;
      frag.appendChild(document.createTextNode(text.slice(last)));
      var codeOnlyParagraph =
        parent &&
        parent.tagName === "P" &&
        parent.childNodes.length === 1 &&
        frag.firstChild &&
        frag.firstChild.tagName === "PRE";
      if (codeOnlyParagraph && parent.parentNode) {
        parent.parentNode.replaceChild(frag, parent);
      } else if (parent) {
        parent.replaceChild(frag, node);
      }
    });
  }

  function makeMathNode(item) {
    if (!item) return document.createTextNode("");
    if (item.kind === "code") {
      var pre = document.createElement("pre");
      var codeEl = document.createElement("code");
      codeEl.textContent = item.text
        .replace(/^```[^\n]*\n?/, "")
        .replace(/```\s*$/, "");
      pre.appendChild(codeEl);
      return pre;
    }
    var span = document.createElement("span");
    span.className = item.kind === "display" ? "math-display" : "math-inline";
    span.setAttribute("data-tex", item.text);
    span.textContent = item.text;
    return span;
  }

  /* ---------------- 路由 ---------------- */
  function currentRoute() {
    var raw = location.hash.replace(/^#\/?/, "");
    var parts = raw.split("/").filter(Boolean);
    return { name: parts[0] || "home", param: parts[1] ? decodeURIComponent(parts[1]) : null };
  }

  function route() {
    var r = currentRoute();
    $$(".view").forEach(function (sec) {
      sec.hidden = sec.getAttribute("data-view") !== r.name;
    });
    $$(".tab").forEach(function (tab) {
      tab.classList.toggle("active", tab.getAttribute("data-route") === r.name);
    });
    if (r.name === "home") {
      renderHomeAnnouncements();
      renderHomeAssignments();
    } else if (r.name === "me") {
      renderMeView();
    } else if (r.name === "answers") {
      renderAnswersView(r.param);
    } else {
      location.hash = "#/home";
    }
  }

  function showFatal(msg) {
    var el = $("#view-home");
    el.hidden = false;
    $("#view-me").hidden = true;
    $("#view-answers").hidden = true;
    el.innerHTML =
      '<div class="sheet" style="margin-top:20px">' +
      "<h2 class=\"sheet-title\">页面初始化失败</h2>" +
      "<p>原因：" + esc(msg) + "</p>" +
      "<p>请确认：1) 通过 HTTPS（GitHub Pages）访问本页面；2) data/ 下的 meta.json 与 records.json 都存在。</p>" +
      "</div>";
  }

  async function boot() {
    try {
      var results = await Promise.all([fetchJSON(META_URL), fetchJSON(RECORDS_URL)]);
      state.meta = results[0];
      state.records = results[1];
      state.session = loadSession();
      if (state.session) {
        var rec = getRecordBySid(state.session.sid);
        if (!rec) {
          state.session = null;
          clearSession();
        }
      }
      renderHeader();
      bindMeEvents();
      window.addEventListener("hashchange", route);
      route();
      if (state.meta.demo && /[?&]preview=1/.test(location.search)) {
        try {
          var demoRec = getRecordBySid("20260001");
          if (demoRec) {
            state.session = await CalcCrypto.decryptPayload(demoRec, "math2026");
            saveSession(state.session);
            route();
          }
        } catch (e) {
          console.warn("preview login failed", e);
        }
      }
    } catch (e) {
      console.error(e);
      showFatal(e && e.message ? e.message : "无法读取课程数据");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
