"""
OIL-TWIN AI - Demo Data Seeder
Populates database with realistic initial states for Baghewala Field demonstration:
1. Well BW-01: Steady early-cycle production (hot ~175 C, high rate)
2. Well BW-02: Mid-cycle production with rising rod stress
3. Well BW-03: DEMO WELL - Late-cycle cool heavy oil with rod floating
4. Well BW-04: Active steam injection (day 5, 140 bar)
5. Well BW-05: Soak phase with sensor dropout
6. Well BW-06: Production with joint CSS+SRP optimization opportunity
7. Well BW-07: Late-cycle high water cut (91%) and high SOR
8. Well BW-08: Idle / turnaround
"""
import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.connectors.simulated import default_data_source
from app.db.models import AlertModel, AuditEventModel, WellModel
from app.db.session import async_session_factory, init_db


async def seed():
    print("[SEED] Initializing database schema...")
    await init_db()

    async with async_session_factory() as session:
        print("[SEED] Seeding wells metadata from simulator...")
        wells = await default_data_source.get_wells()

        for w in wells:
            existing = await session.get(WellModel, w.id)
            if not existing:
                well_db = WellModel(
                    id=w.id,
                    name=w.name,
                    status=w.status,
                    css_cycle_phase=w.css_cycle_phase,
                    cycle_number=w.cycle_number,
                )
                session.add(well_db)

        # Seed initial alerts from live simulation
        print("[SEED] Seeding active alerts...")
        for w in wells:
            state = await default_data_source.get_well_state(w.id)
            for a in state.active_alerts:
                existing_alert = await session.get(AlertModel, a.id)
                if not existing_alert:
                    session.add(
                        AlertModel(
                            id=a.id,
                            well_id=a.well_id,
                            severity=a.severity,
                            kind=a.kind,
                            probability=a.probability,
                            time_to_event_hrs=a.time_to_event_hrs,
                            message=a.message,
                            acknowledged=a.acknowledged,
                            created_at=a.created_at,
                        )
                    )

        # Seed initial system audit event
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        session.add(
            AuditEventModel(
                id="AUD-SYSTEM-INIT",
                well_id=None,
                event_type="SYSTEM_BOOTSTRAP",
                details_json={"message": "OIL-TWIN AI seeded with 10 Baghewala demo wells"},
                created_at=now_iso,
            )
        )

        await session.commit()
        print(f"[SEED] Successfully seeded {len(wells)} wells and operational alerts.")


if __name__ == "__main__":
    asyncio.run(seed())
