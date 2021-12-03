import {
  AnyEventObject,
  createMachine,
  EventObject,
  interpret,
  Typestate,
  Interpreter,
  assign,
  MachineConfig,
  MachineOptions,
  ActionObject
} from "xstate";
import { Model } from "xstate/lib/model.types";

const getCreepsNearResource = (source: Source, creep: Creep) => {
  let creepsAroundResource1 = source.pos
    .findInRange(FIND_MY_CREEPS, 2)
    .filter(creepsAround => creepsAround.id !== creep.id);
  let creepsAroundResource2 = source.pos
    .findInRange(FIND_MY_CREEPS, 0)
    .filter(creepsAround => creepsAround.id !== creep.id);

  return creepsAroundResource1.length + creepsAroundResource2.length;
};

Creep.prototype.log = function (message: string, limitName?: string) {
  if (limitName && limitName == this.name) {
    console.log(`${this.name}: ${message}`);
  }
  if (!limitName) {
    console.log(`${this.name}: ${message}`);
  }
};

const getNextClosestResource = (creep: Creep): Source | null => {
  let forgetTarget: Source[] | null = null;
  if (creep.memory.seekTimeout == Game.time) {
    creep.memory.forgetTarget = [];
  }
  if (creep.memory.forgetTarget) {
    if (typeof creep.memory.forgetTarget == "string") {
      creep.memory.forgetTarget = [creep.memory.forgetTarget];
    }
    forgetTarget = creep.memory.forgetTarget?.map((target: Id<Source>): Source => {
      return Game.getObjectById(target) as Source;
    });
    // console.log(`${creep.name} list of forget target ${JSON.stringify(forgetTarget.map(target => target.id))}`);
  }

  let availableResources = creep.room.find(FIND_SOURCES, {
    filter: source => {
      // check if source is in forgetTarget
      if (forgetTarget) {
        // console.log(`${creep.name} is checking if ${source.id} is available`);
        return !forgetTarget.includes(source) && source.energy > 0;
      }
      return true;
    }
  });

  // console.log(`${creep.name} has ${availableResources.length} available resources`);

  // create map for resource with number of creeps near resource
  let resourceMap = new Map<Source, [number, number]>();
  for (const resource of availableResources) {
    const range = creep.pos.getRangeTo(resource);
    const creepsNearResource = getCreepsNearResource(resource, creep);
    resourceMap.set(resource, [range, creepsNearResource]);
  }

  // sort resources by range and creeps near resource
  let sortedResources = Array.from(resourceMap.entries()).sort((a, b) => {
    if (a[1][0] === b[1][0]) {
      return a[1][1] - b[1][1];
    }
    return a[1][0] - b[1][0];
  });

  // get key of first item in sortedResources
  let closestResource = sortedResources[0] ? sortedResources[0][0] : null;

  if (closestResource) {
    let cachedWalkableLocationsMap = global.roomSources.find(sources => sources.id == closestResource!.id);
    if (sortedResources[0][1][1] >= (cachedWalkableLocationsMap?.walkableLocations?.length || 0)) {
      // check if closest exist on forget target before pushing to array
      if (!creep.memory.forgetTarget?.includes(closestResource.id)) {
        creep.memory.forgetTarget?.push(closestResource.id);
      }
      closestResource = null;
    }
  }

  return closestResource;
};

const setCreepTimeout = (creep: Creep, timeout: number) => {
  if (!creep.memory.seekTimeout || (creep.memory.seekTimeout && creep.memory.seekTimeout < Game.time)) {
    creep.memory.seekTimeout = Game.time + timeout;
  }
};

const harvest = (creep: Creep) => {
  // TODO: while harvesting stop checking source , remember source every tick

  let source = getNextClosestResource(creep);
  // check if creep is harvesting energy from source
  if (source && creep.harvest(source) == ERR_NOT_IN_RANGE) {
    // get range to source
    const range = creep.pos.getRangeTo(source);
    creep.say(range ? range.toString() : "🔍");
    if (range == 2) {
      setCreepTimeout(creep, 10);
    }
    if (source) {
      // console.log(`${creep.name} is harvesting from ${source.id}`);
      creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
      return true;
    }
  }
  setCreepTimeout(creep, 10);

  return false;
};

