import { SourceMapConsumer } from "source-map";
import { escape } from "./Helper";

// Cache consumer
let consumer: SourceMapConsumer = new SourceMapConsumer(require("main.js.map"));
// Cache previously mapped traces to improve performance
const cache: { [key: string]: string } = {};

/**
 * Generates a stack trace using a source map generate original symbol names.
 *
 * WARNING - EXTREMELY high CPU cost for first call after reset - >30 CPU! Use sparingly!
 * (Consecutive calls after a reset are more reasonable, ~0.1 CPU/ea)
 *
 * @param {Error | string} error The error or original stack trace
 * @returns {string} The source-mapped stack trace
 */
const sourceMappedStackTrace = (error: Error | string): string => {
  const stack: string = error instanceof Error ? (error.stack as string) : error;
  if (Object.prototype.hasOwnProperty.call(cache, stack)) {
    return cache[stack];
  }

  const re = /^\s+at\s+(.+?\s+)?\(?([0-z._\-\\\/]+):(\d+):(\d+)\)?$/gm;
  let match: RegExpExecArray | null;
  let outStack = error.toString();

  while ((match = re.exec(stack))) {
    if (match[2] === "main") {
      const pos = consumer.originalPositionFor({
        column: parseInt(match[4], 10),
        line: parseInt(match[3], 10)
      });

      if (pos.line != null) {
        if (pos.name) {
          outStack += `\n    at ${pos.name} (${pos.source}:${pos.line}:${pos.column})`;
        } else {
          if (match[1]) {
            // no original source file name known - use file name from given trace
            outStack += `\n    at ${match[1]} (${pos.source}:${pos.line}:${pos.column})`;
          } else {
            // no original source file name known or in given trace - omit name
            outStack += `\n    at ${pos.source}:${pos.line}:${pos.column}`;
          }
        }
      } else {
        // no known position
        break;
      }
    } else {
      // no more parseable lines
      break;
    }
  }

  cache[stack] = outStack;
  return outStack;
};

const clearMemory = () => {
  // Automatically delete memory of missing creeps
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }
};

// Maybe create a middleware to handle errors?
export const withErrorMapper = (loop: () => void): (() => void) => {
  return () => {
    try {
      clearMemory();
      loop();
    } catch (e) {
      if (e instanceof Error) {
        if ("sim" in Game.rooms) {
          const message = `Source maps don't work in the simulator - displaying original error`;
          console.log(`<span style='color:red'>${message}<br>${escape(e.stack)}</span>`);
        } else {
          console.log(`<span style='color:red'>${escape(sourceMappedStackTrace(e))}</span>`);
        }
      } else {
        // can't handle it
        throw e;
      }
    }
  };
};

export default withErrorMapper;
