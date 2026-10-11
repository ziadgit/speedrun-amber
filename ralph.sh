#!/usr/bin/env bash
# ralph.sh — the Ralph loop. Reference: https://ghuntley.com/ralph/
#
# WARNING: --dangerously-skip-permissions means the agent runs ANY tool
# (bash, file writes, network) with zero confirmation. Only run in a repo
# you're prepared to let an autonomous agent rewrite. Ctrl-C to stop.
#
# amber (speedhack-agent) is pre-specced (specs/ + fix_plan.md written by hand), so only the build
# phase runs:
#   build phase  →  ./ralph.sh                              # drains fix_plan.md (default PROMPT.md)
#
# Model/effort are per-INVOCATION (every iteration in a run shares them):
#   RALPH_MODEL=fable RALPH_EFFORT=high ./ralph.sh
# RALPH_MODEL unset = CLI default; RALPH_EFFORT unset = auto per fix_plan section.

set -u
set -o pipefail

ITER=0
MAX_ITERATIONS="${MAX_ITERATIONS:-0}"   # 0 = unlimited
SLEEP_BETWEEN="${SLEEP_BETWEEN:-2}"
LOG_DIR="${LOG_DIR:-logs}"
MODEL="${RALPH_MODEL:-}"                # unset = CLI default; e.g. RALPH_MODEL=claude-opus-5-5
EFFORT="${RALPH_EFFORT:-}"              # set = pin for whole run; unset = auto per-section
PROMPT_FILE="${PROMPT_FILE:-PROMPT.md}"
FIX_PLAN="${FIX_PLAN:-fix_plan.md}"     # source of the per-section effort tags

# Auto-effort: when RALPH_EFFORT is unset, derive --effort each iteration from
# the `### Section — 🧠 xhigh | ⚡ high` tag on the topmost unchecked fix_plan
# item (the one Ralph picks ~every loop), lowered EFFORT_REDUCE notches for the
# reduced-effort band (default 2: ⚡ high→low, 🧠 xhigh→medium), then bumped one
# notch when that item is unchanged since the last loop (i.e. the prior loop
# failed to close it) — so a `low` run steps up to `medium` only on a stuck item.
AUTO_EFFORT=0; [ -z "$EFFORT" ] && AUTO_EFFORT=1
# Reduced-effort band: how many notches to lower each section tag before churn
# escalation. 2 → ⚡ high sections run at `low`, 🧠 xhigh at `medium` (opus-5's
# `low` tier preserves most quality on routine work). Set 3 to floor everything
# at `low`; 0 for the raw section tag.
EFFORT_REDUCE="${RALPH_EFFORT_REDUCE:-2}"

cd "$(dirname "$0")"
mkdir -p "$LOG_DIR"

[ -f "$PROMPT_FILE" ] || { echo "$PROMPT_FILE not found in $(pwd)" >&2; exit 1; }
command -v claude >/dev/null || { echo "claude CLI not on PATH" >&2; exit 1; }

trap 'echo; echo "── Ralph stopped at iteration $ITER ──"; exit 0' INT TERM

echo "── Ralph starting in $(pwd) ──"
echo "PROMPT_FILE=$PROMPT_FILE"
echo "MAX_ITERATIONS=$MAX_ITERATIONS (0 = unlimited)"
echo "SLEEP_BETWEEN=${SLEEP_BETWEEN}s   logs → $LOG_DIR/"
[ -n "$MODEL" ] && echo "model → $MODEL"
if [ "$AUTO_EFFORT" = 1 ]; then
  echo "effort → auto·reduced (per-section tag in $FIX_PLAN, −$EFFORT_REDUCE notch band, +1 on churn)"
else
  echo "effort → $EFFORT (pinned)"
fi
echo

CLAUDE_ARGS=(--print --dangerously-skip-permissions)
[ -n "$MODEL" ] && CLAUDE_ARGS+=(--model "$MODEL")
[ "$AUTO_EFFORT" = 0 ] && CLAUDE_ARGS+=(--effort "$EFFORT")

