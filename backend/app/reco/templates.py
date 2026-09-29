"""
OIL-TWIN AI - Engineering Rationale Templates
Translates mathematical and ML optimization deltas into domain-specific, explainable reasoning.
"""


def format_srp_reasoning(
    current_spm: float,
    proposed_spm: float,
    viscosity_cp: float,
    diagnosis: str,
    stress_pct: float,
) -> list[str]:
    """Generates explainable rationale for SRP setpoint modifications."""
    reasons = []

    if diagnosis == "rod_floating" and proposed_spm < current_spm:
        reasons.append(
            f"Lowering pumping speed from {current_spm:.1f} to {proposed_spm:.1f} SPM reduces downstroke viscous drag "
            f"in heavy crude ({viscosity_cp:.0f} cP), eliminating rod floating and mitigating carrier bar impact shock."
        )
    elif stress_pct > 80.0 and proposed_spm < current_spm:
        reasons.append(
            f"Reducing SPM from {current_spm:.1f} to {proposed_spm:.1f} brings Goodman cyclic rod stress "
            f"from {stress_pct:.1f}% down to within the safe 80% endurance threshold."
        )
    elif proposed_spm > current_spm and diagnosis == "normal":
        reasons.append(
            f"Increasing pumping speed to {proposed_spm:.1f} SPM safely capitalizes on low fluid viscosity "
            f"to boost daily drawdown and liquid extraction without exceeding rod stress limits."
        )
    else:
        reasons.append(
            "Adjusting stroke length and VFD frequency optimizes pump fillage and energy efficiency (kWh/bbl)."
        )

    return reasons


def format_css_reasoning(
    current_steam: float,
    proposed_steam: float,
    current_sor: float,
    proposed_sor: float,
    soak_days: float,
) -> list[str]:
    """Generates explainable rationale for CSS parameter modifications."""
    reasons = []

    if proposed_steam < current_steam:
        reasons.append(
            f"Trimming steam volume from {current_steam:.0f} t to {proposed_steam:.0f} t avoids severe diminishing returns "
            f"in near-wellbore thermal retention, reducing Steam-Oil Ratio (SOR) from {current_sor:.2f} to {proposed_sor:.2f}."
        )
    elif proposed_steam > current_steam:
        reasons.append(
            f"Increasing steam volume to {proposed_steam:.0f} t expands the thermal radius in Jodhpur sandstone, "
            f"significantly thinning heavy crude to sustain flowing bottom-hole pressure."
        )

    if soak_days > 12.0:
        reasons.append(
            "Limiting soak period to 8 days prevents unnecessary conductive heat dissipation into adjacent overburden."
        )

    return reasons


def format_joint_reasoning(
    oil_uplift_bbl: float,
    sor_delta: float,
    kwh_delta: float,
    primary_driver: str,
) -> list[str]:
    """Generates explainable rationale for coupled joint optimizations."""
    reasons = [
        (f"Joint CSS+SRP tuning achieves an expected net uplift of {oil_uplift_bbl:+.1f} bbl/day "
        f"while lowering field energy intensity by {kwh_delta:+.1f} kWh/bbl.")
    ]
    if sor_delta < 0:
        reasons.append(
            f"Synchronized steam volume and drawdown rate reduces cycle Steam-Oil Ratio by {abs(sor_delta):.2f} m3/m3."
        )
    reasons.append(
        f"Primary optimization mechanism: {primary_driver.replace('_', ' ').title()}."
    )
    return reasons