const transfer = (creep: Creep) => {
  type TransferTarget = StructureExtension | StructureStorage | StructureSpawn | StructureTower;
  const targets = creep.room.find(FIND_STRUCTURES, {
    filter: structure => {
      return (
        (structure.structureType == STRUCTURE_EXTENSION ||
          structure.structureType == STRUCTURE_SPAWN ||
          structure.structureType == STRUCTURE_TOWER ||
          structure.structureType == STRUCTURE_STORAGE) &&
        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      );
    }
  });

  let target = null;

  // if creep role is not harvester do this
  if (creep.memory.role !== "harvester") {
    // get energy and capacity of all targets
    let targetsRatio = targets.map(target => {
      return {
        value: target.id,
        structureType: target.structureType,
        ratio:
          (target as TransferTarget).store.getUsedCapacity(RESOURCE_ENERGY) /
          (target as TransferTarget).store.getCapacity(RESOURCE_ENERGY)
      };
    });

    // remove storage fro targetsRatio
    targetsRatio = targetsRatio.filter(target => target.structureType !== STRUCTURE_STORAGE);

    // sort targets by ratio
    targetsRatio.sort((a, b) => {
      return a.ratio - b.ratio;
    });

    // get game object of target with lowest ratio
    if (targetsRatio && targetsRatio.length > 0) {
      target = Game.getObjectById(targetsRatio[0].value) as TransferTarget;
    }
  } else {
    // get room storage as target for transfer
    target = creep.room.storage;

    // if target is null get spawn as target
    if (!target) {
      target = creep.room.find(FIND_STRUCTURES, {
        filter: structure => {
          return structure.structureType == STRUCTURE_SPAWN;
        }
      })[0] as StructureSpawn;
    }
  }

  if (target) {
    if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
    }
  }
};

const build = (creep: Creep) => {
  let targets = creep.room.find(FIND_CONSTRUCTION_SITES);
  if (targets.length) {
    if (creep.build(targets[0]) == ERR_NOT_IN_RANGE) {
      creep.moveTo(targets[0], { visualizePathStyle: { stroke: "#ffffff" } });
      return true;
    }
  }
  return false;
};

const repair = (creep: Creep) => {
  let targets = creep.room.find(FIND_STRUCTURES, {
    filter: structure => {
      return (
        (structure.structureType == STRUCTURE_EXTENSION ||
          structure.structureType == STRUCTURE_SPAWN ||
          structure.structureType == STRUCTURE_TOWER ||
          structure.structureType == STRUCTURE_WALL ||
          structure.structureType == STRUCTURE_ROAD ||
          structure.structureType == STRUCTURE_STORAGE) &&
        structure.hits < structure.hitsMax
      );
    }
  });
  // sort targets by hits
  targets.sort((a, b) => {
    return a.hits - b.hits;
  });
  if (targets.length) {
    if (creep.repair(targets[0]) == ERR_NOT_IN_RANGE) {
      creep.moveTo(targets[0], { visualizePathStyle: { stroke: "#ffffff" } });
      return true;
    }
  }
  return false;
};

