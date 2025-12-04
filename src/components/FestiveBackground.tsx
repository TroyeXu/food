'use client';

export default function FestiveBackground() {
  return (
    <div className="festive-bg" aria-hidden="true">
      {/* 底部裝飾線 */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-30" />

      {/* 角落福字裝飾 - 靜態淡化 */}
      <div className="absolute bottom-20 left-4 text-8xl opacity-[0.03] rotate-[-15deg] select-none">
        福
      </div>
      <div className="absolute top-40 right-4 text-7xl opacity-[0.03] rotate-[15deg] select-none">
        春
      </div>
    </div>
  );
}
