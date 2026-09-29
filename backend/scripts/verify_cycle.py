import os
import sys

sys.path.insert(0, os.path.abspath("."))

from app.simulator.reservoir import (
    compute_oil_viscosity_cp,
    compute_reservoir_temperature_decay,
)
from app.simulator.surface import compute_surface_metrics


def run_bw03_cycle():
    steam_inj_rate = 135.0  # t/d
    cum_steam = 0.0
    cum_oil = 0.0
    spm = 6.8
    stroke_m = 3.2
    fillage = 82.0
    peak_temp = 210.0
    soak_days = 8.0

    header = f"{'Day':>4} | {'Phase':>10} | {'BHT(C)':>6} | {'Visc(cP)':>9} | {'Oil(bbl/d)':>10} | {'WC(%)':>6} | {'CumStm(t)':>9} | {'CumOil(m3)':>10} | {'SOR':>5} | {'SPM':>4} | {'Fil(%)':>6}"
    print(header)
    print("-" * len(header))

    sampled_days = [1, 7, 14, 15, 18, 22, 23, 25, 30, 45, 60, 80, 100, 120]

    for day in range(1, 121):
        if day <= 14:
            phase = "injection"
            day_in_inj = day
            cum_steam += steam_inj_rate
            bht = min(240.0, 180.0 + (day_in_inj / 14.0) * 50.0)
            visc = compute_oil_viscosity_cp(bht)
            oil_rate = 0.0
            wc = 100.0
            cur_spm = 0.0
            cur_fil = 0.0
            sor = 0.0
        elif day <= 22:
            phase = "soak"
            soak_day = day - 14
            bht = peak_temp - (soak_day / 8.0) * 25.0
            visc = compute_oil_viscosity_cp(bht)
            oil_rate = 0.0
            wc = 95.0
            cur_spm = 0.0
            cur_fil = 0.0
            sor = 0.0
        else:
            phase = "production"
            prod_day = day - 22
            bht = compute_reservoir_temperature_decay(prod_day + soak_days, peak_temp - 25.0, soak_days)
            visc = compute_oil_viscosity_cp(bht)
            cur_spm = spm
            cur_fil = fillage

            surf = compute_surface_metrics(
                phase="production",
                stroke_length_m=stroke_m,
                spm=cur_spm,
                pump_fillage_pct=cur_fil,
                res_temp_c=bht,
                res_pressure_bar=32.0,
                cum_steam_tonnes=cum_steam,
                cum_oil_m3=cum_oil,
                electric_power_kw=15.0,
                day_in_cycle=prod_day + soak_days,
                soak_days=soak_days,
            )
            oil_rate = surf["oil_rate"]
            wc = surf["water_cut_pct"]
            cum_oil += (oil_rate / 6.2898)
            sor = cum_steam / max(1.0, cum_oil)

        if day in sampled_days:
            print(f"{day:4d} | {phase:>10} | {bht:6.1f} | {visc:9.1f} | {oil_rate:10.1f} | {wc:6.1f} | {cum_steam:9.1f} | {cum_oil:10.1f} | {sor:5.2f} | {cur_spm:4.1f} | {cur_fil:6.1f}")

if __name__ == "__main__":
    run_bw03_cycle()
