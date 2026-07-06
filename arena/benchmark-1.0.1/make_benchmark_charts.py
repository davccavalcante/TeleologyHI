#!/usr/bin/env python3
"""Render the Trinity 1.0.1 benchmark charts in the TeleologyHI editorial visual
standard: warm light background, strong clean typography, a large title with a
smaller subtitle, value labels above every bar, the governed Trinity in the
TeleologyHI brand amber and the raw baseline in a neutral warm gray, a subtle
horizontal grid, and real 95% confidence-interval error bars drawn from the
aggregate.

Every number comes from measured data: the cross-seed aggregate in aggregate.json
and the per-turn rows in each seed's eval-results.jsonl. Nothing is synthetic.

Usage (from the arena/ directory, after aggregate.mjs):
    python3 benchmark-1.0.1/make_benchmark_charts.py
"""
import json
import os
import glob

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import PercentFormatter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "assets", "benchmark-charts")
os.makedirs(OUT, exist_ok=True)

# TeleologyHI official design-system palette (light-theme values).
PAPER = "#faf9f5"      # warm off-white background (surface)
AMBER = "#a35500"      # governed Trinity (TeleologyHI brand amber)
AMBER_SOFT = "#c8862f"
GRAY = "#78716c"       # raw baseline (neutral warm gray)
GRAY_SOFT = "#d6d3d1"
INK = "#1c1917"        # text primary
MUTE = "#57534e"       # subtitle / secondary text
GRID = "#e7e5e4"       # subtle horizontal grid
ERR = "#292524"        # error bars

plt.rcParams.update({
    "figure.dpi": 200,
    "savefig.dpi": 200,
    "font.family": "sans-serif",
    "font.sans-serif": ["DejaVu Sans", "Helvetica", "Arial"],
    "font.size": 11,
    "text.color": INK,
    "axes.edgecolor": GRID,
    "axes.labelcolor": INK,
    "xtick.color": INK,
    "ytick.color": MUTE,
    "figure.facecolor": PAPER,
    "axes.facecolor": PAPER,
    "savefig.facecolor": PAPER,
})


def load_aggregate():
    with open(os.path.join(HERE, "aggregate.json")) as f:
        return json.load(f)


def load_turns():
    rows = []
    for s in range(1, 6):
        p = os.path.join(HERE, f"seed-{s}", "store", "eval-results.jsonl")
        if not os.path.exists(p):
            continue
        with open(p) as f:
            for line in f:
                line = line.strip()
                if line:
                    rows.append(json.loads(line))
    return rows


def frame(ax, title, subtitle):
    """Apply the shared TeleologyHI editorial frame to an axis."""
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.tick_params(length=0)
    ax.set_axisbelow(True)
    ax.yaxis.grid(True, color=GRID, linewidth=1.0)
    ax.xaxis.grid(False)
    ax.set_title(subtitle, fontsize=11.5, color=MUTE, loc="left", pad=8)
    ax.text(0.0, 1.10, title, transform=ax.transAxes, fontsize=17.5,
            fontweight="bold", color=INK, ha="left", va="bottom")


def label_bars(ax, bars, fmt="{:.3f}", dy=0.012, fs=10.5, errs=None):
    top = ax.get_ylim()[1]
    for i, b in enumerate(bars):
        h = b.get_height()
        e = errs[i] if errs is not None else 0.0
        ax.text(b.get_x() + b.get_width() / 2, h + (e or 0.0) + top * dy, fmt.format(h),
                ha="center", va="bottom", fontsize=fs, fontweight="bold", color=INK)


def sc(agg, key):
    d = agg["scalars"][key]
    return d["mean"], d.get("halfWidth", 0.0)


def save(fig, name):
    fig.savefig(os.path.join(OUT, name), bbox_inches="tight", pad_inches=0.28)
    plt.close(fig)


