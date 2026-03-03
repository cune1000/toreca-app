# UI/UX Migration Issues: v1 Category -> JustTCG Base (2026-03)

## Critical Issues

### C-01: ShopDetailPage filter label "全カテゴリ" (should be "全ゲーム")
- File: components/pages/ShopDetailPage.tsx L514
- CardsPage already uses "全ゲーム" (L683)

### C-02: Dual rarity input in CardEditForm & CardForm
- Text input: `form.rarity` (cards.rarity text column)
- Button selection: `form.rarity_id` (FK to rarities table)
- CardDetailHeader displays text rarity (L191), CardsPage displays JOIN name (L885)
- Same card shows different rarity on different screens

### C-03: "レアリティ（カテゴリ別）" should be "レアリティ（ゲーム別）"
- CardEditForm L450, CardForm L383

### C-04: Form field order mismatch
- CardsPage header: ゲーム → セット → 収録弾 → レアリティ → 型番
- CardEditForm: カード名 → 英語名 → カード番号 → 収録弾 → セットコード → レアリティ → ゲーム

## Concerns

### Y-01: Code comments still say "カテゴリ" (ShopDetailPage L57)
### Y-02: ShopDetailPage purchase count shows `purchases.length` (max 50) not `purchaseTotalCount` (L287)
### Y-03: "セット" (CardsPage header) vs "セットコード" (CardEditForm label) inconsistency
### Y-04: CardForm has no set_code field (CardEditForm has one)
### Y-05: "全セット" + "全収録弾" filters are conceptually overlapping
### Y-06: CardDetailHeader hides null values entirely (no badges), CardsPage shows "−"
### Y-07: PriceChartingImporter still uses "カテゴリ大（一括指定）" (L426)
### Y-08: Image fallback differs: CardsPage "No Image" div, ShopDetailPage nothing
### Y-09: CategoryManager.tsx still exists as dead code
### Y-10: ShopDetailPage status grid: md:grid-cols-4 but only 3 children
### Y-11: CardsPage empty result message only checks 3 of 6 filter vars (L917)
