# GTA RP Финансы v3.0 — Архитектура

## 📁 Файловая структура

```
gtarp-calc/
├── app.go           # Go бэкенд (file-based storage keyed)
├── main.go          # Wails entry point
├── go.mod / go.sum
├── wails.json
└── frontend/
    ├── index.html   # SPA: 5 tab-pages + modals
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── app.css          # 1200+ lines, full CSS token system
        ├── main.ts          # Orchestrator
        ├── types/index.ts   # All interfaces
        └── modules/
            ├── state.ts      # Reactive store (3 states)
            ├── storage.ts    # localStorage (3 separate keys)
            ├── calculator.ts # Totals, records, DayStats
            ├── render.ts     # Ripple, notifications, animations
            ├── sounds.ts     # Web Audio effects
            ├── dashboard.ts  # Tab 1
            ├── statistics.ts # Tab 2 (NO 5VITO data)
            ├── shift.ts      # Tab 3
            ├── insights.ts   # Tab 4
            └── vito.ts       # Tab 5 — isolated trading terminal
```

## 5VITO Isolation Logic
- `VitoOperation[]` stored in separate `VitoState`  
- Sales add to `currentBalance` (real wallet effect)
- Global Statistics tab filters out all Vito data
- 5VITO tab shows LOCAL stats only

## Run
```
cd frontend && npm install && cd .. && wails dev
```
