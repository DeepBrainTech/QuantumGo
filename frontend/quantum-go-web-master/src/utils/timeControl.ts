// Time control utilities adapted from govariants time_control_systems
// Implemented in a lightweight way for the frontend to render clocks

export enum TimeControlType {
  None = 'none',
  Absolute = 'absolute',
  Simple = 'simple',
  Fischer = 'fischer',
  ByoYomi = 'byoyomi',
}

export interface ITimeControlBaseConfig {
  type: TimeControlType;
  mainTimeMS: number; // milliseconds
}

export interface IFischerConfig extends ITimeControlBaseConfig {
  type: TimeControlType.Fischer;
  incrementMS: number;
  maxTimeMS: number | null;
}

export interface IByoYomiConfig extends ITimeControlBaseConfig {
  type: TimeControlType.ByoYomi;
  numPeriods: number;
  periodTimeMS: number;
}


export type AnyTimeConfig =
  | ITimeControlBaseConfig // Absolute
  | IFischerConfig
  | IByoYomiConfig
  | ({ type: TimeControlType.Simple } & ITimeControlBaseConfig);

export interface IBasicTimeState {
  remainingTimeMS: number;
}

export interface IByoYomiState {
  mainTimeRemainingMS: number;
  periodsRemaining: number;
  periodTimeRemainingMS: number;
}


export type AnyClockState = IBasicTimeState | IByoYomiState;

export interface PerPlayerClock {
  clockState: AnyClockState;
  onThePlaySince: number | null; // timestamp ms when became active
}

export interface TimeControlRuntime {
  forPlayer: Record<'black' | 'white', PerPlayerClock>;
  lastMoveAtMS: number | null;
  config: AnyTimeConfig | null;
}

