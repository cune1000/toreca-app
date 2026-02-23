/**
 * JustTCG セットIDから日本語名へのマッピング
 * 主要セット（M/SV/S/SM時代）の公式日本語名
 * セットコード（SV10, M3等）は set_code フィールドに別途保存されるため、ここでは収録弾名のみ
 */
export const SET_NAME_JA: Record<string, string> = {
  // === M (Mega) 時代 ===
  'm3-nihil-zero-pokemon-japan': 'ムニキスゼロ',
  'mp1-start-deck-100-corocoro-comic-pokemon-japan': 'スタートデッキ100 コロコロコミックver.',
  'start-deck-100-battle-collection-pokemon-japan': 'スタートデッキ100 バトルコレクション',
  'm2a-high-class-pack-mega-dream-ex-pokemon-japan': 'ハイクラスパック MEGAドリームex',
  'm2-inferno-x-pokemon-japan': 'インフェルノX',
  'mbg-mega-starter-set-mega-gengar-ex-pokemon-japan': 'MEGAスターターセット メガゲンガーex',
  'mbd-mega-starter-set-mega-diancie-ex-pokemon-japan': 'MEGAスターターセット メガディアンシーex',
  'm-p-promotional-cards-pokemon-japan': 'プロモカード',
  'm1s-mega-symphonia-pokemon-japan': 'メガシンフォニア',
  'm1l-mega-brave-pokemon-japan': 'メガブレイブ',

  // === SV (Scarlet & Violet) 時代 ===
  'scarlet-violet-energies-pokemon-japan': 'スカーレット&バイオレット エネルギー',
  'sv11w-white-flare-pokemon-japan': 'ホワイトフレア',
  'sv11b-black-bolt-pokemon-japan': 'ブラックボルト',
  'sv10-the-glory-of-team-rocket-pokemon-japan': 'ロケット団の栄光',
  'sv9a-heat-wave-arena-pokemon-japan': 'ヒートウェーブアリーナ',
  'sv9-battle-partners-pokemon-japan': 'バトルパートナーズ',
  'svn-battle-partners-deck-build-box-pokemon-japan': 'バトルパートナーズ デッキビルドBOX',
  'sv8a-terastal-fest-ex-pokemon-japan': 'テラスタルフェスex',
  'svm-generations-start-decks-pokemon-japan': 'ジェネレーションスタートデッキ',
  'sv8-super-electric-breaker-pokemon-japan': '超電ブレイカー',
  'sv-p-promotional-cards-pokemon-japan': 'プロモカード',
  'sv7a-paradise-dragona-pokemon-japan': '楽園ドラゴーナ',
  'sv7-stellar-miracle-pokemon-japan': 'ステラミラクル',
  'sv-stellar-miracle-deck-build-box-pokemon-japan': 'ステラミラクル デッキビルドBOX',
  'sv6a-night-wanderer-pokemon-japan': 'ナイトワンダラー',
  'sv6-transformation-mask-pokemon-japan': '変幻の仮面',
  'sv5a-crimson-haze-pokemon-japan': 'クリムゾンヘイズ',
  'sv5m-cyber-judge-pokemon-japan': 'サイバージャッジ',
  'sv5k-wild-force-pokemon-japan': 'ワイルドフォース',
  'sv4a-shiny-treasure-ex-pokemon-japan': 'シャイニートレジャーex',
  'sv4m-future-flash-pokemon-japan': '未来の一閃',
  'sv4k-ancient-roar-pokemon-japan': '古代の咆哮',
  'sv3a-raging-surf-pokemon-japan': 'レイジングサーフ',
  'sv3-ruler-of-the-black-flame-pokemon-japan': '黒炎の支配者',
  'sv-ruler-of-the-black-flame-deck-build-box-pokemon-japan': '黒炎の支配者 デッキビルドBOX',
  'sv2a-pokemon-card-151-pokemon-japan': 'ポケモンカード151',
  'sv2p-snow-hazard-pokemon-japan': 'スノーハザード',
  'sv2d-clay-burst-pokemon-japan': 'クレイバースト',
  'sv1a-triplet-beat-pokemon-japan': 'トリプレットビート',
  'sv1v-violet-ex-pokemon-japan': 'バイオレットex',
  'sv1s-scarlet-ex-pokemon-japan': 'スカーレットex',
  'sv-premium-trainer-box-ex-pokemon-japan': 'プレミアムトレーナーボックスex',
  'sv-ex-start-decks-pokemon-japan': 'exスタートデッキ',
  'sv-ex-special-set-pokemon-japan': 'exスペシャルセット',
  'sv-ex-starter-set-pikachu-ex-pawmot-pokemon-japan': 'exスターターセット ピカチュウex&パーモット',
  'sv-ex-starter-set-sprigatito-lucario-ex-pokemon-japan': 'exスターターセット ニャオハ&ルカリオex',
  'sv-ex-starter-set-quaxly-mimikyu-ex-pokemon-japan': 'exスターターセット クワッス&ミミッキュex',
  'sv-ex-starter-set-fuecoco-ampharos-ex-pokemon-japan': 'exスターターセット ホゲータ&デンリュウex',
  'sv-ex-starter-set-steven-s-beldum-metagross-ex-pokemon-japan': 'exスターターセット ダイゴのダンバル&メタグロスex',
  'sv-ex-starter-set-marnie-s-morpeko-grimmsnarl-ex-pokemon-japan': 'exスターターセット マリィのモルペコ&オーロンゲex',
  'sv-mewtwo-ex-terastal-starter-set-pokemon-japan': 'ミュウツーex テラスタルスターターセット',
  'sv-skeledirge-ex-terastal-starter-set-pokemon-japan': 'ラウドボーンex テラスタルスターターセット',
  'sv-ceruledge-ex-stellar-tera-type-starter-set-pokemon-japan': 'ソウブレイズex ステラテラタイプ スターターセット',
  'sv-sylveon-ex-stellar-tera-type-starter-set-pokemon-japan': 'ニンフィアex ステラテラタイプ スターターセット',
  'sv-chien-pao-ex-battle-master-deck-pokemon-japan': 'パオジアンex バトルマスターデッキ',
  'sv-terastal-charizard-ex-battle-master-deck-pokemon-japan': 'テラスタルリザードンex バトルマスターデッキ',
  'sv-venusaur-charizard-blastoise-special-deck-set-pokemon-japan': 'フシギバナ・リザードン・カメックス スペシャルデッキセット',
  'sv-future-miraidon-ex-starter-deck-build-set-pokemon-japan': '未来のミライドンex スターターデッキ&ビルドセット',
  'sv-ancient-koraidon-ex-starter-deck-build-set-pokemon-japan': '古代のコライドンex スターターデッキ&ビルドセット',
  'pokemon-tcg-classic-venusaur-pokemon-japan': 'ポケモンTCGクラシック フシギバナ',
  'pokemon-tcg-classic-charizard-pokemon-japan': 'ポケモンTCGクラシック リザードン',
  'pokemon-tcg-classic-blastoise-pokemon-japan': 'ポケモンTCGクラシック カメックス',
  'wcs23-2023-world-championships-yokohama-deck-pikachu-pokemon-japan': '2023 ワールドチャンピオンシップス 横浜デッキ ピカチュウ',
  'special-box-collections-pokemon-japan': 'スペシャルBOXコレクション',
  'battle-academy-pokemon-japan': 'バトルアカデミー',

  // === S (Sword & Shield) 時代 ===
  's12a-vstar-universe-pokemon-japan': 'VSTARユニバース',
  's12-paradigm-trigger-pokemon-japan': 'パラダイムトリガー',
  's11a-incandescent-arcana-pokemon-japan': '白熱のアルカナ',
  's11-lost-abyss-pokemon-japan': 'ロストアビス',
  's10b-pokemon-go-pokemon-japan': 'ポケモンGO',
  's10a-dark-phantasma-pokemon-japan': 'ダークファンタズマ',
  's10p-space-juggler-pokemon-japan': 'スペースジャグラー',
  's10d-time-gazer-pokemon-japan': 'タイムゲイザー',
  's9a-battle-region-pokemon-japan': 'バトルリージョン',
  's9-star-birth-pokemon-japan': 'スターバース',
  's8b-vmax-climax-pokemon-japan': 'VMAXクライマックス',
  's8a-25th-anniversary-collection-pokemon-japan': '25thアニバーサリーコレクション',
  's8a-g-25th-anniversary-golden-box-pokemon-japan': '25thアニバーサリー ゴールデンBOX',
  's8-fusion-arts-pokemon-japan': 'フュージョンアーツ',
  's7d-skyscraping-perfection-pokemon-japan': '摩天パーフェクト',
  's7r-blue-sky-stream-pokemon-japan': '蒼空ストリーム',
  's6a-eevee-heroes-pokemon-japan': 'イーブイヒーローズ',
  's6k-jet-black-spirit-pokemon-japan': '漆黒のガイスト',
  's6h-silver-lance-pokemon-japan': '白銀のランス',
  's5a-peerless-fighters-pokemon-japan': '双璧のファイター',
  's5r-rapid-strike-master-pokemon-japan': '連撃マスター',
  's5i-single-strike-master-pokemon-japan': '一撃マスター',
  's4a-shiny-star-v-pokemon-japan': 'シャイニースターV',
  's4-amazing-volt-tackle-pokemon-japan': '仰天のボルテッカー',
  's3a-legendary-heartbeat-pokemon-japan': '伝説の鼓動',
  's3-infinity-zone-pokemon-japan': 'ムゲンゾーン',
  's2a-explosive-walker-pokemon-japan': '爆炎ウォーカー',
  's2-rebellion-crash-pokemon-japan': '反逆クラッシュ',
  's1a-vmax-rising-pokemon-japan': 'VMAXライジング',
  's1w-sword-pokemon-japan': 'ソード',
  's1h-shield-pokemon-japan': 'シールド',
  's-p-sword-shield-promos-pokemon-japan': 'ソード&シールド プロモ',
  'si-start-deck-100-pokemon-japan': 'スタートデッキ100',
  'sp6-vstar-special-set-pokemon-japan': 'VSTARスペシャルセット',
  'sp5-v-union-special-card-sets-pokemon-japan': 'V-UNIONスペシャルカードセット',
  'sp4-eevee-heroes-vmax-special-set-pokemon-japan': 'イーブイヒーローズ VMAXスペシャルセット',
  'sp2-vmax-special-set-pokemon-japan': 'VMAXスペシャルセット',
  'sp1-zacian-zamazenta-box-pokemon-japan': 'ザシアン+ザマゼンタ BOX',
  'ss-gengar-vmax-high-class-deck-pokemon-japan': 'ゲンガーVMAX ハイクラスデッキ',
  'ss-inteleon-vmax-high-class-deck-pokemon-japan': 'インテレオンVMAX ハイクラスデッキ',
  'ss-silver-lance-jet-black-spirit-jumbo-pack-set-pokemon-japan': '白銀のランス&漆黒のガイスト ジャンボパックセット',
  'sf-single-strike-rapid-strike-premium-trainer-boxes-pokemon-japan': '一撃&連撃 プレミアムトレーナーBOX',
  'sd-v-starter-decks-pokemon-japan': 'Vスタートデッキ',
  'sc-charizard-starter-set-vmax-pokemon-japan': 'リザードン スターターセットVMAX',
  'sc-grimmsnarl-starter-set-vmax-pokemon-japan': 'オーロンゲ スターターセットVMAX',
  'sc2-charizard-starter-set-vmax-2-pokemon-japan': 'リザードン スターターセットVMAX 2',
  'sb-sword-shield-premium-trainer-box-pokemon-japan': 'ソード&シールド プレミアムトレーナーBOX',
  'sn-start-deck-100-corocoro-comic-version-pokemon-japan': 'スタートデッキ100 コロコロコミックver.',
  'sld-darkrai-starter-set-vstar-pokemon-japan': 'ダークライ スターターセットVSTAR',
  'sll-lucario-starter-set-vstar-pokemon-japan': 'ルカリオ スターターセットVSTAR',
  'sk-vstar-premium-trainer-box-pokemon-japan': 'VSTARプレミアムトレーナーBOX',
  'sj-zacian-zamazenta-vs-eternatus-special-deck-set-pokemon-japan': 'ザシアン&ザマゼンタ vs ムゲンダイナ スペシャルデッキセット',
  's8a-p-promo-card-pack-25th-anniversary-edition-pokemon-japan': 'プロモカードパック 25thアニバーサリーedition',
  'sef-venusaur-starter-set-vmax-pokemon-japan': 'フシギバナ スターターセットVMAX',
  'sek-blastoise-starter-set-vmax-pokemon-japan': 'カメックス スターターセットVMAX',
  'sh-sword-shield-family-pokemon-card-game-pokemon-japan': 'ソード&シールド ファミリーポケモンカードゲーム',
  's0-charizard-vstar-vs-rayquaza-vmax-special-deck-set-pokemon-japan': 'リザードンVSTAR vs レックウザVMAX スペシャルデッキセット',
  'spd-deoxys-vstar-vmax-high-class-deck-pokemon-japan': 'デオキシスVSTAR&VMAX ハイクラスデッキ',
  'spz-zeraora-vstar-vmax-high-class-deck-pokemon-japan': 'ゼラオラVSTAR&VMAX ハイクラスデッキ',
  'sa-water-starter-set-v-pokemon-japan': '水タイプ スターターセットV',
  'sa-fighting-starter-set-v-pokemon-japan': '闘タイプ スターターセットV',
  'sa-lightning-starter-set-v-pokemon-japan': '雷タイプ スターターセットV',
  'sa-fire-starter-set-v-pokemon-japan': '炎タイプ スターターセットV',
  'sa-grass-starter-set-v-pokemon-japan': '草タイプ スターターセットV',

  // === SM (Sun & Moon) 時代 ===
  'sm12a-tag-team-gx-tag-all-stars-pokemon-japan': 'TAG TEAM GX タッグオールスターズ',
  'sm12-alter-genesis-pokemon-japan': 'オルタージェネシス',
  'sm11b-dream-league-pokemon-japan': 'ドリームリーグ',
  'sm11a-remix-bout-pokemon-japan': 'リミックスバウト',
  'sm11-miracle-twin-pokemon-japan': 'ミラクルツイン',
  'sm10b-sky-legend-pokemon-japan': 'スカイレジェンド',
  'sm10a-gg-end-pokemon-japan': 'GGエンド',
  'sm10-double-blaze-pokemon-japan': 'ダブルブレイズ',
  'sm9b-full-metal-wall-pokemon-japan': 'フルメタルウォール',
  'sm9a-night-unison-pokemon-japan': 'ナイトユニゾン',
  'sm9-tag-bolt-pokemon-japan': 'タッグボルト',
  'sm8b-gx-ultra-shiny-pokemon-japan': 'GXウルトラシャイニー',
  'sm8a-dark-order-pokemon-japan': 'ダークオーダー',
  'sm8-super-burst-impact-pokemon-japan': '超爆インパクト',
  'sm7b-fairy-rise-pokemon-japan': 'フェアリーライズ',
  'sm7a-thunderclap-spark-pokemon-japan': '迅雷スパーク',
  'sm7-sky-splitting-charisma-pokemon-japan': '裂空のカリスマ',
  'sm6b-champion-road-pokemon-japan': 'チャンピオンロード',
  'sm6a-dragon-storm-pokemon-japan': 'ドラゴンストーム',
  'sm6-forbidden-light-pokemon-japan': '禁断の光',
  'sm5-ultra-force-pokemon-japan': 'ウルトラフォース',
  'sm5m-ultra-moon-pokemon-japan': 'ウルトラムーン',
  'sm5s-ultra-sun-pokemon-japan': 'ウルトラサン',
  'sm4-gx-battle-boost-pokemon-japan': 'GXバトルブースト',
  'sm4a-ultradimensional-beasts-pokemon-japan': '超次元の暴獣',
  'sm4s-awakened-heroes-pokemon-japan': '覚醒の勇者',
  'sm3-shining-legends-pokemon-japan': 'ひかる伝説',
  'sm3h-to-have-seen-the-battle-rainbow-pokemon-japan': '闘う虹を見たか',
  'sm3n-darkness-that-consumes-light-pokemon-japan': '光を喰らう闇',
  'sm2-facing-a-new-trial-pokemon-japan': '新たなる試練の向こう',
  'sm2k-islands-await-you-pokemon-japan': 'キミを待つ島々',
  'sm2l-alolan-moonlight-pokemon-japan': 'アローラの月光',
  'sm1-enhanced-expansion-pack-sun-moon-pokemon-japan': '強化拡張パック サン&ムーン',
  'sm1s-collection-sun-pokemon-japan': 'コレクション サン',
  'sm1m-collection-moon-pokemon-japan': 'コレクション ムーン',
  'sm-the-best-of-xy-pokemon-japan': 'THE BEST OF XY',
  'sm-p-sun-moon-promos-pokemon-japan': 'サン&ムーン プロモ',
  'sm0-pikachu-s-new-friends-pokemon-japan': 'ピカチュウの新しい仲間',
  'smm-tag-team-gx-starter-sets-pokemon-japan': 'TAG TEAM GX スターターセット',
  'smj-tag-team-gx-premium-trainer-box-pokemon-japan': 'TAG TEAM GX プレミアムトレーナーBOX',
  'smh-gx-starter-decks-pokemon-japan': 'GXスタートデッキ',
  'smk-trainer-battle-decks-pokemon-japan': 'トレーナーバトルデッキ',
  'sml-sun-moon-family-pokemon-card-game-pokemon-japan': 'サン&ムーン ファミリーポケモンカードゲーム',
  'smp2-great-detective-pikachu-pokemon-japan': '名探偵ピカチュウ',
  'smp1-rockruff-full-power-deck-pokemon-japan': 'イワンコ フルパワーデッキ',
  'sma-sun-moon-starter-set-pokemon-japan': 'サン&ムーン スターターセット',
  'smb-premium-trainer-box-pokemon-japan': 'プレミアムトレーナーBOX',
  'smc-tapu-bulu-gx-enhanced-starter-set-pokemon-japan': 'カプ・ブルルGX 強化スターターセット',
  'smd-ash-vs-team-rocket-deck-kit-pokemon-japan': 'サトシ vs ロケット団 デッキキット',
  'sme-solgaleo-gx-lunala-gx-legendary-starter-set-pokemon-japan': 'ソルガレオGX&ルナアーラGX レジェンダリースターターセット',
  'smf-ultra-sun-ultra-moon-premium-trainer-box-pokemon-japan': 'ウルトラサン&ウルトラムーン プレミアムトレーナーBOX',
  'smi-flareon-gx-vaporeon-gx-jolteon-gx-starter-sets-pokemon-japan': 'ブースターGX・シャワーズGX・サンダースGX スターターセット',

  // === XY 時代 ===
  'cp6-expansion-pack-20th-anniversary-pokemon-japan': '拡張パック 20thアニバーサリー',
  'cp5-mythical-legendary-dream-shine-collection-pokemon-japan': '幻・伝説ドリームキラコレクション',
  'cp4-premium-champion-pack-pokemon-japan': 'プレミアムチャンピオンパック',
  'cp3-pokekyun-collection-pokemon-japan': 'ポケキュンコレクション',
  'cp2-legendary-shine-collection-pokemon-japan': 'レジェンダリーシャインコレクション',
  'cp1-magma-gang-vs-aqua-gang-double-crisis-pokemon-japan': 'マグマ団 vs アクア団 ダブルクライシス',
  'xy11-br-cruel-traitor-pokemon-japan': '冷酷の反逆者',
  'xy11-bb-fever-burst-fighter-pokemon-japan': '爆熱の闘士',
  'xy10-awakening-psychic-king-pokemon-japan': 'めざめる超王',
  'xy9-rage-of-the-broken-heavens-pokemon-japan': '破天の怒り',
  'xy8-br-red-flash-pokemon-japan': 'レッドフラッシュ',
  'xy8-bb-blue-shock-pokemon-japan': 'ブルーショック',
  'xy7-bandit-ring-pokemon-japan': 'バンデットリング',
  'xy6-emerald-break-pokemon-japan': 'エメラルドブレイク',
  'xy5-bt-tidal-storm-pokemon-japan': 'タイダルストーム',
  'xy5-bg-gaia-volcano-pokemon-japan': 'ガイアボルケーノ',
  'xy4-phantom-gate-pokemon-japan': 'ファントムゲート',
  'xy3-rising-fist-pokemon-japan': 'ライジングフィスト',
  'xy2-wild-blaze-pokemon-japan': 'ワイルドブレイズ',
  'xy-bx-collection-x-pokemon-japan': 'コレクションX',
  'xy-by-collection-y-pokemon-japan': 'コレクションY',
  'xy-p-xy-promos-pokemon-japan': 'XYプロモ',
  'xy-beginning-set-pokemon-japan': 'XYはじめてセット',
  'break-starter-pack-pokemon-japan': 'BREAKスターターパック',

  // === 旧裏 / その他 ===
  'japanese-cd-promo-pokemon-japan': 'CDプロモ',
  'expansion-pack-pokemon-japan': '第1弾 拡張パック',
  'expansion-pack-no-rarity-pokemon-japan': '第1弾 拡張パック (レアリティなし)',
  'pokemon-jungle-pokemon-japan': 'ポケモンジャングル',
  'mystery-of-the-fossils-pokemon-japan': '化石の秘密',
  'rocket-gang-pokemon-japan': 'ロケット団',
  'gym-challenge-pokemon-japan': 'ジムチャレンジ',
  'challenge-from-the-darkness-pokemon-japan': '闇からの挑戦',
  'leaders-stadium-pokemon-japan': 'リーダーズスタジアム',
  'gold-silver-to-a-new-world-pokemon-japan': '金、銀、新世界へ…',
  'crossing-the-ruins-pokemon-japan': '遺跡をこえて…',
  'awakening-legends-pokemon-japan': '目覚める伝説',
  'darkness-and-to-light-pokemon-japan': '闇、そして光へ…',
  'pokemon-web-pokemon-japan': 'ポケモンWeb',
  'pokemon-vs-pokemon-japan': 'ポケモンVS',
  'southern-island-pokemon-japan': 'サザンアイランド',
  'corocoro-promotional-cards-pokemon-japan': 'コロコロプロモカード',
}

