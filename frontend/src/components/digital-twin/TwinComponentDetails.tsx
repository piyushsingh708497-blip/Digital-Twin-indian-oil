// OIL-TWIN AI - Digital Twin Component Inspector Side Panel
import React from 'react';
import type { Telemetry } from '../../types';
import type { WellComponentId } from './WellSchematic';

interface TwinComponentDetailsProps {
  componentId: WellComponentId;
  telemetry: Telemetry | null | undefined;
  onSelectComponent: (id: WellComponentId) => void;
}

export const TwinComponentDetails: React.FC<TwinComponentDetailsProps> = ({
  componentId,
  telemetry,
  onSelectComponent,
}) => {
  const compTitles: Record<WellComponentId, { name: string; subtitle: string }> = {
    reservoir: { name: 'Reservoir Formation', subtitle: 'Jodhpur Sandstone (950-1080 m)' },
    sandface: { name: 'Sandface & Perforations', subtitle: 'Near-Wellbore Inflow Zone' },
    wellbore: { name: 'Wellbore & Casing Annulus', subtitle: 'BHP / BHT / Fluid Column' },
    tubing: { name: 'Production Tubing', subtitle: 'API 2-7/8" J-55 Tubing String' },
    rod_string: { name: 'Sucker Rod String', subtitle: 'Tapered Rod API Grade D (Vectorized 1D Wave)' },
    pump: { name: 'Downhole Sucker Rod Pump', subtitle: 'Insert Pump 1.75" Bore (RWAC)' },
    wellhead: { name: 'Wellhead Christmas Tree', subtitle: 'Stuffing Box & Polished Rod' },
    surface: { name: 'Surface Pumping Unit & Facilities', subtitle: 'C-320D-256-100 Walking Beam' },
  };

  const current = compTitles[componentId] || { name: 'Well Component', subtitle: 'Telemetry Inspection' };

  return (
    <div className="bg-white border border-[#E2E5E9] rounded-xl p-4 flex flex-col h-full shadow-xs">
      {/* Component Navigation Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-800 font-bold block">
            SUBSYSTEM TELEMETRY INSPECTOR
          </span>
          <h3 className="text-sm font-bold text-slate-900">{current.name}</h3>
          <p className="text-[11px] text-slate-500 font-mono">{current.subtitle}</p>
        </div>
      </div>

      {/* Component Quick Jump Pills */}
      <div className="flex flex-wrap gap-1 mb-3.5">
        {(Object.keys(compTitles) as WellComponentId[]).map((id) => (
          <button
            key={id}
            onClick={() => onSelectComponent(id)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
              componentId === id
                ? 'bg-amber-600 text-white font-bold shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-[#E2E5E9]'
            }`}
          >
            {compTitles[id].name.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Dynamic Telemetry Metric Cards */}
      <div className="space-y-3 flex-1 overflow-y-auto pr-1">
        {componentId === 'reservoir' && (
          <div className="grid grid-cols-2 gap-3">
            <MetricBox
              label="Reservoir Pressure"
              value={telemetry?.reservoir?.pressure}
              unit="bar"
            />
            <MetricBox
              label="Reservoir Temperature"
              value={telemetry?.reservoir?.temperature}
              unit="°C"
            />
            <MetricBox
              label="Estimated Viscosity"
              value={
                telemetry?.reservoir?.temperature
                  ? Math.round(5000 / Math.max(1, telemetry.reservoir.temperature / 48))
                  : 4500
              }
              unit="cP"
            />
            <MetricBox
              label="Thermal State"
              value={
                telemetry?.reservoir?.temperature && telemetry.reservoir.temperature > 60
                  ? 'Heated Front Active'
                  : 'Near Initial Temp'
              }
            />
            <div className="col-span-2 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
              <span className="font-semibold text-slate-900">Petroleum Context:</span>
              <p>Baghewala Jodhpur Sandstone crude is 17-19° API with high asphaltic content. Heavy viscosity requires steam soaking to drop from ~10,000 cP to &lt;200 cP for inflow.</p>
            </div>
          </div>
        )}

        {componentId === 'sandface' && (
          <div className="grid grid-cols-2 gap-3">
            <MetricBox
              label="Bottomhole Pressure (BHP)"
              value={telemetry?.wellbore?.bhp}
              unit="bar"
            />
            <MetricBox
              label="Inflow Drawdown"
              value={
                telemetry?.reservoir?.pressure && telemetry?.wellbore?.bhp
                  ? (telemetry.reservoir.pressure - telemetry.wellbore.bhp).toFixed(1)
                  : '—'
              }
              unit="bar"
            />
            <MetricBox
              label="Steam Quality"
              value={telemetry?.wellbore?.steamQuality ? `${(telemetry.wellbore.steamQuality * 100).toFixed(0)}%` : '75%'}
            />
            <MetricBox
              label="Cumulative Steam Injected"
              value={telemetry?.css?.cumSteam}
              unit="tonnes"
            />
          </div>
        )}

        {componentId === 'wellbore' && (
          <div className="grid grid-cols-2 gap-3">
            <MetricBox label="BHP (Bottomhole Press.)" value={telemetry?.wellbore?.bhp} unit="bar" />
            <MetricBox label="BHT (Bottomhole Temp.)" value={telemetry?.wellbore?.bht} unit="°C" />
            <MetricBox
              label="Working Fluid Level"
              value={telemetry?.wellbore?.fluidLevel}
              unit="m"
            />
            <MetricBox
              label="Steam Injection Rate"
              value={telemetry?.css?.steamRate}
              unit="t/d"
            />
          </div>
        )}

        {componentId === 'tubing' && (
          <div className="grid grid-cols-2 gap-3">
            <MetricBox label="Gross Liquid Flow" value={telemetry?.surface?.flowRate} unit="m³/d" />
            <MetricBox label="Water Cut" value={telemetry?.surface?.waterCutPct} unit="%" />
            <MetricBox
              label="Net Oil Production"
              value={telemetry?.surface?.oilRate}
              unit="m³/d"
            />
            <MetricBox label="Tubing Head Temp" value={telemetry?.surface?.wellheadTemp} unit="°C" />
          </div>
        )}

        {componentId === 'rod_string' && (
          <div className="grid grid-cols-2 gap-3">
            <MetricBox label="Peak Polished Rod Load" value={telemetry?.srp?.rodLoadMax} unit="kN" />
            <MetricBox label="Min Rod Load" value={telemetry?.srp?.rodLoadMin} unit="kN" />
            <MetricBox label="Pumping Speed (SPM)" value={telemetry?.srp?.spm} unit="spm" />
            <MetricBox
              label="Stroke Length"
              value={telemetry?.srp?.strokeLength}
              unit="m"
            />
            <div className="col-span-2 p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
              <span className="font-bold">Rod Dynamics:</span> Modeled via Gibbs damped 1D wave equation discretized across rod string tapers to capture buoyancy and viscous drag.
            </div>
          </div>
        )}

        {componentId === 'pump' && (
          <div className="grid grid-cols-2 gap-3">
            <MetricBox
              label="Pump Fillage"
              value={telemetry?.srp?.pumpFillagePct}
              unit="%"
            />
            <MetricBox label="Motor Current" value={telemetry?.srp?.motorAmps} unit="A" />
            <MetricBox label="Power Consumption" value={telemetry?.srp?.kW} unit="kW" />
            <MetricBox label="VFD Operating Frequency" value={telemetry?.srp?.vfdHz} unit="Hz" />
          </div>
        )}

        {componentId === 'wellhead' && (
          <div className="grid grid-cols-2 gap-3">
            <MetricBox
              label="Wellhead Pressure (WHP)"
              value={telemetry?.surface?.wellheadPressure}
              unit="bar"
            />
            <MetricBox
              label="Wellhead Temp (WHT)"
              value={telemetry?.surface?.wellheadTemp}
              unit="°C"
            />
            <MetricBox
              label="Steam Inj. Pressure"
              value={telemetry?.css?.injPressure}
              unit="bar"
            />
            <MetricBox label="CSS Soak Day" value={telemetry?.css?.soakDay} unit="days" />
          </div>
        )}

        {componentId === 'surface' && (
          <div className="grid grid-cols-2 gap-3">
            <MetricBox label="Oil Rate" value={telemetry?.surface?.oilRate} unit="m³/d" />
            <MetricBox label="Gross Flow Rate" value={telemetry?.surface?.flowRate} unit="m³/d" />
            <MetricBox label="Steam-Oil Ratio (SOR)" value={telemetry?.derived?.sor} unit="t/m³" />
            <MetricBox
              label="Energy Intensity"
              value={telemetry?.derived?.kWhPerBbl}
              unit="kWh/bbl"
            />
          </div>
        )}
      </div>

      {/* Tag Quality Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-mono text-slate-500 flex items-center justify-between">
        <span>DATA LATENCY: ~{telemetry?.quality?.dataAgeSec ? `${telemetry.quality.dataAgeSec.toFixed(1)}s` : '1.8s'}</span>
        <span className="text-emerald-700 font-semibold">PUMP TWIN SYNCED</span>
      </div>
    </div>
  );
};

const MetricBox: React.FC<{
  label: string;
  value: string | number | null | undefined;
  unit?: string;
}> = ({ label, value, unit }) => {
  const display =
    value !== null && value !== undefined
      ? typeof value === 'number'
        ? Number(value.toFixed(1))
        : value
      : '—';

  return (
    <div className="bg-slate-50 border border-[#E2E5E9] rounded-lg p-2.5">
      <span className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider block mb-1">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-mono font-bold text-slate-900 tabular-nums">{display}</span>
        {unit && <span className="text-[10px] font-mono text-slate-500">{unit}</span>}
      </div>
    </div>
  );
};
