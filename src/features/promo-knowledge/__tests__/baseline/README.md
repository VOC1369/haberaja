# Baseline JSON Snapshot — Pre-Refactor Lock

Snapshot date: 2026-04-25
Extractor: pk-extractor@claude-sonnet-4-5
Schema: V.09
Purpose: Regression guard for Batch Cepat refactor 
         (A.1 confidence path cleanup, A.2 field 
         status sync, A.4 reward range)

Test cases: 6 promos covering single / multi-variant 
            / tiered / loyalty / event-B / redemption 
            patterns

Diff tool: TBD (Step #5 — automated regression)

## Files (DO NOT MODIFY)

01-cashback-slot25.json           — Simple loss-based, Class A
02-welcome-bonus-lautan77.json    — Multi-variant (5), Class A
03-extra-cuan-referral-lautan77.json — Tiered referral, Class A
04-kupon-loyalty-lautan77.json    — Loyalty + tier, Class A
05-event-level-up-lautan77.json   — Tier event, Class B
06-bonus-apk-freechip-lautan77.json — App install + redemption

## Rule

These files are read-only by convention. Modifying 
them invalidates regression diff against post-refactor 
output. If extraction logic changes intentionally, 
create new baseline directory (e.g. baseline-v2/) 
instead of modifying these files.
