# PKB_Wolfbrain V.10.2 — Reference Schema (FROZEN)

**Status:** Reference-only. Runtime masih V.10.1.
**Imported:** Phase A migration plan Rev.2.
**Do not edit:** Source-of-truth dokumen V.10.2 (candidate_locked).

## Files (10)

| File | Role |
|------|------|
| `PKB_Wolfbrain_V10_2_skeleton.json` | Full-shape JSON skeleton (canonical structure) |
| `F1_Doctrine_Skeleton.md` | Doctrine + skeleton narrative |
| `F2_Field_Definitions.md` | Field dictionary (26 engines) |
| `F3_Enum_Registry.md` | Allowed enum vocabulary |
| `F4_Form_Mapping.md` | JSON ↔ Form Wizard mapping |
| `Governance_Rules.md` | 12 operational rules (G1–G12) |
| `Supabase_Data_Architecture.md` | Table schema + publish flow |
| `Extractor_Workflow.md` | LLM extractor workflow + case studies |
| `Brand_Story.md` | Strategic narrative (investor/board) |
| `Mental_Playbook.md` | Personal doctrine (internal team) |

## Conflict Hierarchy

- Field/path/structure → **Skeleton JSON** wins
- Behavior/enforcement → **Governance Rules** wins
- Enum vocabulary → **F3** wins
- Field definition → **F2** wins

## Phase A Acceptance Criteria

- [x] 10 files imported under `docs/schema/v10.2/`
- [x] No runtime file touched (V.10.1 still active in `src/`)
- [x] No rename, no delete, no schema migration
- [ ] User sign-off → proceed to Phase B