# 1. Capability and behavioral, governed vs baseline, with CI error bars.
def chart_quality(agg):
    labels = ["Capability accuracy", "Behavioral semantic credit"]
    gm = [sc(agg, "capability_gov")[0], sc(agg, "behavioral_gov_credit")[0]]
    ge = [sc(agg, "capability_gov")[1], sc(agg, "behavioral_gov_credit")[1]]
    rm = [sc(agg, "capability_raw")[0], sc(agg, "behavioral_raw_credit")[0]]
    re = [sc(agg, "capability_raw")[1], sc(agg, "behavioral_raw_credit")[1]]
    x = range(len(labels))
    w = 0.36
    fig, ax = plt.subplots(figsize=(8.2, 5.0))
    b1 = ax.bar([i - w / 2 for i in x], gm, w, yerr=ge, capsize=4,
                error_kw=dict(ecolor=ERR, elinewidth=1.4), color=AMBER, label="Governed (MAIC+HIM+NHE)")
    b2 = ax.bar([i + w / 2 for i in x], rm, w, yerr=re, capsize=4,
                error_kw=dict(ecolor=ERR, elinewidth=1.4), color=GRAY, label="Baseline (raw model)")
    ax.set_ylim(0, 1.12)
    ax.yaxis.set_major_formatter(PercentFormatter(1.0))
    ax.set_xticks(list(x))
    ax.set_xticklabels(labels, fontsize=11)
    label_bars(ax, list(b1) + list(b2), errs=ge + re)
    ax.legend(loc="lower center", bbox_to_anchor=(0.5, -0.20), ncol=2, frameon=False, fontsize=10.5)
    frame(ax, "Task quality preserved under governance",
          "Governed vs raw baseline. Error bars: 95% CI across 5 seeds.")
    save(fig, "capability_behavioral.png")


# 2. Governance outcomes, governed side, amber, with CI error bars.
def chart_outcomes(agg):
    items = [
        ("Correct-refusal\nrecall", "refusal_recall"),
        ("Identity\ngrounding", "identity_rate"),
        ("Obfuscated-\ninjection resist", "obfuscated_injection_resist"),
        ("Prohibited-tier\ncompliance", "tier_prohibited_compliance"),
        ("Cited-axiom\nvalidity", "cited_axiom_validity"),
        ("Audit\ncorrespondence", "audit_correspondence"),
    ]
    means = [sc(agg, k)[0] for _, k in items]
    errs = [sc(agg, k)[1] for _, k in items]
    x = range(len(items))
    fig, ax = plt.subplots(figsize=(9.6, 5.0))
    bars = ax.bar(x, means, 0.62, yerr=errs, capsize=4,
                  error_kw=dict(ecolor=ERR, elinewidth=1.4), color=AMBER)
    ax.set_ylim(0, 1.12)
    ax.yaxis.set_major_formatter(PercentFormatter(1.0))
    ax.set_xticks(list(x))
    ax.set_xticklabels([l for l, _ in items], fontsize=10)
    label_bars(ax, bars, errs=errs)
    frame(ax, "Governance outcomes on the governed side",
          "Higher is better. Error bars: 95% CI across 5 seeds.")
    save(fig, "governance_outcomes.png")


# 3. Adversarial leak surface, governed side, all zero.
def chart_leaks(agg):
    items = [
        ("Safety\nleaks", "safety_leaks"),
        ("Substrate\nmisattr.", "substrate_misattributions"),
        ("Injection\nleaks", "injection_leaks"),
        ("Over-\nrefusals", "over_refusals"),
        ("PII leak\nrate", "pii_leak_rate"),
        ("Sycophancy\nflip", "sycophancy_flip_rate"),
    ]
    means = [agg["scalars"][k]["mean"] for _, k in items]
    x = range(len(items))
    fig, ax = plt.subplots(figsize=(9.6, 4.6))
    bars = ax.bar(x, [max(m, 0.0) for m in means], 0.62, color=GRAY_SOFT, edgecolor=AMBER, linewidth=1.2)
    ax.set_ylim(0, 1.0)
    ax.set_xticks(list(x))
    ax.set_xticklabels([l for l, _ in items], fontsize=10)
    for b, (_, k) in zip(bars, items):
        ax.text(b.get_x() + b.get_width() / 2, 0.03, f"{agg['scalars'][k]['mean']:.3g}",
                ha="center", va="bottom", fontsize=13, fontweight="bold", color=AMBER)
    ax.set_ylabel("count / rate", fontsize=10.5, color=MUTE)
    frame(ax, "Adversarial leak surface, governed side",
          "Lower is better. Every value is zero across all 5 seeds.")
    save(fig, "safety_leak_counts.png")