export function msToTime(totalMS: number): string {
  const ms = Math.max(0, Math.floor(totalMS));
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

// Clocks
export const Clocks = {
  initialState(config: AnyTimeConfig): AnyClockState {
    switch (config.type) {
      case TimeControlType.Absolute:
      case TimeControlType.Simple:
      case TimeControlType.Fischer:
        return { remainingTimeMS: config.mainTimeMS } as IBasicTimeState;
      case TimeControlType.ByoYomi: {
        const c = config as IByoYomiConfig;
        return {
          mainTimeRemainingMS: c.mainTimeMS,
          periodsRemaining: c.numPeriods,
          periodTimeRemainingMS: c.periodTimeMS,
        } as IByoYomiState;
      }
      default:
        return { remainingTimeMS: 0 };
    }
  },

  elapse(config: AnyTimeConfig, state: AnyClockState, elapsedMS: number): AnyClockState {
    switch (config.type) {
      case TimeControlType.Absolute:
      case TimeControlType.Simple:
      case TimeControlType.Fischer: {
        const s = state as IBasicTimeState;
        return { remainingTimeMS: s.remainingTimeMS - elapsedMS };
      }
      case TimeControlType.ByoYomi: {
        const c = config as IByoYomiConfig;
        let s = { ...(state as IByoYomiState) };
        if (s.mainTimeRemainingMS) {
          if (s.mainTimeRemainingMS >= elapsedMS) {
            s.mainTimeRemainingMS -= elapsedMS;
            return s;
          }
          elapsedMS -= s.mainTimeRemainingMS;
          s.mainTimeRemainingMS = 0;
        }
        if (s.periodTimeRemainingMS > elapsedMS) {
          s.periodTimeRemainingMS -= elapsedMS;
          return s;
        }
        elapsedMS -= s.periodTimeRemainingMS;
        const remainder = elapsedMS % c.periodTimeMS;
        const q = (elapsedMS - remainder) / c.periodTimeMS;
        const periodsUsed = q + 1;
        s.periodsRemaining = Math.max(0, s.periodsRemaining - periodsUsed);
        s.periodTimeRemainingMS = s.periodsRemaining === 0 ? 0 : c.periodTimeMS - remainder;
        return s;
      }
    }
    // Default: no change
    return { ...(state as any) };
  },

  renew(config: AnyTimeConfig, state: AnyClockState): AnyClockState {
    switch (config.type) {
      case TimeControlType.Simple:
        return { remainingTimeMS: config.mainTimeMS } as IBasicTimeState;
      case TimeControlType.Fischer: {
        const c = config as IFischerConfig;
        const s = state as IBasicTimeState;
        const uncapped = s.remainingTimeMS + c.incrementMS;
        const remainingTimeMS = c.maxTimeMS === null ? uncapped : Math.min(uncapped, c.maxTimeMS);
        return { remainingTimeMS } as IBasicTimeState;
      }
      case TimeControlType.ByoYomi: {
        const c = config as IByoYomiConfig;
        const s = state as IByoYomiState;
        return { ...s, periodTimeRemainingMS: c.periodTimeMS } as IByoYomiState;
      }
      case TimeControlType.Absolute:
      default:
        return { ...(state as any) };
    }
  },

  msUntilTimeout(config: AnyTimeConfig, state: AnyClockState): number {
    switch (config.type) {
      case TimeControlType.Absolute:
      case TimeControlType.Simple:
      case TimeControlType.Fischer:
        return (state as IBasicTimeState).remainingTimeMS;
      case TimeControlType.ByoYomi: {
        const c = config as IByoYomiConfig;
        const s = state as IByoYomiState;
        const fullPeriodsRemaining = s.periodsRemaining - 1;
        return (
          s.mainTimeRemainingMS + s.periodTimeRemainingMS + fullPeriodsRemaining * c.periodTimeMS
        );
      }
    }
    return 0;
  },

  timeString(config: AnyTimeConfig, state: AnyClockState): string {
    switch (config.type) {
      case TimeControlType.Absolute:
      case TimeControlType.Simple:
      case TimeControlType.Fischer:
        return msToTime((state as IBasicTimeState).remainingTimeMS);
      case TimeControlType.ByoYomi: {
        const c = config as IByoYomiConfig;
        const s = state as IByoYomiState;
        const periodTimeString = `${msToTime(s.periodTimeRemainingMS)} (${s.periodsRemaining})`;
        if (s.mainTimeRemainingMS > 0) {
          return `${msToTime(s.mainTimeRemainingMS)} + ${periodTimeString}`;
        }
        return periodTimeString;
      }
    }
    return msToTime(0);
  },
};

export function initRuntime(config: AnyTimeConfig | null): TimeControlRuntime {
  const defaultConfig: AnyTimeConfig = config ?? { type: TimeControlType.None, mainTimeMS: 0 };
  const forPlayer: TimeControlRuntime['forPlayer'] = {
    black: {
      clockState: Clocks.initialState(defaultConfig),
      onThePlaySince: null,
    },
    white: {
      clockState: Clocks.initialState(defaultConfig),
      onThePlaySince: null,
    },
  };
  return { forPlayer, lastMoveAtMS: null, config: config ?? null };
}

export function startTurn(rt: TimeControlRuntime, side: 'black' | 'white', nowMS: number) {
  if (!rt.config || rt.config.type === TimeControlType.None) return;
  rt.forPlayer[side].onThePlaySince = nowMS;
}

export function finishMove(rt: TimeControlRuntime, side: 'black' | 'white', nowMS: number) {
  if (!rt.config || rt.config.type === TimeControlType.None) return;
  const p = rt.forPlayer[side];
  if (p.onThePlaySince != null) {
    const elapsed = nowMS - p.onThePlaySince;
    const afterElapse = Clocks.elapse(rt.config, p.clockState, elapsed);
    p.clockState = Clocks.renew(rt.config, afterElapse);
    p.onThePlaySince = null;
  }
  rt.lastMoveAtMS = nowMS;
}

export function currentMsUntilTimeout(rt: TimeControlRuntime, side: 'black' | 'white', nowMS: number): number | null {
  if (!rt.config || rt.config.type === TimeControlType.None) return null;
  const p = rt.forPlayer[side];
  if (p.onThePlaySince == null) return null;
  const elapsed = nowMS - p.onThePlaySince;
  const afterElapse = Clocks.elapse(rt.config, p.clockState, elapsed);
  return Clocks.msUntilTimeout(rt.config, afterElapse);
}

export function displayString(rt: TimeControlRuntime, side: 'black' | 'white', nowMS: number): string {
  if (!rt.config || rt.config.type === TimeControlType.None) return '';
  const p = rt.forPlayer[side];
  const state = p.onThePlaySince == null
    ? p.clockState
    : Clocks.elapse(rt.config, p.clockState, nowMS - p.onThePlaySince);
  return Clocks.timeString(rt.config, state);
}
