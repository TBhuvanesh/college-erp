"use client";

import { Lock, Unlock } from "lucide-react";
import { RoomSeatingChart, SeatAllocation, departmentColorClasses } from "@/lib/seating";

interface SeatingChartGridProps {
  chart: RoomSeatingChart;
  interactive?: boolean;
  selectedSeatId?: string | null;
  highlightSeatId?: string | null;
  onSeatClick?: (seat: SeatAllocation) => void;
  onToggleLock?: (seat: SeatAllocation) => void;
}

/**
 * Renders a room's seats grouped by bench when geometry is known, or a flat
 * grid (legacy flat-capacity rooms) otherwise. Teacher desk shown at top to
 * match the classroom's real physical orientation.
 */
export function SeatingChartGrid({
  chart,
  interactive = false,
  selectedSeatId = null,
  highlightSeatId = null,
  onSeatClick,
  onToggleLock,
}: SeatingChartGridProps) {
  const seatsByBench = new Map<number, SeatAllocation[]>();
  const hasGeometry = !!chart.benchType;

  if (hasGeometry) {
    for (const seat of chart.seats) {
      const bench = seat.benchNumber ?? seat.seatNumber;
      if (!seatsByBench.has(bench)) seatsByBench.set(bench, []);
      seatsByBench.get(bench)!.push(seat);
    }
  }

  const columns = chart.columns ?? 4;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center">
        <div className="px-6 py-1.5 rounded-full bg-neutral-800 dark:bg-neutral-700 text-white text-[10px] font-bold uppercase tracking-wider">
          Teacher&apos;s Desk
        </div>
      </div>

      {chart.seats.length === 0 ? (
        <div className="text-center py-12 text-text-muted text-xs border border-dashed border-border-subtle rounded-xl">
          No seats allocated for this room yet.
        </div>
      ) : hasGeometry ? (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.min(columns, 6)}, minmax(0, 1fr))` }}
        >
          {Array.from(seatsByBench.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([benchNumber, seats]) => (
              <div
                key={benchNumber}
                className="rounded-xl border-2 border-border-subtle bg-background p-2 flex flex-col gap-1"
              >
                <span className="text-[8px] font-extrabold text-text-muted uppercase text-center">
                  Bench {benchNumber}
                </span>
                <div className="flex gap-1">
                  {seats
                    .sort((a, b) => (a.seatPosition ?? "").localeCompare(b.seatPosition ?? ""))
                    .map((seat) => (
                      <SeatCell
                        key={seat.id}
                        seat={seat}
                        interactive={interactive}
                        selected={selectedSeatId === seat.id}
                        highlighted={highlightSeatId === seat.id}
                        onClick={onSeatClick}
                        onToggleLock={onToggleLock}
                      />
                    ))}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {chart.seats
            .sort((a, b) => a.seatNumber - b.seatNumber)
            .map((seat) => (
              <SeatCell
                key={seat.id}
                seat={seat}
                interactive={interactive}
                selected={selectedSeatId === seat.id}
                highlighted={highlightSeatId === seat.id}
                onClick={onSeatClick}
                onToggleLock={onToggleLock}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function SeatCell({
  seat,
  interactive,
  selected,
  highlighted,
  onClick,
  onToggleLock,
}: {
  seat: SeatAllocation;
  interactive: boolean;
  selected: boolean;
  highlighted: boolean;
  onClick?: (seat: SeatAllocation) => void;
  onToggleLock?: (seat: SeatAllocation) => void;
}) {
  const deptClasses = departmentColorClasses(seat.departmentColor);

  return (
    <div
      onClick={() => interactive && onClick?.(seat)}
      className={`relative flex-1 p-2 rounded-lg border text-center flex flex-col items-center justify-center gap-0.5 transition-all ${deptClasses} ${
        interactive ? "cursor-pointer hover:scale-[1.03]" : ""
      } ${selected ? "ring-2 ring-accent-blue ring-offset-1" : ""} ${
        highlighted ? "ring-2 ring-emerald-500 ring-offset-1 scale-105" : ""
      }`}
      title={`${seat.rollNumber} — ${seat.studentName} (${seat.subjectCode})`}
    >
      {seat.isLocked && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock?.(seat);
          }}
          className="absolute -top-1.5 -right-1.5 bg-neutral-800 text-white rounded-full p-0.5 shadow"
          title="Locked — click to unlock"
        >
          <Lock size={9} />
        </button>
      )}
      {!seat.isLocked && interactive && onToggleLock && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock(seat);
          }}
          className="absolute -top-1.5 -right-1.5 opacity-0 hover:opacity-100 group-hover:opacity-60 bg-neutral-400 text-white rounded-full p-0.5 shadow transition-opacity"
          title="Lock this seat"
        >
          <Unlock size={9} />
        </button>
      )}
      <span className="text-[8px] font-bold uppercase opacity-80">
        {seat.seatPosition ? `${seat.seatPosition}` : `Seat ${seat.seatNumber}`}
      </span>
      <span className="text-[11px] font-bold font-mono leading-tight">{seat.rollNumber}</span>
      <span className="text-[8px] font-semibold opacity-80">{seat.departmentCode}</span>
    </div>
  );
}
