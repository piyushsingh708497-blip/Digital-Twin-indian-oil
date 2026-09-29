"""
OIL-TWIN AI - Machine Learning Feature Extraction
Extracts features:
1. Dyno features: STRICTLY derived from (position, load) card points without hidden simulator labels
2. Operating features: for fatigue failure risk modeling and anomaly detection
"""
import numpy as np

from app.schemas.dyno import DynoCard


def extract_dyno_features_from_points(
    surface_points: list[dict[str, float]],
    downhole_points: list[dict[str, float]],
) -> dict[str, float]:
    """
    Extracts geometric, work integral, and harmonic features strictly from position and load coordinates.
    Zero access to simulator state, hidden diagnosis, or operating flags.
    """
    pos_s = np.array([p["position"] if isinstance(p, dict) else p.position for p in surface_points])
    load_s = np.array([p["load"] if isinstance(p, dict) else p.load for p in surface_points])
    pos_d = np.array([p["position"] if isinstance(p, dict) else p.position for p in downhole_points])
    load_d = np.array([p["load"] if isinstance(p, dict) else p.load for p in downhole_points])

    stroke = float(np.max(pos_s) - np.min(pos_s)) if len(pos_s) > 0 else 0.0

    # Surface load metrics
    f_max = float(np.max(load_s)) if len(load_s) > 0 else 0.0
    f_min = float(np.min(load_s)) if len(load_s) > 0 else 0.0
    f_range = f_max - f_min
    f_mean = float(np.mean(load_s)) if len(load_s) > 0 else 0.0
    f_std = float(np.std(load_s)) if len(load_s) > 0 else 0.0

    # Work polygon area (Shoelace formula)
    work_area_s = 0.5 * abs(np.dot(pos_s, np.roll(load_s, 1)) - np.dot(load_s, np.roll(pos_s, 1))) if len(pos_s) > 2 else 0.0
    work_area_d = 0.5 * abs(np.dot(pos_d, np.roll(load_d, 1)) - np.dot(load_d, np.roll(pos_d, 1))) if len(pos_d) > 2 else 0.0

    # Stroke division
    dx = np.diff(pos_s, append=pos_s[0]) if len(pos_s) > 0 else np.array([])
    is_up = dx >= 0
    is_down = ~is_up

    up_load_mean = float(np.mean(load_s[is_up])) if np.any(is_up) else f_mean
    down_load_mean = float(np.mean(load_s[is_down])) if np.any(is_down) else f_mean
    down_load_min = float(np.min(load_s[is_down])) if np.any(is_down) else f_min

    # Peak load derivative (impact spike detection for fluid pound and tagging)
    d_load = np.diff(load_s) if len(load_s) > 1 else np.array([0.0])
    max_d_load = float(np.max(np.abs(d_load))) if len(d_load) > 0 else 0.0

    # Downhole extrema
    dh_max = float(np.max(load_d)) if len(load_d) > 0 else 0.0
    dh_min = float(np.min(load_d)) if len(load_d) > 0 else 0.0
    dh_range = dh_max - dh_min

    # Shape ratios
    box_area = max(0.1, f_range * stroke)
    fullness_ratio = float(work_area_s / box_area)
    load_ratio = float(f_max / max(1.0, f_min))

    return {
        "stroke": stroke,
        "f_max": f_max,
        "f_min": f_min,
        "f_range": f_range,
        "f_mean": f_mean,
        "f_std": f_std,
        "work_area_surface": float(work_area_s),
        "work_area_downhole": float(work_area_d),
        "up_load_mean": up_load_mean,
        "down_load_mean": down_load_mean,
        "down_load_min": down_load_min,
        "max_d_load": max_d_load,
        "dh_max": dh_max,
        "dh_min": dh_min,
        "dh_range": dh_range,
        "fullness_ratio": fullness_ratio,
        "load_ratio": load_ratio,
    }


def extract_card_features(card: DynoCard) -> dict[str, float]:
    """Helper wrapper for DynoCard Pydantic object."""
    return extract_dyno_features_from_points(card.surface, card.downhole)
