const getCreepsNearResource = (source: Source, creep: Creep) => {
  let creepsAroundResource1 = source.pos
    .findInRange(FIND_MY_CREEPS, 2)
    .filter(creepsAround => creepsAround.id !== creep.id);
  let creepsAroundResource2 = source.pos
    .findInRange(FIND_MY_CREEPS, 0)
    .filter(creepsAround => creepsAround.id !== creep.id);

  return creepsAroundResource1.length + creepsAroundResource2.length;
};

const getNextClosestResource = (creep: Creep): Source | null => {
  let forgetTarget: Source[] | null = null;
  if (creep.memory.seekTimeout == Game.time) {
    // check which resource the creep is near to
    let forgetNearestResource = creep.room.find(FIND_SOURCES, {
      filter: source => {
        const range = creep.pos.getRangeTo(source);
        return range == 2;
      }
    });
    if (forgetNearestResource.length > 0) {
      creep.memory.forgetTarget = [forgetNearestResource[0].id];
    } else {
      creep.memory.forgetTarget = [];
    }
  }
  if (creep.memory.forgetTarget) {
    if (typeof creep.memory.forgetTarget == "string") {
      creep.memory.forgetTarget = [creep.memory.forgetTarget];
    }
    forgetTarget = creep.memory.forgetTarget?.map((target: string): Source => {
      return Game.getObjectById(target) as Source;
    });
  }
  let availableResources = creep.room.find(FIND_SOURCES, {
    filter: source => {
      // check if source is in forgetTarget
      if (forgetTarget) {
        return !forgetTarget.includes(source);
      }
      return true;
    }
  });

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

  return closestResource;
};

const setCreepTimeout = (creep: Creep, timeout: number) => {
  if (!creep.memory.seekTimeout || (creep.memory.seekTimeout && creep.memory.seekTimeout < Game.time)) {
    creep.memory.seekTimeout = Game.time + timeout;
  }
};

const harvest = (creep: Creep) => {
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
      creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
      return true;
    }
  }
  setCreepTimeout(creep, 10);

  return false;
};

const transfer = (creep: Creep) => {
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
  if (targets.length > 0) {
    if (creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
      creep.moveTo(targets[0], { visualizePathStyle: { stroke: "#ffffff" } });
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
  let walkableLocations = terrain.filter(location => location.terrain !== "wall");
  return walkableLocations.length;
};

const loop = (creep: Creep) => {
  // harvester logic
  if (creep.memory.role === "harvester") {
    if (creep.store.getFreeCapacity() > 0) {
      if (!harvest(creep)) {
        // get all room sources and get all id
        let sources = creep.room.find(FIND_SOURCES);
        let sourceIds = sources.map(source => source.id);
        creep.memory.forgetTarget = sourceIds;
        withdraw(creep);
      }
    } else {
      transfer(creep);
    }
  }

  // upgrader logic
  if (creep.memory.role === "upgrader") {
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
      creep.memory.working = false;
      creep.say("🔄 harvest");
    }
    if (!creep.memory.working && creep.store.getFreeCapacity() == 0) {
      creep.memory.working = true;
      creep.say("⚡ upgrade");
    }

    if (creep.memory.working && creep.room.controller) {
      if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: "#ffffff" } });
      }
    } else {
      harvest(creep);
    }
  }

  // builder logic
  if (creep.memory.role === "builder") {
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
      creep.memory.working = false;
      creep.say("🔄 harvest");
    }
    if (!creep.memory.working && creep.store.getFreeCapacity() == 0) {
      creep.memory.working = true;
      creep.say("🚧 build");
    }

    if (creep.memory.working) {
      if (!build(creep)) {
        transfer(creep);
      }
    } else {
      harvest(creep);
    }
  }
};

export default {
  loop
};