const withdraw = (creep: Creep) => {
  // find ruins in room and try to harvest them
  let ruins = creep.room.find(FIND_RUINS);
  // get ruin that has > 0 energy
  let ruin = ruins.find(ruin => ruin.store.getUsedCapacity(RESOURCE_ENERGY) > 0);
  if (ruin) {
    // try to withdraw from ruin
    creep.say("🔍");
    if (creep.withdraw(ruin, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
      creep.moveTo(ruin, { visualizePathStyle: { stroke: "#ffffff" } });
    }
  }
};

const harvestStorage = (creep: Creep) => {
  // check if there are harvester creeps in room
  let harvesters = creep.room.find(FIND_MY_CREEPS, {
    filter: creep => {
      return creep.memory.role === "harvester";
    }
  });
  // if there are no harvesters in room
  if (harvesters.length < 3) {
    harvest(creep);
  } else {
    let storage = creep.room.storage;
    if (storage) {
      if (creep.withdraw(storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
        creep.moveTo(storage, { visualizePathStyle: { stroke: "#ffffff" } });
      }
    }
  }
};

const getWalkableLocations = (source: Source) => {
  // check terrain around source and return locations that are walkable at range 1
  let terrain = source.room.lookForAtArea(
    LOOK_TERRAIN,
    source.pos.y - 1,
    source.pos.x - 1,
    source.pos.y + 1,
    source.pos.x + 1,
    true
  );
  // get locations that are walkable
  return terrain.filter(location => location.terrain !== "wall");
};

const useCreepMachine = <
  TContext extends object,
  TEvent extends EventObject = AnyEventObject,
  TState extends Typestate<TContext> = { value: any; context: TContext }
>(
  creepState: TContext extends Model<any, any, any, any>
    ? "Model type no longer supported as generic type. Please use `model.createMachine(...)` instead."
    : MachineConfig<TContext, any, TEvent>,
  creepActions: Partial<MachineOptions<TContext, TEvent>>,
  creep: Creep
): [string, Interpreter<TContext, any, TEvent, TState>["send"], Interpreter<TContext, any, TEvent, TState>] => {
  const globalObject = global.creepStates[creep.name];
  let service: Interpreter<TContext, any, TEvent, TState>;
  if (!globalObject) {
    creepState.context = creep.memory.context;
    const stateMachine = createMachine<TContext, TEvent, TState>(creepState, creepActions);
    service = interpret(stateMachine)
      .onTransition(state => {
        if (state.changed) {
          creep.memory.state = state.value as string;
        }
      })
      .start(creep.memory.state ?? stateMachine.initialState.value) as unknown as Interpreter<
      TContext,
      any,
      TEvent,
      TState
    >;
    global.creepStates[creep.name] = service as unknown as Interpreter<
      unknown,
      any,
      AnyEventObject,
      { value: any; context: unknown }
    >;
  } else {
    service = globalObject as unknown as Interpreter<TContext, any, TEvent, TState>;
  }

  return [creep.memory.state ?? (creepState.initial as string), service.send, service];
};

// set creep.memory.target
// set creep.memory.task = 0 -> to, 1 -> back // might not need

const creepState = {
  id: "creep",
  initial: "idle",
  states: {
    idle: {
      entry: "doIdle",
      on: {
        SEARCH: "searching"
      }
    },
    searching: {
      entry: "doSearch",
      always: [
        { target: "moving", cond: "targetFound" },
        { target: "idle", actions: assign({ from: "searching" }) }
      ]
    },
    moving: {
      entry: "doMove",
      always: [
        {
          target: "idle",
          actions: assign({ from: "moving" }),
          cond: "targetFull"
        },
        { target: "working", cond: "targetReached" }
      ],
      on: {
        WORK: { target: "working", cond: "targetReached" }
      }
    },
    working: {
      entry: "doWork",
      always: [
        {
          target: "idle",
          actions: assign({ from: "working" }),
          cond: "taskDone"
        }
      ],
      on: {
        DONE: {
          target: "idle",
          actions: assign({ from: "working" }),
          cond: "taskDone"
        }
      }
    }
  }
};
const creepActions = {
  actions: {
    doIdle(context: CreepContext, event: EventObject) {
      // If idle for some tick reset state
      // creep.memory.target = null
      // creep.memory.task = 0
      console.log("doIdle", context, JSON.stringify(event));
    },
    doSearch() {
      // if creep.memory.target != null  return

      // Check if getFreeCapacity() > 0
      // creep.memory.task = 0
      // source - Check if availableResources > 0
      // ruins - ruin.store.getUsedCapacity(RESOURCE_ENERGY) > 0
      // structures - construction sites

      // Check if getFreeCapacity() == 0
      // creep.memory.task = 1
      // tower
      // spawn
      // buildables

      // Set creep.memory.target = source
      console.log("doSearch");
    },
    doMove(context: CreepContext, event: EventObject) {
      // if target is range == 0 return
      // else creep.moveTo
      console.log("doMove", context, JSON.stringify(event));
    },
    doWork() {
      // if target is range == 0 do -> work

      // creep.memory.task 0 / role
      // harvest, -> creep.store.getFreeCapacity() > 0
      // withdraw, -> ruin.store.getUsedCapacity(RESOURCE_ENERGY) > 0

      // creep.memory.task 1 / role
      // upgrade, -> creep.store.getFreeCapacity() == 0
      // transfer -> creep.store.getFreeCapacity() == 0
      // repair,  -> creep.store.getFreeCapacity() == 0
      // build,  -> creep.store.getFreeCapacity() == 0

      // if conditions above NOT met creep.memory.target = null
      console.log("doWork");
    }
  },
  guards: {
    targetFound() {
      // creep.memory.target is not null
      // and creep.memory.seekTimeout != Game.time -> move
      return true;
    },
    targetReached() {
      // check if target is in range -> true work
      return true;
    },
    targetFull() {
      // check if target range is <= 3
      // set creep.memory.seekTimeout = Game.time + timeout

      return false;
    },
    taskDone() {
      // check if creep.memory.target == null
      return false;
    }
  }
};

const update = (creep: Creep) => {
  let [state, send] = useCreepMachine(creepState, creepActions, creep);

  if (!global.roomSources) {
    // get all source in room
    const sources = creep.room.find(FIND_SOURCES);
    // create array for sources with walkable locations
    global.roomSources = sources.map(source => {
      return {
        id: source.id,
        walkableLocations: getWalkableLocations(source).map(location => ({
          x: location.x,
          y: location.y
        }))
      };
    });
  }

  switch (state) {
    case "idle":
      send("SEARCH");
      break;
    case "moving":
      send("WORK");
      break;
    case "working":
      send("DONE");
      break;
  }
};

export default {
  update
};
