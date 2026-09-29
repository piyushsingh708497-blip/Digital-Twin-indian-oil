"""
OIL-TWIN AI - Seed-Driven Deterministic Random Number Management
Ensures identical simulation and ML outputs when initialized with the same SEED.
"""
import numpy as np


class SimulatorRNG:
    """Manages deterministic pseudorandom number generators per well and subsystem."""

    def __init__(self, master_seed: int = 42):
        self.master_seed = master_seed
        self.master_rng = np.random.RandomState(master_seed)

    def get_well_rng(self, well_index: int) -> np.random.RandomState:
        """Derive an independent, deterministic RNG for a given well index."""
        well_seed = (self.master_seed * 10007 + well_index * 389 + 17) % (2**31 - 1)
        return np.random.RandomState(well_seed)

    def get_subsystem_rng(self, subsystem_name: str, well_index: int = 0) -> np.random.RandomState:
        """Derive a named subsystem RNG (e.g. 'noise', 'dyno', 'events')."""
        name_hash = sum(ord(c) * (31**i) for i, c in enumerate(subsystem_name)) % 1000003
        sub_seed = (self.master_seed * 10007 + well_index * 389 + name_hash) % (2**31 - 1)
        return np.random.RandomState(sub_seed)