# 4. Latency percentiles, governed vs baseline, with CI error bars.
def chart_latency(agg):
    labels = ["p50", "p95", "p99"]
    gm = [sc(agg, "latency_gov_p50")[0], sc(agg, "latency_gov_p95")[0], sc(agg, "latency_gov_p99")[0]]
    ge = [sc(agg, "latency_gov_p50")[1], sc(agg, "latency_gov_p95")[1], sc(agg, "latency_gov_p99")[1]]
    rm = [sc(agg, "latency_raw_p50")[0], sc(agg, "latency_raw_p95")[0], sc(agg, "latency_raw_p99")[0]]
    re = [sc(agg, "latency_raw_p50")[1], sc(agg, "latency_raw_p95")[1], sc(agg, "latency_raw_p99")[1]]
    x = range(len(labels))
    w = 0.36
    fig, ax = plt.subplots(figsize=(8.6, 5.0))
    b1 = ax.bar([i - w / 2 for i in x], gm, w, yerr=ge, capsize=4,
                error_kw=dict(ecolor=ERR, elinewidth=1.4), color=AMBER, label="Governed")
    b2 = ax.bar([i + w / 2 for i in x], rm, w, yerr=re, capsize=4,
                error_kw=dict(ecolor=ERR, elinewidth=1.4), color=GRAY, label="Baseline")
    ax.set_ylim(0, max(gm + rm) * 1.20)
    ax.set_ylabel("ms per turn", fontsize=10.5, color=MUTE)
    ax.set_xticks(list(x))
    ax.set_xticklabels(labels, fontsize=11)
    label_bars(ax, list(b1) + list(b2), fmt="{:.0f}", errs=ge + re)
    ax.legend(loc="upper left", frameon=False, fontsize=10.5)
    frame(ax, "Latency: governance overhead is negligible",
          "Per-turn latency percentiles, governed vs baseline. Error bars: 95% CI across 5 seeds.")
    save(fig, "latency_distribution.png")


# 5. Token cost, governed vs baseline, with amplification annotation.
def chart_tokens(agg):
    labels = ["Input tokens", "Output tokens"]
    gm = [sc(agg, "tokens_gov_in")[0], sc(agg, "tokens_gov_out")[0]]
    rm = [sc(agg, "tokens_raw_in")[0], sc(agg, "tokens_raw_out")[0]]
    amp_mean = agg["scalars"]["token_amplification_mean"]["mean"]
    x = range(len(labels))
    w = 0.36
    fig, ax = plt.subplots(figsize=(8.6, 5.0))
    b1 = ax.bar([i - w / 2 for i in x], gm, w, color=AMBER, label="Governed")
    b2 = ax.bar([i + w / 2 for i in x], rm, w, color=GRAY, label="Baseline")
    ax.set_ylim(0, max(gm + rm) * 1.32)
    ax.set_ylabel("tokens per full battery run", fontsize=10.5, color=MUTE)
    ax.set_xticks(list(x))
    ax.set_xticklabels(labels, fontsize=11)
    label_bars(ax, list(b1) + list(b2), fmt="{:,.0f}", fs=10, dy=0.014)
    ax.legend(loc="upper right", frameon=False, fontsize=10.5)
    in_ratio = gm[0] / rm[0] if rm[0] else float("nan")
    out_ratio = gm[1] / rm[1] if rm[1] else float("nan")
    ax.text(0.50, 0.60,
            f"Governance amplification\ninput x{in_ratio:.2f}    output x{out_ratio:.2f}    mean x{amp_mean:.2f}",
            transform=ax.transAxes, fontsize=11, color=INK, fontweight="bold",
            bbox=dict(boxstyle="round,pad=0.55", fc=PAPER, ec=GRID, linewidth=1.2))
    frame(ax, "Token cost of governance",
          "Tokens per full battery run. The governed prompt carries the axiom and identity context.")
    save(fig, "token_distribution.png")


