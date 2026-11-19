"""Eine geschlossene Zuordnung je Ritualfrage.

Die poetischen Atlasfelder bleiben unberührt. Der Match liest nur diese
Wörter, damit Landschaft, Rhythmus, Stimmung, Symbol und Körper sich nicht
gegenseitig denselben Treffer teilen.
"""

FACETS: dict[str, dict[str, str]] = {
    "machu_picchu_pe": {"landscape": "mountain", "rhythm": "rise", "mood": "longing", "symbol": "triangle", "motion": "climb"},
    "uluru_au": {"landscape": "plain", "rhythm": "pause", "mood": "silence", "symbol": "circle", "motion": "still"},
    "petra_jo": {"landscape": "city", "rhythm": "threshold", "mood": "longing", "symbol": "rhombus", "motion": "wander"},
    "banff_ca": {"landscape": "mountain", "rhythm": "pause", "mood": "silence", "symbol": "triangle", "motion": "wander"},
    "varanasi_in": {"landscape": "city", "rhythm": "threshold", "mood": "longing", "symbol": "cross", "motion": "wander"},
    "ganges_river_in": {"landscape": "plain", "rhythm": "descent", "mood": "longing", "symbol": "spiral", "motion": "swim"},
    "mont_saint_michel_fr": {"landscape": "coast", "rhythm": "threshold", "mood": "longing", "symbol": "triangle", "motion": "swim"},
    "salar_de_uyuni_bo": {"landscape": "plain", "rhythm": "pause", "mood": "silence", "symbol": "circle", "motion": "still"},
    "reykjavik_is": {"landscape": "coast", "rhythm": "pause", "mood": "silence", "symbol": "circle", "motion": "swim"},
    "serengeti_tz": {"landscape": "plain", "rhythm": "circle", "mood": "departure", "symbol": "circle", "motion": "wander"},
    "mount_fuji_jp": {"landscape": "mountain", "rhythm": "pause", "mood": "silence", "symbol": "triangle", "motion": "climb"},
    "tikal_gt": {"landscape": "forest", "rhythm": "descent", "mood": "longing", "symbol": "spiral", "motion": "wander"},
    "samarkand_uz": {"landscape": "city", "rhythm": "threshold", "mood": "longing", "symbol": "cross", "motion": "wander"},
    "istanbul_tr": {"landscape": "city", "rhythm": "threshold", "mood": "decision", "symbol": "cross", "motion": "wander"},
    "fez_ma": {"landscape": "city", "rhythm": "circle", "mood": "longing", "symbol": "spiral", "motion": "wander"},
    "kyoto_jp": {"landscape": "city", "rhythm": "pause", "mood": "silence", "symbol": "circle", "motion": "still"},
    "mount_kailash_cn": {"landscape": "mountain", "rhythm": "circle", "mood": "longing", "symbol": "circle", "motion": "wander"},
    "rapa_nui_cl": {"landscape": "coast", "rhythm": "pause", "mood": "silence", "symbol": "circle", "motion": "still"},
    "angkor_wat_kh": {"landscape": "forest", "rhythm": "circle", "mood": "longing", "symbol": "spiral", "motion": "wander"},
    "ushuaia_ar": {"landscape": "coast", "rhythm": "threshold", "mood": "missing", "symbol": "cross", "motion": "wander"},
    "giza_plateau_eg": {"landscape": "plain", "rhythm": "pause", "mood": "silence", "symbol": "rhombus", "motion": "still"},
    "stonehenge_gb": {"landscape": "plain", "rhythm": "circle", "mood": "silence", "symbol": "circle", "motion": "still"},
    "tiwanaku_bo": {"landscape": "plain", "rhythm": "threshold", "mood": "longing", "symbol": "cross", "motion": "wander"},
    "sigiriya_lk": {"landscape": "forest", "rhythm": "rise", "mood": "longing", "symbol": "triangle", "motion": "climb"},
    "bermuda_triangle_vertex_xx": {"landscape": "coast", "rhythm": "rise", "mood": "missing", "symbol": "spiral", "motion": "swim"},
    "lake_superior_us_ca": {"landscape": "forest", "rhythm": "descent", "mood": "silence", "symbol": "spiral", "motion": "swim"},
    "cape_reinga_nz": {"landscape": "coast", "rhythm": "threshold", "mood": "missing", "symbol": "cross", "motion": "wander"},
    "azores_archipelago_pt": {"landscape": "coast", "rhythm": "rise", "mood": "departure", "symbol": "triangle", "motion": "swim"},
    "mount_shasta_us": {"landscape": "mountain", "rhythm": "rise", "mood": "longing", "symbol": "triangle", "motion": "climb"},
    "krakatoa_id": {"landscape": "mountain", "rhythm": "rise", "mood": "departure", "symbol": "spiral", "motion": "wander"},
    "mount_etna_it": {"landscape": "mountain", "rhythm": "rise", "mood": "departure", "symbol": "triangle", "motion": "climb"},
    "mauna_kea_us": {"landscape": "mountain", "rhythm": "pause", "mood": "silence", "symbol": "triangle", "motion": "still"},
    "glastonbury_tor_gb": {"landscape": "mountain", "rhythm": "pause", "mood": "longing", "symbol": "spiral", "motion": "wander"},
    "jerusalem_il": {"landscape": "city", "rhythm": "threshold", "mood": "longing", "symbol": "rhombus", "motion": "still"},
    "axum_et": {"landscape": "city", "rhythm": "pause", "mood": "silence", "symbol": "rhombus", "motion": "still"},
    "chichen_itza_mx": {"landscape": "city", "rhythm": "rise", "mood": "departure", "symbol": "triangle", "motion": "climb"},
    "shambhala_node_mn": {"landscape": "mountain", "rhythm": "pause", "mood": "silence", "symbol": "circle", "motion": "still"},
    "delphi_gr": {"landscape": "mountain", "rhythm": "threshold", "mood": "longing", "symbol": "spiral", "motion": "still"},
    "lake_baikal_ru": {"landscape": "forest", "rhythm": "descent", "mood": "silence", "symbol": "spiral", "motion": "swim"},
    "teotihuacan_mx": {"landscape": "city", "rhythm": "rise", "mood": "longing", "symbol": "triangle", "motion": "climb"},
}
