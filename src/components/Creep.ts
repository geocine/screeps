const getTargetResource = (creep: Creep): Source | null => {
  let forgetTarget: Source | null = null;
  if (creep.memory.forgetTarget) {
    forgetTarget = Game.getObjectById(creep.memory.forgetTarget);
  }
  let closestResource = creep.room.find(FIND_SOURCES, {
    filter: source => {
      return source.id !== forgetTarget?.id;
    }
  });

  if (closestResource.length) {
    // check if closestResource[0] is visible or reachable
    // const inRange = creep.pos.inRangeTo(closestResource[0], 3);
    // creep.say(inRange ? "🔍" : "🔎");
    if (closestResource[0]) {
      let creepsAroundResource = getCreepsNearResource(closestResource[0], creep);
      // creep.say("around " + creepsAroundResource);
      if (creepsAroundResource > 2) {
        creep.say("🔄 forgetting");
        creep.memory.forgetTarget = closestResource[0].id;
      }
      return closestResource[0];
    }
  }
  return null;
};

const getCreepsNearResource = (source: Source, creep: Creep) => {
  let creepsAroundResource1 = source.pos
    .findInRange(FIND_MY_CREEPS, 2)
    .filter(creepsAround => creepsAround.id !== creep.id);
  let creepsAroundResource2 = source.pos
    .findInRange(FIND_MY_CREEPS, 0)
    .filter(creepsAround => creepsAround.id !== creep.id);

  return creepsAroundResource1.length + creepsAroundResource2.length;
};

const harvest = (creep: Creep) => {
  let source = getTargetResource(creep);
  // check if creep is harvesting
  let out = null;
  if (source) {
    out = creep.harvest(source);
    // creep say status
    creep.say(out.toString());
  }
  if (source && out == ERR_NOT_IN_RANGE) {
    // get range to source
    const range = creep.pos.getRangeTo(source);
    creep.say(range ? range.toString() : "🔍");
    const num = getCreepsNearResource(source, creep);
    if (range == 2 || num > 2) {
      source = getTargetResource(creep);
    }
    if (source) {
      creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
    }
  }
};

const loop = (creep: Creep) => {
  // harvester logic
  if (creep.memory.role === "harvester") {
    if (creep.store.getFreeCapacity() > 0) {
      harvest(creep);
    } else {
      const targets = creep.room.find(FIND_STRUCTURES, {
        filter: structure => {
          return (
            (structure.structureType == STRUCTURE_EXTENSION ||
              structure.structureType == STRUCTURE_SPAWN ||
              structure.structureType == STRUCTURE_TOWER) &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
          );
        }
      });
      if (targets.length > 0) {
        if (creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          creep.moveTo(targets[0], { visualizePathStyle: { stroke: "#ffffff" } });
        }
      }
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
      let targets = creep.room.find(FIND_CONSTRUCTION_SITES);
      if (targets.length) {
        if (creep.build(targets[0]) == ERR_NOT_IN_RANGE) {
          creep.moveTo(targets[0], { visualizePathStyle: { stroke: "#ffffff" } });
        }
      }
    } else {
      harvest(creep);
    }
  }
};

export default {
  loop
};
