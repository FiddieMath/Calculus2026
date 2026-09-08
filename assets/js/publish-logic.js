/*!
 * publish-logic.js —— 教师端数据处理（CSV 解析、台账合并、生成加密 records）
 * 浏览器：window.CalcPublish；Node：module.exports
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.CalcPublish = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---------- CSV / TSV 解析 ----------
  function detectDelimiter(header) {
    if (header.indexOf("\t") >= 0 && header.indexOf(",") < 0) return "\t";
    return ",";
  }

  function splitRow(line, delim) {
    // 简易解析：支持引号包裹（去掉首尾引号），不支持引号内嵌分隔符的复杂情况（班级名单足够用）
    return line
      .split(delim)
      .map(function (cell) {
        cell = cell.trim();
        if (cell.length >= 2 && cell[0] === '"' && cell[cell.length - 1] === '"') {
          cell = cell.slice(1, -1).replace(/""/g, '"');
        }
        return cell.trim();
      });
  }

  function parseTable(text) {
    const rows = [];
    const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/);
    let delim = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith("#")) continue;
      if (delim === null) delim = detectDelimiter(line);
      const cells = splitRow(line, delim);
      if (cells.length && cells.some(function (c) { return c !== ""; })) {
        rows.push(cells);
      }
    }
    return rows;
  }

  // ---------- 名单 / 查询码 ----------
  function parseRoster(text) {
    const rows = parseTable(text);
    const out = [];
    const seen = {};
    for (let i = 0; i < rows.length; i++) {
      const sid = String(rows[i][0] || "").trim();
      const name = String(rows[i][1] || "").trim();
      if (!sid || seen[sid]) continue;
      seen[sid] = true;
      out.push({ sid: sid, name: name || sid });
    }
    return out;
  }

  function parseKeys(text) {
    const rows = parseTable(text);
    const map = {};
    const list = [];
    for (let i = 0; i < rows.length; i++) {
      const sid = String(rows[i][0] || "").trim();
      const name = String(rows[i][1] || "").trim();
      const code = String(rows[i][2] || rows[i][1] || "").trim();
      if (!sid || !code || map[sid]) continue;
      map[sid] = code;
      list.push({ sid: sid, name: name, code: code });
    }
    return { map: map, list: list };
  }

  function makeKeysCsv(students, keysMap) {
    const lines = ["学号,姓名,查询码"];
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      lines.push(s.sid + "," + s.name + "," + (keysMap[s.sid] || ""));
    }
    return "\uFEFF" + lines.join("\r\n");
  }

  // ---------- 成绩 ----------
  function normalizeStatus(raw) {
    const s = String(raw || "").trim();
    if (/未交|缺交|missing/i.test(s)) return "missing";
    if (/迟交|late/i.test(s)) return "late";
    return "submitted";
  }

  function parseGrades(text) {
    const rows = parseTable(text);
    const out = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const sid = String(r[0] || "").trim();
      if (!sid) continue;
      const statusRaw = String(r[1] || "").trim();
      const scoreRaw = String(r[2] || "").trim();
      const maxRaw = String(r[3] || "").trim();
      const comment = String(r[4] || "").trim();
      const score = scoreRaw === "" ? NaN : Number(scoreRaw);
      const max = maxRaw === "" ? NaN : Number(maxRaw);
      let status = normalizeStatus(statusRaw);
      if (!Number.isNaN(score)) {
        status = status === "late" ? "late_graded" : "graded";
      }
      const rec = { status: status };
      if (!Number.isNaN(score)) rec.score = score;
      if (!Number.isNaN(max)) rec.max = max;
      if (comment) rec.comment = comment;
      out.push({ sid: sid, record: rec });
    }
    return out;
  }

  // ---------- 台账 ----------
  function emptyClassbook(course) {
    return {
      version: 2,
      course: course || {},
      students: []
    };
  }

  function classbookFromRoster(roster, oldClassbook) {
    const cb = oldClassbook && oldClassbook.students
      ? oldClassbook
      : emptyClassbook(oldClassbook && oldClassbook.course);
    const existing = {};
    cb.students.forEach(function (s) { existing[s.sid] = s; });
    roster.forEach(function (row) {
      if (existing[row.sid]) return;
      const st = {
        sid: row.sid,
        name: row.name,
        assignments: {}
      };
      cb.students.push(st);
      existing[row.sid] = st;
    });
    return cb;
  }

  function mergeGrades(classbook, gradeRows, slug) {
    const warnings = [];
    const bySid = {};
    classbook.students.forEach(function (s) { bySid[s.sid] = s; });
    gradeRows.forEach(function (g) {
      const st = bySid[g.sid];
      if (!st) {
        warnings.push("成绩表中出现名单外的学号：" + g.sid + "（已自动补入台账）");
        const fresh = { sid: g.sid, name: g.sid, assignments: {} };
        classbook.students.push(fresh);
        bySid[g.sid] = fresh;
      }
      bySid[g.sid].assignments[slug] = g.record;
    });
    return warnings;
  }

  // ---------- 加密输出 ----------
  async function buildRecords(classbook, keysMap, log) {
    const records = [];
    const missing = [];
    for (let i = 0; i < classbook.students.length; i++) {
      const st = classbook.students[i];
      const code = keysMap[st.sid];
      if (!code) {
        missing.push(st.sid);
        continue;
      }
      const payload = {
        sid: st.sid,
        name: st.name,
        assignments: st.assignments || {}
      };
      const crypt = await CalcCrypto.encryptPayload(payload, code);
      records.push({
        sid: st.sid,
        salt: crypt.salt,
        iv: crypt.iv,
        data: crypt.data
      });
      if (log && i % 10 === 0) log("正在加密 " + (i + 1) + "/" + classbook.students.length);
    }
    return {
      version: 1,
      algorithm: "PBKDF2-HMAC-SHA256(210000)/AES-256-GCM",
      generatedAt: new Date().toISOString(),
      studentCount: records.length,
      records: records,
      missingKeys: missing
    };
  }

  return {
    parseTable: parseTable,
    parseRoster: parseRoster,
    parseKeys: parseKeys,
    makeKeysCsv: makeKeysCsv,
    normalizeStatus: normalizeStatus,
    parseGrades: parseGrades,
    emptyClassbook: emptyClassbook,
    classbookFromRoster: classbookFromRoster,
    mergeGrades: mergeGrades,
    buildRecords: buildRecords
  };
});