/**
 * セットIDから日本語名を取得（マッピングがなければ英語名を返す）
 */
export function getSetNameJa(id: string, fallbackName: string): string {
  return SET_NAME_JA[id] || fallbackName
}

/**
 * セットIDからset_code（例: "SV10", "M3", "SLD"）を抽出
 * "sv10-the-glory-of-team-rocket-pokemon-japan" → "SV10"
 * "m3-nihil-zero-pokemon-japan" → "M3"
 * "sld-darkrai-starter-set-vstar-pokemon-japan" → "SLD"
 * "sv-p-promotional-cards-pokemon-japan" → "SV-P"
 * R12-22: 数字なしのコード（SLD, SK等）にも対応
 * R14-13: プロモ（-P）やサブセット（-Br, -Bb, -G等）のハイフン入りコードにも対応
 * R14-14: 偽陽性防止（最大4文字 + 英語単語除外）
 */
export function extractSetCode(setId: string): string | null {
  // ハイフン入りサブコード（-P, -Br, -Bb, -G 等）を含むパターンを先に試行
  const subMatch = setId.match(/^([a-z]{1,4}\d*[a-z]?-[a-z]{1,2})-/i)
  if (subMatch) return subMatch[1].toUpperCase()
  // 通常パターン（最大4文字のプレフィックス + 任意の数字 + 任意の末尾英字1文字）
  const match = setId.match(/^([a-z]{1,4}\d+[a-z]?)-/i)
    || setId.match(/^(s[a-z]{0,3}\d*[a-z]?)-/i) // S/SV/SM/SJ/SK等のS系
    || setId.match(/^(m\d+|cp\d+|xy\d*|dp\d*|bw\d*|wcs\d*)-/i) // 既知のプレフィックス
  return match ? match[1].toUpperCase() : null
}

/**
 * release_dateから年を抽出
 * "2026-01-23" → 2026
 * R14-18: ISO日付の先頭4桁を明示的に抽出し、範囲検証
 */
export function extractReleaseYear(releaseDate: string | null): number | null {
  if (!releaseDate) return null
  const m = releaseDate.match(/^(\d{4})-/)
  if (!m) return null
  const year = parseInt(m[1])
  return (year >= 1996 && year <= 2100) ? year : null
}
