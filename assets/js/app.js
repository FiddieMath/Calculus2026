/*!
 * app.js —— 微积分作业查分台（简约版）
 * 主页：学号查询（弹窗显示完成情况）+ 作业安排表 + 附加资料表
 */
(function () {
  "use strict";

  var META_URL = "data/meta.json";
  var RECORDS_URL = "data/records.json";
  var SESSION_KEY = "calc-session-v2";

  var state = {
    meta: null,
    records: null,
    session: null
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

  function fmtDate(iso) {
    if (!iso) return "";
    try {
      return new Intl.DateTimeFormat("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(new Date(iso));
    } catch (e) {
      return String(iso);
    }
  }
  function isOverdue(iso) {
    return iso ? new Date(iso).getTime() < Date.now() : false;
  }

  function saveSession(payload) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload)); } catch (e) { /* ignore */ }
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
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  }

  function getRecordBySid(sid) {
    var list = state.records.records || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].sid === sid) return list[i];
    }
    return null;
  }

  /* ---------- 头部与主页表格 ---------- */
  function renderHeader() {
    var site = state.meta.site || {};
    document.title = site.title || "微积分 · 作业查分台";
    $("#site-title").textContent = site.title || "微积分 · 作业查分台";
    $("#site-sub").textContent =
      (site.courseName || "") + " · " + (site.teacher || "") + " · " + (site.semester || "");
    $("#footer-contact").textContent = "如有问题请联系任课老师：" + (site.contact || "");

    var demo = !!state.meta.demo;
    var banner = $("#demo-banner");
    banner.hidden = !demo;
    if (demo) {
      banner.innerHTML =
        "演示模式：学号 <code>20260001</code> · 查询码 <code>20260001</code>";
    }
    updateWhoami();
  }

  function updateWhoami() {
    var el = $("#whoami");
    if (!state.session) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.innerHTML =
      "当前：<b>" + esc(state.session.name) + "</b>（" + esc(state.session.sid) + "）" +
      ' <button type="button" id="logout-btn">退出</button>';
    var btn = $("#logout-btn");
    if (btn) btn.addEventListener("click", function () {
      state.session = null;
      clearSession();
      updateWhoami();
    });
  }

  function renderHomeTables() {
    var list = state.meta.assignments || [];
    $("#assign-rows").innerHTML = list.length
      ? list.map(function (a, i) {
          var contentPublished = a.content && a.content.published;
          var answerPublished = a.answer && a.answer.published;
          var contentHtml;
          if (a.title && (contentPublished || answerPublished)) {
            var tags = "";
            if (contentPublished) tags += '<span class="tag tag-on">题目已更新</span>';
            if (answerPublished) tags += '<span class="tag tag-on">答案已更新</span>';
            contentHtml =
              '<a href="#/work/' + encodeURIComponent(a.slug) + '">' + esc(a.title) + "</a>" + tags;
          } else {
            contentHtml = '<span class="empty">待更新</span>';
          }
          var dueHtml = a.due
            ? esc(fmtDate(a.due)) + (isOverdue(a.due) ? ' <span class="tag">已截止</span>' : "")
            : "";
          return (
            '<tr>' +
            '<td class="num">第 ' + (i + 1) + " 次</td>" +
            '<td class="num">' + dueHtml + "</td>" +
            "<td>" + contentHtml + "</td>" +
            "</tr>"
          );
        }).join("")
      : '<tr><td colspan="3" class="empty">作业安排将在开学后公布。</td></tr>';

    var mats = state.meta.materials || [];
    $("#material-rows").innerHTML = mats.length
      ? mats.map(function (m) {
          var published = m.published;
          var name = published
            ? '<a href="#/material/' + encodeURIComponent(m.slug) + '">' + esc(m.title) + "</a>"
            : esc(m.title);
          var tag = published
            ? '<span class="tag tag-on">可阅读</span>'
            : '<span class="tag">筹备中</span>';
          return "<tr><td>" + name + "</td><td>" + tag + "</td></tr>";
        }).join("")
      : '<tr><td colspan="2" class="empty">暂无资料，将陆续添加（如期中考试讲解等）。</td></tr>';
  }

  /* ---------- 登录 ---------- */
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
    var btn = $('button[type="submit"]', ev.target);
    btn.disabled = true;
    btn.textContent = "查询中…";
    try {
      var rec = getRecordBySid(sid);
      if (!rec) throw new Error("not found");
      var payload = await CalcCrypto.decryptPayload(rec, code);
      if (!payload || payload.sid !== sid) throw new Error("bad");
      state.session = payload;
      saveSession(payload);
      updateWhoami();
      openStatusModal();
    } catch (e) {
      errBox.textContent = "学号或查询码不正确，请重新输入；忘记查询码请联系老师。";
      errBox.hidden = false;
      $("#login-code").select();
    } finally {
      btn.disabled = false;
      btn.textContent = "查询";
    }
  }

  function openStatusModal() {
    var p = state.session;
    if (!p) return;
    $("#modal-note").textContent = p.name + " · 学号 " + p.sid;
    var list = state.meta.assignments || [];
    $("#status-rows").innerHTML = list.length
      ? list.map(function (a, i) {
          var assignments = p.assignments || {};
          var rec = assignments[a.slug] || { status: "missing" };
          var hasRec = !!assignments[a.slug];
          var st, stCls;
          if (hasRec) {
            st = STATUS_TEXT[rec.status] || rec.status || "未交";
            stCls = STATUS_CLASS[rec.status] || "st-missing";
          } else {
            var announced =
              a.due || (a.content && a.content.published) || (a.answer && a.answer.published);
            st = announced ? "未交" : "未布置";
            stCls = announced ? "st-missing" : "st-pending";
          }
          var hasScore =
            (rec.status === "graded" || rec.status === "late_graded") &&
            typeof rec.score === "number";
          var score = hasScore
            ? esc(rec.score) + (typeof rec.max === "number" ? " / " + esc(rec.max) : "")
            : "—";
          var comment = rec.comment && rec.comment.trim() ? esc(rec.comment) : "—";
          return (
            "<tr>" +
            '<td class="num">第 ' + (i + 1) + " 次</td>" +
            '<td class="num">' + (a.due ? esc(fmtDate(a.due)) + (isOverdue(a.due) ? ' <span class="tag">已截止</span>' : "") : "") + "</td>" +
            '<td><span class="' + stCls + '"><span class="st-dot"></span>' + esc(st) + "</span></td>" +
            '<td class="score">' + score + "</td>" +
            '<td class="comment-cell">' + comment + "</td>" +
            "</tr>"
          );
        }).join("")
      : '<tr><td colspan="5" class="empty">暂无作业记录。</td></tr>';
    $("#status-modal").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeStatusModal() {
    $("#status-modal").hidden = true;
    document.body.style.overflow = "";
  }

  /* ---------- 路由 ---------- */
  function currentRoute() {
    var raw = location.hash.replace(/^#\/?/, "");
    var parts = raw.split("/").filter(Boolean);
    return {
      name: parts[0] || "home",
      param: parts[1] ? decodeURIComponent(parts[1]) : null
    };
  }

  function findAssignment(slug) {
    var list = state.meta.assignments || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].slug === slug) return list[i];
    }
    return null;
  }

  function route() {
    var r = currentRoute();
    var home = $("#view-home");
    var work = $("#view-assignment");
    var mat = $("#view-material");
    home.hidden = true;
    work.hidden = true;
    mat.hidden = true;

    if (r.name === "work" && r.param) {
      loadWork(r.param);
    } else if (r.name === "material" && r.param) {
      loadMaterial(r.param);
    } else {
      if (location.hash && location.hash !== "#/home") location.hash = "#/home";
      home.hidden = false;
      renderHomeTables();
    }
  }

  /* ---------- 作业详情 ---------- */
  function noteHtml(text) {
    return '<p class="empty-note">' + esc(text) + "</p>";
  }

  async function loadWork(slug) {
    var a = findAssignment(slug);
    var work = $("#view-assignment");
    var home = $("#view-home");
    var metaList = state.meta.assignments || [];
    home.hidden = true;
    work.hidden = false;

    if (!a) {
      $("#work-title").textContent = "未找到该作业";
      $("#work-due").textContent = "";
      $("#work-content").innerHTML = noteHtml("该作业不存在，请返回作业安排。");
      $("#work-answer").innerHTML = "";
      return;
    }
    var idx = 0;
    for (var j = 0; j < metaList.length; j++) {
      if (metaList[j].slug === slug) idx = j;
    }
    $("#work-title").textContent = a.title || "第 " + (idx + 1) + " 次作业";
    $("#work-due").textContent =
      a.due
        ? "截止时间：" + fmtDate(a.due) + (isOverdue(a.due) ? "（已截止）" : "")
        : "";

    var contentBox = $("#work-content");
    var answerBox = $("#work-answer");
    contentBox.innerHTML = "";
    answerBox.innerHTML = "";

    if (a.content && a.content.published) {
      try {
        var res = await fetch("problems/" + encodeURIComponent(a.slug) + ".md", { cache: "no-store" });
        if (!res.ok) throw new Error("missing");
        contentBox.innerHTML = renderMarkdown(await res.text());
      } catch (e) {
        contentBox.innerHTML = noteHtml("题目页面正在更新，请稍后再来查看。");
      }
    } else {
      contentBox.innerHTML = noteHtml("本次作业已布置，题目与要求将在此页面更新，请留意。");
    }

    var ansTitle = '<h2 style="margin-top:0">参考答案</h2>';
    if (a.answer && a.answer.published) {
      var needsSubmit = a.answer.requiresSubmission;
      var rec = state.session && (state.session.assignments || {})[a.slug];
      var submitted = !!(rec && SUBMITTED_SET[rec.status]);
      if (needsSubmit && !submitted) {
        answerBox.innerHTML =
          ansTitle +
          noteHtml(
            state.session
              ? "老师设置了“提交作业后才能查看参考答案”。提交记录更新后即可查看。"
              : "老师设置了“提交作业后才能查看参考答案”，请先返回主页登录。"
          );
        return;
      }
      try {
        var res2 = await fetch("answers/" + encodeURIComponent(a.slug) + ".md", { cache: "no-store" });
        if (!res2.ok) throw new Error("missing");
        answerBox.innerHTML = ansTitle + renderMarkdown(await res2.text());
      } catch (e) {
        answerBox.innerHTML = ansTitle + noteHtml("参考答案正在整理中，请稍后再来查看。");
      }
    } else {
      answerBox.innerHTML = ansTitle + noteHtml("参考答案尚未公布，公布后将在此处更新。");
    }
  }

  /* ---------- 附加资料 ---------- */
  async function loadMaterial(slug) {
    var mats = state.meta.materials || [];
    var m = null;
    for (var i = 0; i < mats.length; i++) {
      if (mats[i].slug === slug) m = mats[i];
    }
    var matView = $("#view-material");
    var home = $("#view-home");
    home.hidden = true;
    matView.hidden = false;
    $("#mat-title").textContent = m ? m.title : "附加资料";
    var box = $("#mat-content");
    if (!m || !m.published) {
      box.innerHTML = noteHtml("该资料尚未发布。");
      return;
    }
    try {
      var res = await fetch("materials/" + encodeURIComponent(m.slug) + ".md", { cache: "no-store" });
      if (!res.ok) throw new Error("missing");
      box.innerHTML = renderMarkdown(await res.text());
    } catch (e) {
      box.innerHTML = noteHtml("资料正在整理中，请稍后再来查看。");
    }
  }

  /* ---------- Markdown + KaTeX ---------- */
  var MARK_RE = /⟦(\d+)⟧/g;

  function maskFences(md) {
    var parts = [];
    var idx = 0;
    var out = "";
    var re = /```[\s\S]*?```/g;
    var m;
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
    function mark(tex, display) {
      parts.push({ kind: display ? "display" : "inline", text: tex });
      return "⟦" + i++ + "⟧";
    }
    return md
      .replace(/\$\$([\s\S]+?)\$\$/g, function (_, tex) { return mark(tex.trim(), true); })
      .replace(/\\\[([\s\S]+?)\\\]/g, function (_, tex) { return mark(tex.trim(), true); })
      .replace(/\$([^$\n]+?)\$/g, function (_, tex) { return mark(tex.trim(), false); })
      .replace(/\\\(([\s\S]+?)\\\)/g, function (_, tex) { return mark(tex.trim(), false); });
  }

  function renderMarkdown(md) {
    if (typeof marked === "undefined" || !marked.parse) {
      return '<p class="empty-note">Markdown 渲染组件未正确加载。</p>';
    }
    var masked = maskFences(md);
    var text = maskMath(masked.text, masked.parts);
    var html;
    try {
      html = marked.parse(text);
    } catch (e) {
      return '<p class="empty-note">内容排版出错：' + esc(e.message) + "</p>";
    }
    var host = document.createElement("div");
    host.innerHTML = html;
    restoreTokens(host, masked.parts);
    var out = host.innerHTML;
    if (typeof katex !== "undefined" && katex.render) {
      var spans = $$(".math-inline,.math-display", host);
      spans.forEach(function (span) {
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
      out = host.innerHTML;
    }
    return out;
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
        frag.appendChild(makeMathNode(parts[parseInt(m[1], 10)]));
        last = m.index + m[0].length;
      }
      MARK_RE.lastIndex = 0;
      frag.appendChild(document.createTextNode(text.slice(last)));
      var codeOnlyParagraph =
        parent && parent.tagName === "P" && parent.childNodes.length === 1 &&
        frag.firstChild && frag.firstChild.tagName === "PRE";
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
      codeEl.textContent = item.text.replace(/^```[^\n]*\n?/, "").replace(/```\s*$/, "");
      pre.appendChild(codeEl);
      return pre;
    }
    var span = document.createElement("span");
    span.className = item.kind === "display" ? "math-display" : "math-inline";
    span.setAttribute("data-tex", item.text);
    span.textContent = item.text;
    return span;
  }

  function showFatal(msg) {
    var home = $("#view-home");
    home.hidden = false;
    home.innerHTML =
      '<div class="panel"><h2>页面初始化失败</h2>' +
      "<p>" + esc(msg) + "</p>" +
      "<p>请通过 HTTPS（GitHub Pages）访问，并确认 data/ 下文件齐全。</p></div>";
  }

  /* ---------- 启动 ---------- */
  function bindEvents() {
    $("#login-form").addEventListener("submit", onLogin);
    $("#modal-close").addEventListener("click", closeStatusModal);
    $("#status-modal").addEventListener("click", function (ev) {
      if (ev.target === ev.currentTarget) closeStatusModal();
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && !$("#status-modal").hidden) closeStatusModal();
    });
    window.addEventListener("hashchange", route);
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
      bindEvents();
      route();
      if (state.meta.demo && /[?&]preview=1/.test(location.search)) {
        try {
          var demoRec = getRecordBySid("20260001");
          if (demoRec) {
            state.session = await CalcCrypto.decryptPayload(demoRec, "20260001");
            saveSession(state.session);
            updateWhoami();
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