# Effort ladder (low→max); bump_effort echoes one notch up, capped at max.
EFFORT_LADDER=(low medium high xhigh max)
bump_effort() {
  local e="$1" i n
  for i in "${!EFFORT_LADDER[@]}"; do
    [ "${EFFORT_LADDER[$i]}" = "$e" ] || continue
    n=$((i + 1)); [ "$n" -ge "${#EFFORT_LADDER[@]}" ] && n=$((${#EFFORT_LADDER[@]} - 1))
    echo "${EFFORT_LADDER[$n]}"; return
  done
  echo "$e"
}

# Reduced-effort band: lower one notch (max→xhigh→high→medium→low), floored at low.
lower_effort() {
  local e="$1" i n
  for i in "${!EFFORT_LADDER[@]}"; do
    [ "${EFFORT_LADDER[$i]}" = "$e" ] || continue
    n=$((i - 1)); [ "$n" -lt 0 ] && n=0
    echo "${EFFORT_LADDER[$n]}"; return
  done
  echo "$e"
}

# Read the section tag of the topmost unchecked fix_plan item into
# DERIVED_EFFORT, and the item's text into TOP_SIG (for churn detection).
# 🧠 sections carry "xhigh", ⚡ sections "high"; default high if untagged. The
# reduced-effort band then lowers EFFORT_REDUCE notches (default 2: xhigh→medium,
# high→low) so a `low` run steps up only when churn re-escalates a stuck item.
PREV_TOP=""
derive_effort() {
  local ln hdr
  ln=$(grep -nE '^- \[ \] ' "$FIX_PLAN" 2>/dev/null | head -1 | cut -d: -f1)
  if [ -z "$ln" ]; then DERIVED_EFFORT="high"; TOP_SIG=""; return; fi
  TOP_SIG=$(sed -n "${ln}p" "$FIX_PLAN")
  hdr=$(head -n "$ln" "$FIX_PLAN" | grep -nE '^### ' | tail -1)
  DERIVED_EFFORT=$(printf '%s' "$hdr" | grep -oE 'xhigh|high|medium|low|max' | head -1)
  [ -z "$DERIVED_EFFORT" ] && DERIVED_EFFORT="high"
  local r=0
  while [ "$r" -lt "$EFFORT_REDUCE" ]; do
    DERIVED_EFFORT=$(lower_effort "$DERIVED_EFFORT"); r=$((r + 1))
  done
}

# Stop condition: the loop writes RALPH_DONE when the backlog is empty and a bug
# audit found nothing (PROMPT.md Phase 1). New unchecked items in fix_plan.md
# override a stale RALPH_DONE, so adding work and re-running just works.
DONE_FILE="${DONE_FILE:-RALPH_DONE}"
check_done() {
  [ -f "$DONE_FILE" ] || return 1
  if grep -qE '^- \[ \] ' "$FIX_PLAN" 2>/dev/null; then
    echo "── $DONE_FILE present but $FIX_PLAN has open items → removing it, continuing ──"
    rm -f "$DONE_FILE"
    return 1
  fi
  return 0
}

while :; do
  if check_done; then
    echo "── $DONE_FILE found: backlog empty and audit clean. Stopping after $ITER iteration(s). ──"
    sed 's/^/   /' "$DONE_FILE"
    exit 0
  fi
  ITER=$((ITER + 1))
  TS=$(date +%Y%m%d-%H%M%S)
  LOG_FILE="$LOG_DIR/iter-$(printf '%05d' "$ITER")-$TS.log"
  ITER_ARGS=("${CLAUDE_ARGS[@]}")
  if [ "$AUTO_EFFORT" = 1 ]; then
    derive_effort
    USE_EFFORT="$DERIVED_EFFORT"
    if [ -n "$TOP_SIG" ] && [ "$TOP_SIG" = "$PREV_TOP" ]; then
      USE_EFFORT=$(bump_effort "$USE_EFFORT")
      echo "   churn: top item unchanged since last loop → effort ↑ $USE_EFFORT"
    fi
    PREV_TOP="$TOP_SIG"
    ITER_ARGS+=(--effort "$USE_EFFORT")
    echo "── iteration $ITER  $(date '+%H:%M:%S')  effort=$USE_EFFORT  log: $LOG_FILE ──"
  else
    echo "── iteration $ITER  $(date '+%H:%M:%S')  effort=$EFFORT  log: $LOG_FILE ──"
  fi

  cat "$PROMPT_FILE" | claude "${ITER_ARGS[@]}" 2>&1 | tee "$LOG_FILE"
  RC=${PIPESTATUS[1]}
  echo
  echo "── iteration $ITER done (rc=$RC) ──"
  echo

  if [ "$MAX_ITERATIONS" != 0 ] && [ "$ITER" -ge "$MAX_ITERATIONS" ]; then
    echo "Reached MAX_ITERATIONS=$MAX_ITERATIONS. Exiting."
    exit 0
  fi
  sleep "$SLEEP_BETWEEN"
done
