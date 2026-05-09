# -*- coding: utf-8 -*-
"""
统一情报同步入口：Saatva / Sleep & Beyond / FluffCo 批量审计与价格补完。

用法：
  cd src/scripts && python batch_scanner.py                  # 全部品牌（增量：缺字段才跑）
  python batch_scanner.py --force                            # 全部强制全量重审
  python batch_scanner.py --brand Saatva                     # 单一品牌
  python batch_scanner.py --brand fluffco --brand saatva    # 多个品牌
  python batch_scanner.py --full-sync                       # 等价 --force（命名便于 cron）

官网轻量同步（不调 LLM，适合高频拉价）：
  python batch_scanner.py --site-only
  python batch_scanner.py --site-only -b Saatva --limit 3

试跑（不写库、不联网）：
  python batch_scanner.py --dry-run -b FluffCo

定时示例：
  0 6 * * * ... python batch_scanner.py                      # 每日增量
  0 * * * * ... python batch_scanner.py --site-only          # 每小时仅官网情报
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
from datetime import datetime, UTC
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

from forensic_engine import (
    ForensicAuditEngine,
    coupon_token_is_plausible,
    finalize_coupon_for_store,
    normalize_coupon_token,
)

_ROOT = Path(__file__).resolve().parents[2]
_ENV = _ROOT / ".env.local"
if not _ENV.is_file():
    _ENV = Path(__file__).resolve().parents[1] / ".env.local"
load_dotenv(dotenv_path=_ENV)


def _bootstrap_supabase_env_from_aliases() -> None:
    """把 Vercel 常用别名写回标准名，便于 forensic_engine 等仍读 SUPABASE_*。"""
    if not (os.getenv("SUPABASE_URL") or "").strip():
        alt = (os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
        if alt:
            os.environ["SUPABASE_URL"] = alt
    if not (os.getenv("SUPABASE_KEY") or "").strip():
        alt = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
        if alt:
            os.environ["SUPABASE_KEY"] = alt


_bootstrap_supabase_env_from_aliases()


def _resolve_supabase_credentials() -> tuple[str | None, str | None]:
    """优先标准名；兼容 Next/Vercel 常用名与 service_role。"""
    url = (
        (os.getenv("SUPABASE_URL") or "").strip()
        or (os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
    )
    key = (
        (os.getenv("SUPABASE_KEY") or "").strip()
        or (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    )
    return (url or None, key or None)


def _audit_msrp_unset(row: dict | None) -> bool:
    """audit_products.msrp 未写入或可视为缺失（None / 非正数）。"""
    if not row:
        return True
    m = row.get("msrp")
    if m is None:
        return True
    try:
        return float(m) <= 0
    except (TypeError, ValueError):
        return True


def get_clean_slug(brand: str, model: str) -> str:
    """与 ForensicAuditEngine.slug 一致。"""

    def slugify(text: str) -> str:
        text = text.lower().replace("&", "and")
        text = re.sub(r"[^a-z0-9]+", "-", text)
        return text.strip("-")

    return slugify(f"{brand}-{model}")


# --- 任务矩阵 -----------------------------------------------------------------

SAATVA_TARGETS: list[dict[str, str]] = [
    {"model": "Classic", "url": "https://www.saatva.com/mattresses/saatva-classic"},
    {"model": "Rx", "url": "https://www.saatva.com/mattresses/saatva-rx"},
    {"model": "Loom & Leaf", "url": "https://www.saatva.com/mattresses/loom-and-leaf"},
    {"model": "Latex Hybrid", "url": "https://www.saatva.com/mattresses/saatva-latex-hybrid"},
    {"model": "Solaire", "url": "https://www.saatva.com/mattresses/solaire"},
    {"model": "Zenhaven", "url": "https://www.saatva.com/mattresses/zenhaven"},
    {"model": "HD", "url": "https://www.saatva.com/mattresses/saatva-hd"},
    {"model": "Memory Foam Hybrid", "url": "https://www.saatva.com/mattresses/memory-foam-hybrid"},
    {"model": "Youth", "url": "https://www.saatva.com/mattresses/saatva-youth"},
    {"model": "Crib", "url": "https://www.saatva.com/mattresses/crib-mattress"},
]

SB_TARGETS: list[dict[str, str]] = [
    {"model": "MyTravel Pillow", "url": "https://sleepandbeyond.com/product/mytravel-pillow/"},
    {"model": "MyWoolly Pillow", "url": "https://sleepandbeyond.com/product/mywoolly-pillow/"},
    {"model": "MyMerino Pillow", "url": "https://sleepandbeyond.com/product/mymerino-pillow/"},
    {"model": "MyMerino Comforter", "url": "https://sleepandbeyond.com/product/mymerino-comforter/"},
    {"model": "MyComforter", "url": "https://sleepandbeyond.com/product/mycomforter/"},
    {"model": "MyTopper", "url": "https://sleepandbeyond.com/product/mytopper/"},
    {"model": "MyMerino Topper", "url": "https://sleepandbeyond.com/product/mymerino-topper/"},
    {"model": "MyProtector", "url": "https://sleepandbeyond.com/product/myprotector/"},
    {"model": "mySheet Set", "url": "https://sleepandbeyond.com/product/mysheet-set/"},
    {"model": "myPad", "url": "https://sleepandbeyond.com/product/mypad/"},
]

# 官网主域已迁至 https://home.fluff.co/（React PDP：.pdp-price / 划线兄弟节点）
FLUFFCO_TARGETS: list[dict[str, str]] = [
    {
        "model": "Down Feather Pillow",
        "url": "https://home.fluff.co/products/down-feather-pillow?variant=35113578889377",
    },
    {
        "model": "Down Alternative Pillow",
        "url": "https://home.fluff.co/products/down-alternative-pillow?variant=35113580527777",
    },
    {
        "model": "Down Blended Comforter",
        "url": "https://home.fluff.co/products/down-blended-comforter?variant=39752258519201",
    },
    {
        "model": "Down Alternative Comforter",
        "url": "https://home.fluff.co/products/down-alternative-comforter?variant=40396635078817",
    },
    {
        "model": "Hotel Lounge Robe",
        "url": "https://home.fluff.co/products/hotel-lounge-robe?variant=39752183447713",
    },
    {
        "model": "Hotel Waffle Robe",
        "url": "https://home.fluff.co/products/hotel-waffle-robe?variant=49119638749478",
    },
    {
        "model": "Hotel Towel",
        "url": "https://home.fluff.co/products/hotel-towel?variant=40808608858273",
    },
    {
        "model": "Silk Pillowcase",
        "url": "https://home.fluff.co/products/silk-pillowcase?variant=35113585016865",
    },
    {
        "model": "Pillow & Comforter Kit",
        "url": "https://home.fluff.co/products/pillow-comforter-kit?variant=35113586032705",
    },
]

BRAND_REGISTRY: list[dict[str, Any]] = [
    {"name": "Saatva", "targets": SAATVA_TARGETS, "cooldown_sec": 25},
    {"name": "Sleep & Beyond", "targets": SB_TARGETS, "cooldown_sec": 25},
    {"name": "FluffCo", "targets": FLUFFCO_TARGETS, "cooldown_sec": 20},
]

BRAND_ALIASES: dict[str, str] = {
    "saatva": "Saatva",
    "sleep-and-beyond": "Sleep & Beyond",
    "sleepandbeyond": "Sleep & Beyond",
    "sleep_beyond": "Sleep & Beyond",
    "sb": "Sleep & Beyond",
    "fluffco": "FluffCo",
    "fluff": "FluffCo",
}


def resolve_brand_names(tokens: list[str] | None) -> list[str]:
    """将 CLI 输入解析为 BRAND_REGISTRY 中的 canonical name。"""
    if not tokens:
        return [b["name"] for b in BRAND_REGISTRY]
    out: list[str] = []
    canonical = {b["name"] for b in BRAND_REGISTRY}
    for raw in tokens:
        t = raw.strip()
        if not t:
            continue
        key = t.lower().replace(" ", "-").replace("&", "and")
        key = re.sub(r"[^a-z0-9-]+", "-", key).strip("-")
        name = BRAND_ALIASES.get(key)
        if not name and t in canonical:
            name = t
        if not name:
            # 宽松匹配：忽略大小写
            low = t.lower()
            for c in canonical:
                if c.lower() == low:
                    name = c
                    break
        if not name:
            raise ValueError(f"未知品牌: {raw!r}。可选: {sorted(canonical)}")
        if name not in out:
            out.append(name)
    return out


class IntelBatchScanner:
    """
    全量法医审计（execute_and_sync）与缺失字段时的轻量补完（fetch_site_data）。
    sync_mode=site-only：仅执行官网抓取写库，不调 LLM（适合高频 cron）。
    """

    def __init__(
        self,
        force_update: bool = False,
        *,
        sync_mode: str = "auto",
        limit_per_brand: int | None = None,
        no_cooldown: bool = False,
    ) -> None:
        if sync_mode not in ("auto", "site-only"):
            raise ValueError("sync_mode 必须是 auto 或 site-only")
        self.force_update = force_update
        self.sync_mode = sync_mode
        self.limit_per_brand = limit_per_brand
        self.no_cooldown = no_cooldown
        url, key = _resolve_supabase_credentials()
        if not url or not key:
            print(f"❌ 环境探测失败: 已查找 dotenv 路径 {_ENV.absolute()}（CI 上通常不存在）")
            raise ValueError(
                "SUPABASE_URL 或 SUPABASE_KEY 未设置。"
                "本地请在仓库根目录或 src 下放 .env.local；"
                "GitHub Actions 请在仓库 Settings → Secrets and variables → Actions "
                "中添加 SUPABASE_URL 与 SUPABASE_KEY（建议 service_role key）。"
                "亦可使用 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY。"
            )
        self.supabase: Client = create_client(url, key)

    async def _run_site_intel_patch(
        self,
        engine: ForensicAuditEngine,
        existing_record: dict[str, Any],
        brand: str,
        model: str,
        url: str,
        slug: str,
    ) -> None:
        """仅 Playwright 抓取 + 写 audit_products / product_offers（与法医 LLM 无关）。"""
        print(f"\n[官网情报] 正在抓取: {brand} {model}")
        try:
            new_site_data = await engine.fetch_site_data(url)

            update_payload: dict[str, Any] = {}
            if new_site_data.get("price", 0) > 0:
                update_payload["price"] = new_site_data["price"]
            if new_site_data.get("original_image"):
                update_payload["original_image_url"] = new_site_data["original_image"]
                hosted = await engine.transfer_to_supabase_storage(
                    new_site_data["original_image"]
                )
                if hosted:
                    update_payload["image_url"] = hosted
                elif existing_record.get("image_url"):
                    update_payload["image_url"] = existing_record["image_url"]
                    print(
                        "⚠️ 图片上传 Storage 失败，已保留库内旧 image_url；"
                        "请查看上方「图片下载/转储」报错（常为网络或非图片 Content-Type）。"
                    )
                else:
                    print(
                        "⚠️ 图片上传 Storage 失败且库内无旧 image_url，"
                        "前端可能仍无图；请检查上方转储报错。"
                    )

            if new_site_data.get("msrp"):
                update_payload["msrp"] = new_site_data["msrp"]

            av_label = new_site_data.get("audit_variant")
            if isinstance(av_label, str) and av_label.strip():
                try:
                    ar = (
                        self.supabase.table("audit_products")
                        .select("audit_data")
                        .eq("slug", slug)
                        .limit(1)
                        .execute()
                    )
                    raw_ad = (ar.data or [{}])[0].get("audit_data") if ar.data else {}
                    if isinstance(raw_ad, str):
                        try:
                            ad_obj: dict[str, Any] = json.loads(raw_ad)
                        except json.JSONDecodeError:
                            ad_obj = {}
                    elif isinstance(raw_ad, dict):
                        ad_obj = dict(raw_ad)
                    else:
                        ad_obj = {}
                    ad_obj["audit_variant"] = av_label.strip()[:200]
                    update_payload["audit_data"] = ad_obj
                except Exception as me:
                    print(f"⚠️ 合并 audit_variant 至 audit_data 失败: {me}")

            if update_payload:
                now_iso = datetime.now(UTC).isoformat()
                update_payload["updated_at"] = now_iso
                update_payload["last_audited_at"] = now_iso
                self.supabase.table("audit_products").update(update_payload).eq(
                    "slug", slug
                ).execute()
                print(f"✅ {model} 市场数据已修正。")
            else:
                print(f"⚠️ {model} 未获取到可写入字段。")

            if new_site_data.get("price", 0) > 0:
                try:
                    po: dict[str, Any] = {
                        "product_id": existing_record["id"],
                        "site_name": brand,
                        "price": new_site_data["price"],
                        "offer_url": existing_record.get("official_link") or url,
                        "is_primary": True,
                        "status": "active",
                        "last_checked_at": datetime.now(UTC).isoformat(),
                    }
                    if new_site_data.get("old_price"):
                        po["old_price"] = new_site_data["old_price"]
                    if new_site_data.get("availability"):
                        po["availability"] = str(
                            new_site_data["availability"]
                        ).strip()[:160]
                    cc_raw = new_site_data.get("coupon_code")
                    cc_n = (
                        normalize_coupon_token(cc_raw)
                        if isinstance(cc_raw, str)
                        else None
                    )
                    if cc_n and coupon_token_is_plausible(cc_n):
                        cc_n = await finalize_coupon_for_store(url, cc_n)
                    else:
                        cc_n = None
                    if cc_n:
                        po["coupon_code"] = cc_n[:80]
                    else:
                        po["coupon_code"] = None
                    ptxt = new_site_data.get("promo_text_snippet")
                    if isinstance(ptxt, str) and ptxt.strip():
                        po["promo_text"] = ptxt.strip()[:500]

                    msrp_val = update_payload.get("msrp")
                    if msrp_val is None:
                        msrp_val = existing_record.get("msrp")
                    if msrp_val is None:
                        msrp_val = new_site_data.get("msrp") or new_site_data.get(
                            "old_price"
                        )
                    try:
                        msrp_f = float(msrp_val) if msrp_val is not None else None
                    except (TypeError, ValueError):
                        msrp_f = None
                    pct_raw = new_site_data.get("promo_discount_percent")
                    try:
                        pct_f = float(pct_raw) if pct_raw is not None else None
                    except (TypeError, ValueError):
                        pct_f = None
                    if pct_f is not None and 0 < pct_f < 95:
                        po["promo_discount_percent"] = round(pct_f, 4)
                    else:
                        po["promo_discount_percent"] = None
                    ts = ForensicAuditEngine.compute_total_savings(
                        msrp_f,
                        float(new_site_data["price"]),
                        pct_f,
                    )
                    if ts is not None:
                        po["total_savings"] = round(ts, 2)

                    self.supabase.table("product_offers").upsert(
                        po,
                        on_conflict="product_id, site_name",
                    ).execute()
                    print(f"✅ {model} product_offers 已同步。")
                except Exception as oe:
                    print(f"⚠️ product_offers 同步失败: {oe}")
        except Exception as e:
            print(f"❌ {model} 官网情报失败: {e}")

    async def execute_task(self, brand: str, task: dict[str, str]) -> None:
        model = task["model"]
        url = task["url"]
        slug = get_clean_slug(brand, model)

        existing_record = None
        try:
            res = (
                self.supabase.table("audit_products")
                .select(
                    "id, last_audited_at, price, msrp, original_image_url, image_url, audit_note, official_link"
                )
                .eq("slug", slug)
                .execute()
            )
            if res.data:
                existing_record = res.data[0]
        except Exception as e:
            print(f"⚠️ 数据库读取受阻: {e}")

        if self.sync_mode == "site-only":
            if not existing_record:
                print(
                    f"⏭️ 跳过（库中无 slug）: {model} — 请先跑一次非 --site-only 以建立记录"
                )
                return
            engine = ForensicAuditEngine(brand, model)
            await self._run_site_intel_patch(
                engine, existing_record, brand, model, url, slug
            )
            return

        needs_full_audit = False
        needs_data_patch = False

        if not existing_record or self.force_update:
            needs_full_audit = True
        elif not existing_record.get("audit_note"):
            print(f"🔍 发现残缺审计记录: {model}，准备重新触发全量审计...")
            needs_full_audit = True
        elif (
            not existing_record.get("price")
            or existing_record.get("price") == 0
            or not existing_record.get("original_image_url")
            or not existing_record.get("image_url")
            or _audit_msrp_unset(existing_record)
        ):
            print(f"🩹 发现缺失市场数据或 MSRP: {model}，准备执行数据补完...")
            needs_data_patch = True
        else:
            print(f"⏩ 跳过: {model} 已有完整存证。")
            return

        engine = ForensicAuditEngine(brand, model)

        if needs_full_audit:
            print(f"\n[法医扫描-全量] 正在分析: {brand} {model}")
            try:
                await engine.execute_and_sync(url)
                print(f"✅ {model} 全量同步成功。")
            except Exception as e:
                print(f"❌ {model} 全量任务失败: {e}")

        elif needs_data_patch:
            await self._run_site_intel_patch(
                engine, existing_record, brand, model, url, slug
            )

    async def run_brands(self, brand_names: list[str]) -> None:
        for cfg in BRAND_REGISTRY:
            name = cfg["name"]
            if name not in brand_names:
                continue
            targets: list[dict[str, str]] = list(cfg["targets"])
            if self.limit_per_brand is not None and self.limit_per_brand > 0:
                targets = targets[: self.limit_per_brand]
            cooldown = 0 if self.no_cooldown else int(cfg.get("cooldown_sec", 25))
            mode_note = " [官网-only]" if self.sync_mode == "site-only" else ""
            print(
                f"\n{'=' * 60}\n🚀 品牌: {name}{mode_note} | 本趟任务数: {len(targets)}\n{'=' * 60}"
            )
            for i, task in enumerate(targets):
                print(f"\n进度 [{name}]: [{i + 1}/{len(targets)}]")
                await self.execute_task(name, task)
                if cooldown > 0 and i < len(targets) - 1:
                    print(f"⏳ 冷却 {cooldown}s …")
                    await asyncio.sleep(cooldown)

        print("\n🏁 所选品牌任务已全部结束。")


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Sleep Choice 情报批量同步（法医审计 / 官网情报补完）"
    )
    p.add_argument(
        "--brand",
        "-b",
        action="append",
        metavar="NAME",
        help="只跑指定品牌，可重复。例: -b Saatva -b FluffCo。省略则跑全部。",
    )
    p.add_argument(
        "--force",
        "-f",
        action="store_true",
        help="强制全量重审（忽略库内已有完整记录）。与 --site-only 互斥语义：后者下会忽略此项。",
    )
    p.add_argument(
        "--full-sync",
        action="store_true",
        help="与 --force 相同，便于定时任务语义化。",
    )
    p.add_argument(
        "--site-only",
        action="store_true",
        help="仅抓取官网价格/MSRP/图源/库存并写库，不调用 LLM；库中无 slug 的 SKU 会跳过。",
    )
    p.add_argument(
        "--limit",
        type=int,
        metavar="N",
        default=None,
        help="每个品牌最多处理列表中的前 N 条（试跑、配额或限流）。",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="只打印将运行的任务清单，不连接 Supabase、不发起抓取。",
    )
    p.add_argument(
        "--no-cooldown",
        action="store_true",
        help="去掉品牌任务间隔（本地调试或 CI 加速）。",
    )
    return p


def _print_dry_run_plan(
    brand_names: list[str],
    limit_per_brand: int | None,
    site_only: bool,
    force: bool,
) -> None:
    print("📋 [dry-run] 计划任务（未执行）")
    print(f"    模式: {'官网-only' if site_only else ('强制全量' if force else '增量 auto')}")
    for cfg in BRAND_REGISTRY:
        name = cfg["name"]
        if name not in brand_names:
            continue
        tg: list[dict[str, str]] = list(cfg["targets"])
        if limit_per_brand is not None and limit_per_brand > 0:
            tg = tg[:limit_per_brand]
        print(f"\n  ▶ {name} ({len(tg)} 条)")
        for t in tg:
            print(f"      - {t['model']}")
            print(f"        {t['url']}")


def cli_main(argv: list[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)
    force = bool(args.force or args.full_sync)
    site_only = bool(args.site_only)
    try:
        names = resolve_brand_names(args.brand)
    except ValueError as e:
        print(f"❌ {e}")
        return 2

    if args.dry_run:
        _print_dry_run_plan(names, args.limit, site_only, force)
        return 0

    if site_only and force:
        print("⚠️ --site-only 已启用：将忽略 --force / --full-sync（不会触发 LLM 全量审计）")
        force = False

    limit = args.limit if args.limit is not None and args.limit > 0 else None

    mode_desc = (
        "官网情报-only（无 LLM）"
        if site_only
        else ("强制全量" if force else "增量（缺字段才更新）")
    )
    lim_note = f" | 每品牌上限: {limit}" if limit else ""
    print(f"📋 模式: {mode_desc}{lim_note} | 品牌: {', '.join(names)}")

    try:
        scanner = IntelBatchScanner(
            force_update=force,
            sync_mode="site-only" if site_only else "auto",
            limit_per_brand=limit,
            no_cooldown=bool(args.no_cooldown),
        )
    except ValueError as e:
        print(e)
        return 1
    asyncio.run(scanner.run_brands(names))
    return 0


# 旧脚本仍可：BatchScanner / SBBatchScanner / FluffCoForensicScanner
BatchScanner = IntelBatchScanner


class SBBatchScanner(IntelBatchScanner):
    """兼容 `sb_batch_scanner.py` 时代的类名。"""

    def __init__(
        self,
        brand: str = "Sleep & Beyond",
        force_update: bool = False,
        **kwargs: Any,
    ) -> None:
        super().__init__(force_update=force_update, **kwargs)
        self._legacy_brand = brand

    async def main_loop(self) -> None:
        await self.run_brands([self._legacy_brand])


class FluffCoForensicScanner(IntelBatchScanner):
    """兼容 `fluffco_batch_scanner.py` 时代的类名。"""

    def __init__(self, force_update: bool = False, **kwargs: Any) -> None:
        super().__init__(force_update=force_update, **kwargs)

    async def start(self) -> None:
        await self.run_brands(["FluffCo"])


if __name__ == "__main__":
    raise SystemExit(cli_main(sys.argv[1:]))
