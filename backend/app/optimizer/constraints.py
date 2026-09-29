"""
OIL-TWIN AI - Engineering Constraints for CSS and SRP Optimization
Defines hard and soft operational envelopes clamped to FIELD_ASSUMPTIONS.
"""
from app.config.assumptions import FIELD_ASSUMPTIONS
from app.schemas.css import CssParams
from app.schemas.srp import SrpSetpoints


def validate_and_clamp_css_params(params: CssParams) -> tuple[CssParams, list[str]]:
    """Validates CSS inputs against field bounds and clamps safely."""
    warnings = []
    assump = FIELD_ASSUMPTIONS.css

    steam = params.steam_volume_tonnes
    if steam < assump.steam_volume_min_tonnes or steam > assump.steam_volume_max_tonnes:
        clamped_steam = max(assump.steam_volume_min_tonnes, min(assump.steam_volume_max_tonnes, steam))
        warnings.append(f"Steam volume {steam} t clamped to [{assump.steam_volume_min_tonnes}, {assump.steam_volume_max_tonnes}] t.")
        steam = clamped_steam

    p_inj = params.inj_pressure
    if p_inj < assump.inj_pressure_min_bar or p_inj > assump.inj_pressure_max_bar:
        clamped_p = max(assump.inj_pressure_min_bar, min(assump.inj_pressure_max_bar, p_inj))
        warnings.append(f"Injection pressure {p_inj} bar clamped to safe rock fracture envelope [{assump.inj_pressure_min_bar}, {assump.inj_pressure_max_bar}] bar.")
        p_inj = clamped_p

    soak = params.soak_days
    if soak < assump.soak_days_min or soak > assump.soak_days_max:
        clamped_soak = max(assump.soak_days_min, min(assump.soak_days_max, soak))
        warnings.append(f"Soak days {soak} clamped to [{assump.soak_days_min}, {assump.soak_days_max}].")
        soak = clamped_soak

    wc = params.production_cutoff_water_cut
    if wc < assump.water_cut_cutoff_min_pct or wc > assump.water_cut_cutoff_max_pct:
        clamped_wc = max(assump.water_cut_cutoff_min_pct, min(assump.water_cut_cutoff_max_pct, wc))
        warnings.append(f"Water cut cutoff {wc}% clamped to [{assump.water_cut_cutoff_min_pct}, {assump.water_cut_cutoff_max_pct}]%.")
        wc = clamped_wc

    clamped_params = CssParams(
        steam_volume_tonnes=steam,
        inj_pressure=p_inj,
        soak_days=soak,
        production_cutoff_water_cut=wc,
    )
    return clamped_params, warnings


def validate_and_clamp_srp_setpoints(setpoints: SrpSetpoints) -> tuple[SrpSetpoints, list[str]]:
    """Validates SRP inputs against mechanical bounds and clamps safely."""
    warnings = []
    assump = FIELD_ASSUMPTIONS.srp

    stroke = setpoints.stroke_length
    if stroke < assump.stroke_length_min_m or stroke > assump.stroke_length_max_m:
        clamped_stroke = max(assump.stroke_length_min_m, min(assump.stroke_length_max_m, stroke))
        warnings.append(f"Stroke length {stroke} m clamped to [{assump.stroke_length_min_m}, {assump.stroke_length_max_m}] m.")
        stroke = clamped_stroke

    spm = setpoints.spm
    if spm < assump.spm_min or spm > assump.spm_max:
        clamped_spm = max(assump.spm_min, min(assump.spm_max, spm))
        warnings.append(f"SPM {spm} clamped to mechanical bounds [{assump.spm_min}, {assump.spm_max}].")
        spm = clamped_spm

    vfd = setpoints.vfd_hz
    if vfd < assump.vfd_hz_min or vfd > assump.vfd_hz_max:
        clamped_vfd = max(assump.vfd_hz_min, min(assump.vfd_hz_max, vfd))
        warnings.append(f"VFD frequency {vfd} Hz clamped to [{assump.vfd_hz_min}, {assump.vfd_hz_max}] Hz.")
        vfd = clamped_vfd

    clamped_sp = SrpSetpoints(
        stroke_length=stroke,
        spm=spm,
        vfd_hz=vfd,
    )
    return clamped_sp, warnings
