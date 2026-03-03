# Consistency Issues - Game/Category Unification

## VALID_GAMES Inconsistency (discovered 2026-02-26)

| File | Games | Count |
|---|---|---|
| `app/justtcg/lib/constants.ts` GAME_OPTIONS | pokemon-japan, one-piece-card-game | 2 |
| `app/api/justtcg/cards/route.ts` VALID_GAMES | pokemon-japan, one-piece-card-game | 2 |
| `app/api/justtcg/sets/route.ts` VALID_GAMES | pokemon-japan, pokemon, one-piece-card-game, digimon, union-arena, hololive, dragon-ball | 7 |
| `app/api/justtcg/register/route.ts` GAME_CATEGORY_MAP | pokemon-japan, pokemon, one-piece-card-game, digimon, union-arena, hololive, dragon-ball | 7 |
| `app/api/justtcg/match/route.ts` JAPANESE_GAMES | pokemon-japan, one-piece-card-game, digimon, union-arena, hololive, dragon-ball | 6+pokemon |
| `lib/chart/constants.ts` CATEGORIES | all, pokemon, onepiece | 3 |
| `docs/v2-db-schema.sql` valid_game_types() | pokemon-japan, one-piece-card-game | 2 |

## Recommendation
Extract VALID_GAMES to a single shared constant (e.g., `lib/constants/games.ts`) and import everywhere.

## RARITY_EN_TO_JA vs rarity_mappings Discrepancies
- register route: 'Illustration Rare' -> 'AR' (short_name)
- v2-db-schema: 'Illustration Rare' -> rarity_ja: 'イラストレア', short_name: 'AR'
- v2-db-schema: 'Art Rare' -> rarity_ja: 'アートレア', short_name: 'AR' (separate entry, not in register route!)
- register route: 'Super Rare' -> 'SR' AND 'Secret Rare' -> 'SR' (collision)
- v2-db-schema: pokemon-japan 'Secret Rare' -> short_name 'SR', one-piece 'Secret Rare' -> short_name 'SEC'