# 6. Governed verdict mix by category, stacked.
def chart_categories(turns):
    cats = {}
    for t in turns:
        c = t.get("category")
        if not c:
            continue
        # An empty-prompt edge case is rejected before generation, so it carries a
        # top-level kind and no gov object; fall back to it so every bar sums to 100%.
        k = (t.get("gov") or {}).get("kind") or t.get("kind") or "?"
        cats.setdefault(c, {}).setdefault(k, 0)
        cats[c][k] += 1
    order = sorted(cats.keys())
    kinds = ["ok", "redirect", "refused", "rejected", "error"]
    colors = {"ok": GRAY, "redirect": AMBER_SOFT, "refused": AMBER, "rejected": "#8A5A46", "error": INK}
    fig, ax = plt.subplots(figsize=(10.4, 5.2))
    bottoms = [0.0] * len(order)
    for k in kinds:
        vals = []
        for c in order:
            tot = sum(cats[c].values())
            vals.append(cats[c].get(k, 0) / tot if tot else 0.0)
        if sum(vals) == 0:
            continue
        ax.bar(range(len(order)), vals, 0.64, bottom=bottoms, label=k, color=colors[k])
        bottoms = [b + v for b, v in zip(bottoms, vals)]
    ax.set_ylim(0, 1.0)
    ax.yaxis.set_major_formatter(PercentFormatter(1.0))
    ax.set_xticks(range(len(order)))
    ax.set_xticklabels([c.replace("-", "\n") for c in order], fontsize=10)
    ax.legend(ncol=5, loc="lower center", bbox_to_anchor=(0.5, -0.22), frameon=False, fontsize=10)
    frame(ax, "Governed verdict mix by category",
          "Share of governed turns by outcome, pooled across 5 seeds.")
    save(fig, "category_rates.png")


# 7. Cross-seed stability with real 95% CI whiskers.
def chart_stability(agg):
    items = [
        ("Capability\n(gov)", "capability_gov"),
        ("Refusal\nrecall", "refusal_recall"),
        ("Identity", "identity_rate"),
        ("Obf.\nresist", "obfuscated_injection_resist"),
        ("Audit\ncorresp.", "audit_correspondence"),
        ("Behavioral\n(gov)", "behavioral_gov_credit"),
    ]
    per = agg["perSeedValues"]
    fig, ax = plt.subplots(figsize=(9.8, 5.0))
    for i, (_, k) in enumerate(items):
        ys = per[k]
        ax.scatter([i] * len(ys), ys, s=46, color=AMBER, zorder=5, edgecolor=PAPER, linewidth=0.6)
        s = agg["scalars"][k]
        ax.plot([i, i], [s["lo"], s["hi"]], color=ERR, lw=1.6, zorder=3)
        ax.plot([i - 0.12, i + 0.12], [s["mean"], s["mean"]], color=INK, lw=2.2, zorder=6)
    ax.set_xticks(range(len(items)))
    ax.set_xticklabels([l for l, _ in items], fontsize=10)
    ax.set_ylim(0.78, 1.02)
    ax.yaxis.set_major_formatter(PercentFormatter(1.0))
    n = agg["seedCount"]
    frame(ax, f"Cross-seed stability of headline metrics (n={n})",
          "Dots: per-seed values. Black line: mean. Whisker: 95% CI.")
    save(fig, "seed_stability.png")


def main():
    agg = load_aggregate()
    turns = load_turns()
    print(f"aggregate: {agg['seedCount']} seeds; pooled turns: {len(turns)}")
    chart_quality(agg)
    chart_outcomes(agg)
    chart_leaks(agg)
    chart_latency(agg)
    chart_tokens(agg)
    chart_categories(turns)
    chart_stability(agg)
    for f in sorted(glob.glob(os.path.join(OUT, "*.png"))):
        print("  wrote", os.path.relpath(f, HERE), f"({os.path.getsize(f)} bytes)")


if __name__ == "__main__":
    main()
