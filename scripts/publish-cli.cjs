#!/usr/bin/env node
/* 命令行发布工具（供自动批改流程使用）：
 *   node scripts/publish-cli.cjs \
 *       --classbook classbook.json \
 *       --keys 查询码.csv \
 *       [--grades 成绩.csv --slug hw04] \
 *       --out data/records.json
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { webcrypto } = require("node:crypto");
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const ROOT = path.resolve(__dirname, "..");
const core = require(path.join(ROOT, "assets", "js", "crypto-core.js"));
const logic = require(path.join(ROOT, "assets", "js", "publish-logic.js"));
globalThis.CalcCrypto = core;
globalThis.CalcPublish = logic;

function readArg(name) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

async function main() {
  const classbookPath = readArg("classbook");
  const keysPath = readArg("keys");
  const gradesPath = readArg("grades");
  const slug = readArg("slug");
  const outPath = readArg("out") || path.join(ROOT, "data", "records.json");

  if (!classbookPath || !keysPath) {
    console.error("用法：--classbook <json> --keys <csv> [--grades <csv> --slug <slug>] --out <records.json>");
    process.exit(1);
  }

  const classbook = JSON.parse(fs.readFileSync(classbookPath, "utf8"));
  const keys = logic.parseKeys(fs.readFileSync(keysPath, "utf8"));

  if (gradesPath) {
    if (!slug) {
      console.error("提供了 --grades 时必须同时提供 --slug");
      process.exit(1);
    }
    const gradeRows = logic.parseGrades(fs.readFileSync(gradesPath, "utf8"));
    const warnings = logic.mergeGrades(classbook, gradeRows, slug);
    if (warnings.length) console.warn("提醒：\n" + warnings.join("\n"));
    fs.writeFileSync(classbookPath, JSON.stringify(classbook, null, 2), "utf8");
    console.log("已合并 " + gradeRows.length + " 条成绩到台账：" + classbookPath);
  }

  const result = await logic.buildRecords(classbook, keys.map);
  if (result.missingKeys.length) {
    console.error("缺少查询码的学生：" + result.missingKeys.join(", "));
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
  console.log(
    "已生成加密 records：" + outPath +
    "（" + result.studentCount + " 名学生，算法 " + result.algorithm + "）"
  );
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
