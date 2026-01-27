"use client"
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    ResponsiveContainer
} from "recharts"

export default function AuditRadarChart({ data }: { data: any[] }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <PolarAngleAxis
                    dataKey="subject"
                    tick={{
                        fill: "#94a3b8",
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: "0.1em"
                    }}
                />
                <Radar
                    name="Performance"
                    dataKey="A"
                    stroke="#2563eb"
                    strokeWidth={3}
                    fill="#2563eb"
                    fillOpacity={0.15}
                />
            </RadarChart>
        </ResponsiveContainer>
    )
}
