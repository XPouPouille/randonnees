import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { ElevationPoint } from "../types";

interface Props {
  profile: ElevationPoint[];
  onHover?: (point: ElevationPoint | null) => void;
}

export function ElevationChart({ profile, onHover }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart
        data={profile}
        margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
        onMouseMove={(state) => {
          if (!onHover) return;
          const point = state?.activePayload?.[0]?.payload as ElevationPoint | undefined;
          onHover(point ?? null);
        }}
        onMouseLeave={() => onHover?.(null)}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="distance_km"
          tickFormatter={(v: number) => `${v.toFixed(1)} km`}
          type="number"
          domain={["dataMin", "dataMax"]}
        />
        <YAxis unit=" m" width={60} />
        <Tooltip
          formatter={(value: number) => [`${value.toFixed(0)} m`, "Altitude"]}
          labelFormatter={(v: number) => `${v.toFixed(2)} km`}
        />
        <Line type="monotone" dataKey="elevation_m" stroke="#2f7d32" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
