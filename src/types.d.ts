import { AnyEventObject, Interpreter, State } from "xstate";

export {};

declare global {
  // Memory extension samples
  interface Memory {
    uuid: number;
    log: any;
  }

  interface RawMemory {
    _parsed: Memory;
  }

  interface CreepContext {
    from: string;
  }
  interface CreepMemory {
    role: string;
    room?: string;
    working?: boolean;
    forgetTarget?: Id<Source>[];
    seekTimeout?: number;
    state?: string;
    context?: CreepContext;
  }

  interface Creep {
    run(): void;
    log(message: string, limitName?: string): void;
  }

  interface RoomSource {
    id: Id<Source>;
    walkableLocations: { x: number; y: number }[];
  }

  // Syntax for adding proprties to `global` (ex "global.log")
  namespace NodeJS {
    interface Global {
      log: any;
      Memory?: Memory;
      roomSources: RoomSource[];
      creepStates: { [creepId: string]: Interpreter<unknown, any, AnyEventObject, { value: any; context: unknown }> };
    }
  }
}
