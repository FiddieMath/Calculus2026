#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
查询码邮件机器人

学生在课堂上拿到查询码后，如果有同学忘记，可以用学校邮箱发邮件自助查询：
  - 只处理发件地址形如 <学号>@smail.nju.edu.cn 的邮件
  - 用发件地址里的学号到私有查询码表里查找该生的查询码
  - 只回复给这个发件地址，不回群发、不转发、不附带他人信息
  - 处理完的邮件标记为已读（IMAP \\Seen），下次不会重复回复

查询码表只应通过 GitHub Actions Secret（QUERY_KEYS_CSV 或 QUERY_KEYS_B64）提供，
绝不能提交到公开仓库。所有日志都会隐藏学号与查询码。

本地自检（不需要邮箱、不会联网）：
  python scripts/mail_query_bot.py --self-test

本地模拟某个学生查询（不联网、不发送）：
  python scripts/mail_query_bot.py --keys-file "E:\\微积分\\2026秋\\keys.csv" \
      --simulate-from 221900153@smail.nju.edu.cn
"""

import argparse
import base64
import csv
import imaplib
import io
import os
import re
import smtplib
import ssl
import sys
from datetime import datetime, timedelta, timezone
from email import message_from_bytes, policy
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid, parseaddr


def env(name, default=""):
    value = os.environ.get(name, "")
    return value.strip() if value.strip() else default


def env_int(name, default):
    raw = env(name, "")
    try:
        return int(raw) if raw else default
    except ValueError:
        return default


def load_keys_text(args):
    if args.keys_file:
        with open(args.keys_file, "r", encoding="utf-8-sig") as f:
            return f.read()
    raw_b64 = env("QUERY_KEYS_B64", "")
    if raw_b64:
        return base64.b64decode(raw_b64).decode("utf-8-sig")
    raw_csv = os.environ.get("QUERY_KEYS_CSV", "")
    if raw_csv.strip():
        return raw_csv
    raise SystemExit(
        "缺少查询码表：请设置 GitHub Secret QUERY_KEYS_B64（推荐）或 QUERY_KEYS_CSV，"
        "本地测试时可用 --keys-file。"
    )


def parse_keys(text):
    """解析 学号,姓名,查询码 表格，返回 {学号: (姓名, 查询码)}。"""
    reader = csv.reader(io.StringIO(text.lstrip("\ufeff")))
    keys = {}
    for row in reader:
        if len(row) < 3:
            continue
        sid = row[0].strip()
        name = row[1].strip()
        code = row[2].strip()
        if not sid or not code or sid == "学号":
            continue
        keys[sid] = (name, code)
    return keys


def masked_sid(sid):
    if len(sid) <= 4:
        return "*" * len(sid)
    return sid[:2] + "*" * (len(sid) - 4) + sid[-2:]


def shanghai_today():
    try:
        from zoneinfo import ZoneInfo

        return datetime.now(ZoneInfo("Asia/Shanghai")).date()
    except Exception:
        return (datetime.now(timezone.utc) + timedelta(hours=8)).date()


def mask_addr(addr):
    local, _, domain = (addr or "").partition("@")
    if local.isdigit():
        local = masked_sid(local)
    elif local:
        local = local[0] + "***"
    else:
        local = "***"
    return local + ("@" + domain if domain else "")


def build_sid_regex(domain):
    return re.compile(r"^(?P<sid>\d{6,12})@" + re.escape(domain) + r"$", re.IGNORECASE)


def sender_address(msg):
    """优先使用邮件服务器记录的 Return-Path，其次 From；忽略 Reply-To 防重定向。"""
    for header in ("Return-Path", "From"):
        raw = msg.get(header)
        if not raw:
            continue
        addr = parseaddr(raw)[1].strip().lower()
        if addr:
            return addr
    return ""


def direct_recipients(msg):
    addrs = set()
    headers = ("To", "Cc", "Delivered-To", "X-Original-To", "Envelope-To")
    for header in headers:
        raw = msg.get_all(header) or []
        for item in raw:
            for piece in str(item).split(","):
                addr = parseaddr(piece)[1].strip().lower()
                if addr:
                    addrs.add(addr)
    return addrs


def is_auto_or_reply(msg):
    auto = (msg.get("Auto-Submitted") or "").strip().lower()
    if auto and auto != "no":
        return True
    precedence = (msg.get("Precedence") or "").strip().lower()
    if precedence in ("bulk", "list", "junk", "auto_reply"):
        return True
    if msg.get("X-Autoreply") or msg.get("X-Auto-Response-Suppress"):
        return True
    subject = (msg.get("Subject") or "").strip().lower()
    if subject.startswith(("re:", "re：", "回复：", "答复：", "自动回复")):
        return True
    return False


def subject_allowed(subject, keyword):
    """主题校验：keyword 为空或 "-" 时不限制，否则主题必须包含该关键词。"""
    if not keyword or keyword == "-":
        return True
    return keyword in (subject or "")


def build_reply(mail_user, to_addr, name, code, site_url, course_name):
    msg = EmailMessage()
    msg["From"] = formataddr(("作业查分台（自动回复）", mail_user))
    msg["To"] = to_addr
    msg["Subject"] = "你的%s作业查询码" % course_name
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=mail_user.split("@")[-1])
    msg["Auto-Submitted"] = "auto-replied"
    msg.set_content(
        "{name}同学，你好：\n\n"
        "你的{course}作业查询码是：{code}\n\n"
        "查询入口：{url}\n"
        "使用“学号 + 查询码”登录，即可查看各次作业的完成情况与参考答案。\n\n"
        "这是自动回复邮件。如查询码遗失、需要修改，或查询遇到问题，请联系老师。\n"
        "请勿把查询码转给他人。\n".format(
            name=name or "同学",
            course=course_name,
            code=code,
            url=site_url,
        )
    )
    return msg


def smtp_connect(host, port, security, user, auth_code):
    context = ssl.create_default_context()
    if security == "ssl":
        client = smtplib.SMTP_SSL(host, port, timeout=30, context=context)
    else:
        client = smtplib.SMTP(host, port, timeout=30)
        client.ehlo()
        if security == "starttls":
            client.starttls(context=context)
            client.ehlo()
    client.login(user, auth_code)
    return client


def run_bot(args):
    cfg = {
        "mail_user": env("MAIL_USER"),
        "auth_code": env("MAIL_AUTH_CODE"),
        "imap_host": env("IMAP_HOST", "imap.exmail.qq.com"),
        "imap_port": env_int("IMAP_PORT", 993),
        "smtp_host": env("SMTP_HOST", "smtp.exmail.qq.com"),
        "smtp_port": env_int("SMTP_PORT", 465),
        "smtp_security": env("SMTP_SECURITY", "ssl").lower(),
        "allowed_domain": env("MAIL_ALLOWED_DOMAIN", "smail.nju.edu.cn").lower(),
        "site_url": env("MAIL_SITE_URL", "https://fiddiemath.github.io/Calculus2026/"),
        "course_name": env("MAIL_COURSE_NAME", "微积分I"),
        "subject_keyword": env("MAIL_SUBJECT_KEYWORD", "查询码"),
        "end_date": env("MAIL_BOT_END_DATE", ""),
        "max_per_run": args.max_per_run or env_int("MAIL_BOT_MAX_PER_RUN", 200),
        "dry_run": args.dry_run or env("MAIL_BOT_DRY_RUN", "").lower() in ("1", "true", "yes"),
    }
    if cfg["end_date"] and shanghai_today().isoformat() > cfg["end_date"]:
        print("已过邮件机器人截止日期 %s，本次不做任何操作。" % cfg["end_date"])
        return 0
    if not cfg["mail_user"] or not cfg["auth_code"]:
        raise SystemExit("缺少 MAIL_USER 或 MAIL_AUTH_CODE（请配置 GitHub Secrets）。")

    keys = parse_keys(load_keys_text(args))
    if not keys:
        raise SystemExit("查询码表为空，请检查 QUERY_KEYS_B64 / QUERY_KEYS_CSV / --keys-file。")

    sid_re = build_sid_regex(cfg["allowed_domain"])
    target = cfg["mail_user"].lower()
    scanned = replied = skipped = failed = 0

    context = ssl.create_default_context()
    imap = imaplib.IMAP4_SSL(cfg["imap_host"], cfg["imap_port"], ssl_context=context)
    imap.login(cfg["mail_user"], cfg["auth_code"])
    imap.select("INBOX")

    smtp = None
    if not cfg["dry_run"]:
        smtp = smtp_connect(
            cfg["smtp_host"], cfg["smtp_port"], cfg["smtp_security"],
            cfg["mail_user"], cfg["auth_code"],
        )

    try:
        try:
            # 只检查来自学生邮箱域名的未读邮件，避免触碰其它私人邮件
            status, data = imap.search(None, "UNSEEN", "FROM", cfg["allowed_domain"])
        except imaplib.IMAP4.error:
            print("提示：邮箱服务器不支持按域名筛选，本次检查所有未读邮件（不会标记未回复邮件为已读）。")
            status, data = imap.search(None, "UNSEEN")
        if status != "OK":
            raise SystemExit("IMAP 搜索失败：%s" % status)
        numbers = (data[0] or b"").split()
        print("待检查的未读邮件数：%d" % len(numbers))
        seen_senders_this_run = set()

        for num in numbers[: cfg["max_per_run"]]:
            scanned += 1
            sending = False
            replied_this = False
            duplicate = False
            try:
                # 只取邮件头，不下载正文，也不改变“已读”状态
                typ, msg_data = imap.fetch(num, "(BODY.PEEK[HEADER])")
                if typ != "OK" or not msg_data or not isinstance(msg_data[0], tuple):
                    skipped += 1
                    print("跳过：邮件头读取失败")
                    continue
                msg = message_from_bytes(msg_data[0][1], policy=policy.default)
                sender = sender_address(msg)
                match = sid_re.match(sender)

                if sender == target:
                    skipped += 1
                    print("跳过：发件人就是查询邮箱本身（%s）" % mask_addr(sender))
                    continue
                if not match:
                    skipped += 1
                    print("跳过：发件地址不是“学号@%s”格式（%s）" % (cfg["allowed_domain"], mask_addr(sender)))
                    continue
                if not (direct_recipients(msg) & {target}):
                    skipped += 1
                    print("跳过：这封邮件不是直接发给查询邮箱的（可能用了别名、转发或密送）")
                    continue
                if is_auto_or_reply(msg):
                    skipped += 1
                    print("跳过：这封邮件看起来是自动回复或 Re: 回复邮件")
                    continue
                subject = str(msg.get("Subject") or "")
                if not subject_allowed(subject, cfg["subject_keyword"]):
                    skipped += 1
                    print(
                        "跳过：邮件主题未包含“%s”（主题内容已隐藏）"
                        % cfg["subject_keyword"]
                    )
                    continue

                sid = match.group("sid")
                entry = keys.get(sid)
                if not entry:
                    skipped += 1
                    print("跳过：学号 %s 不在本班查询码表中" % masked_sid(sid))
                    continue
                if sid in seen_senders_this_run:
                    duplicate = True
                    skipped += 1
                    print("跳过：同一学生本次重复来信（%s）" % masked_sid(sid))
                else:
                    seen_senders_this_run.add(sid)
                    name, code = entry
                    if cfg["dry_run"]:
                        print("DRY-RUN 将回复：%s（内容已隐藏）" % masked_sid(sid))
                        replied += 1
                    else:
                        reply = build_reply(
                            cfg["mail_user"], sender, name, code,
                            cfg["site_url"], cfg["course_name"],
                        )
                        sending = True
                        smtp.send_message(reply)
                        sending = False
                        print("已回复：%s" % masked_sid(sid))
                        replied += 1
                        replied_this = True
            except Exception as exc:  # 单封失败不影响其它邮件
                failed += 1
                print("处理失败：%s: %s" % (type(exc).__name__, exc))
                # 发信失败或解析出错都保持未读：发信下次重试，非查询邮件不误标已读
            finally:
                # 只对“已成功回复”或“同一学生本次重复来信”的邮件标记已读；
                # 其它未匹配邮件一律保持未读，不影响老师正常收信。
                if (replied_this or duplicate) and not cfg["dry_run"]:
                    try:
                        imap.store(num, "+FLAGS", "\\Seen")
                    except Exception as exc:
                        print("标记已读失败：%s" % exc)
    finally:
        if smtp is not None:
            try:
                smtp.quit()
            except Exception:
                pass
        try:
            imap.logout()
        except Exception:
            pass

    print(
        "本次完成：检查 %d 封，回复 %d 封，跳过 %d 封，失败 %d 封（%s）"
        % (scanned, replied, skipped, failed,
           "演练模式，未发送也未标记已读" if cfg["dry_run"] else "仅回复成功的邮件被标记已读")
    )
    return 1 if failed else 0


def self_test():
    sample = "学号,姓名,查询码\n221900153,测试同学,123456\n"
    keys = parse_keys(sample)
    assert keys["221900153"] == ("测试同学", "123456"), "keys parse failed"
    rx = build_sid_regex("smail.nju.edu.cn")
    assert rx.match("221900153@smail.nju.edu.cn"), "valid sid rejected"
    assert not rx.match("221900153@nju.edu.cn"), "wrong domain accepted"
    assert not rx.match("abc@smail.nju.edu.cn"), "bad sid accepted"
    msg = build_reply(
        "teacher@smail.nju.edu.cn", "221900153@smail.nju.edu.cn",
        "测试同学", "123456", "https://example.invalid/", "微积分I",
    )
    body = msg.get_content()
    assert "123456" in body and "查询入口" in body, "reply body incomplete"
    assert msg["To"] == "221900153@smail.nju.edu.cn", "reply target wrong"
    assert subject_allowed("作业查询码", "查询码"), "keyword subject rejected"
    assert not subject_allowed("你好", "查询码"), "subject without keyword accepted"
    assert subject_allowed("随便什么主题", "-"), "disabled keyword blocked"
    print("self-test OK")
    return 0


def simulate(args):
    keys = parse_keys(load_keys_text(args))
    domain = env("MAIL_ALLOWED_DOMAIN", "smail.nju.edu.cn").lower()
    rx = build_sid_regex(domain)
    sender = (args.simulate_from or "").strip().lower()
    match = rx.match(sender)
    if not match:
        print("模拟结果：发件地址不符合 <学号>@%s 规则，将跳过。" % domain)
        return 1
    entry = keys.get(match.group("sid"))
    if not entry:
        print("模拟结果：名单中没有该学号，将跳过。")
        return 1
    name, code = entry
    print("模拟结果：匹配成功，将回复 %s。" % masked_sid(match.group("sid")))
    if args.show_code:
        print("（本地演练输出，请勿外传）姓名：%s；查询码：%s" % (name, code))
    else:
        print("查询码已隐藏；如需本地核对，可加 --show-code。")
    return 0


def main():
    ap = argparse.ArgumentParser(description="查询码邮件机器人")
    ap.add_argument("--keys-file", help="本地查询码表（学号,姓名,查询码）")
    ap.add_argument("--self-test", action="store_true", help="离线自检")
    ap.add_argument("--simulate-from", help="模拟某个学生邮箱，验证匹配与回信模板")
    ap.add_argument("--show-code", action="store_true", help="模拟时显示真实查询码")
    ap.add_argument("--dry-run", action="store_true", help="只检查邮件，不发送、不标记已读")
    ap.add_argument("--max-per-run", type=int, default=0, help="单次最多处理多少封未读邮件")
    args = ap.parse_args()

    if args.self_test:
        return self_test()
    if args.simulate_from:
        return simulate(args)
    return run_bot(args)


if __name__ == "__main__":
    sys.exit(main())
