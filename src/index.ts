/**
 * Improved converter library with bidirectional support, better hooks, and enhanced error handling
 *
 * This library provides a flexible and robust way to convert objects from one type to another.
 * It supports bidirectional conversion, hooks for pre and post-processing, and comprehensive error handling.
 *
 * @module @doeixd/createConverter
 */

import { deepmerge as deepMerge } from 'deepmerge-ts';

/**
 * Logger interface for providing custom logging capabilities
 *
 * @interface Logger
 */
export interface Logger {
  /**
   * Log a debug message
   * @param {string} message - The message to log
   * @param {...any[]} args - Additional arguments to include in the log
   */
  debug: (message: string, ...args: any[]) => void;

  /**
   * Log an info message
   * @param {string} message - The message to log
   * @param {...any[]} args - Additional arguments to include in the log
   */
  info: (message: string, ...args: any[]) => void;

  /**
   * Log a warning message
   * @param {string} message - The message to log
   * @param {...any[]} args - Additional arguments to include in the log
   */
  warn: (message: string, ...args: any[]) => void;

  /**
   * Log an error message
   * @param {string} message - The message to log
   * @param {...any[]} args - Additional arguments to include in the log
   */
  error: (message: string, ...args: any[]) => void;
}

/**
 * Default no-op logger implementation
 *
 * This logger performs no operations and is useful when logging is not required.
 *
 * @constant {Logger} noopLogger
 * @example
 * const logger = noopLogger;
 * logger.debug("This won't log"); // Does nothing
 */
export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/**
 * Error types for the converter system
 *
 * Enumerates the possible error categories that may occur during conversion.
 *
 * @enum {string} ConverterErrorType
 */
export enum ConverterErrorType {
  /** Indicates an invalid source object */
  INVALID_SOURCE = 'INVALID_SOURCE',

  /** Indicates an invalid field name */
  INVALID_FIELD = 'INVALID_FIELD',

  /** Indicates an error during field conversion */
  FIELD_CONVERSION = 'FIELD_CONVERSION',

  /** Indicates an error during object conversion */
  OBJECT_CONVERSION = 'OBJECT_CONVERSION',

  /** Indicates an error in a pre-hook */
  PRE_HOOK = 'PRE_HOOK',

  /** Indicates an error in a post-hook */
  POST_HOOK = 'POST_HOOK',

  /** Indicates a validation error */
  VALIDATION = 'VALIDATION',
}

/**
 * Custom error class for converter-related errors
 *
 * Provides additional context about conversion errors, such as the error type and affected field.
 *
 * @class ConverterError
 * @extends {Error}
 */
export class ConverterError extends Error {
  /** @type {ConverterErrorType} The type of error */
  type: ConverterErrorType;

  /** @type {any} [source] The source object that caused the error (optional) */
  source?: any;

  /** @type {string} [fieldName] The field name related to the error (optional) */
  fieldName?: string;

  /** @type {Error} [originalError] The original error that triggered this one (optional) */
  originalError?: Error;

  /**
   * Creates a new ConverterError instance
   *
   * @param {string} message - The error message
   * @param {ConverterErrorType} type - The type of error
   * @param {Object} [options] - Additional error details
   * @param {any} [options.source] - The source object causing the error
   * @param {string} [options.fieldName] - The field name involved
   * @param {Error} [options.originalError] - The original error
   * @example
   * throw new ConverterError('Invalid input', ConverterErrorType.INVALID_SOURCE, { source: {} });
   */
  constructor(
    message: string,
    type: ConverterErrorType,
    options?: { source?: any; fieldName?: string; originalError?: Error }
  ) {
    super(message);
    this.name = 'ConverterError';
    this.type = type;
    this.source = options?.source;
    this.fieldName = options?.fieldName;
    this.originalError = options?.originalError;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConverterError);
    }
  }
}

/**
 * Represents a generic object with string keys and any values
 *
 * @typedef {Record<string, any>} GenericObject
 */
export type GenericObject = Record<string, any>;

/**
 * Specialized Array class for holding multiple converted objects
 *
 * Ensures the primary object is valid and allows additional objects to be stored.
 *
 * @class Many
 * @template T
 * @extends {Array<T>}
 */
export class Many<T> extends Array<T> {
  /**
   * Creates a new Many instance
   *
   * @param {T} og - The primary converted object
   * @param {...T[]} rest - Additional converted objects
   * @throws {ConverterError} If the primary object is undefined or null
   * @example
   * const many = new Many({ id: 1 }, { id: 2 });
   * console.log(many); // [{ id: 1 }, { id: 2 }]
   */
  constructor(og: T, ...rest: T[]) {
    super();
    if (og === undefined || og === null) {
      throw new ConverterError(
        'Primary converted object cannot be undefined or null',
        ConverterErrorType.INVALID_SOURCE
      );
    }
    rest = Array.isArray(rest[0]) ? (rest[0] as unknown as T[]) : rest;
    this.push(og, ...rest);
  }
}

/**
 * Function type for converting a single field
 *
 * Defines how a field is transformed from the source to the target object.
 *
 * @typedef {function} FieldFunction
 * @template FromObj - Source object type
 * @template Ctx - Context object type
 * @template ToObj - Target object type
 * @template T - Field value type
 * @param {FromObj} fromObj - The source object
 * @param {Ctx} ctx - The context object
 * @param {Partial<ToObj>} toObj - The partially converted target object
 * @returns {Promise<T> | T} The converted field value
 * @example
 * const upperCaseName: FieldFunction = (from) => from.name.toUpperCase();
 */
export type FieldFunction<
  FromObj extends GenericObject = GenericObject,
  Ctx extends GenericObject = GenericObject,
  ToObj extends GenericObject = GenericObject,
  T = any
> = (fromObj: FromObj, ctx: Ctx, toObj: Partial<ToObj>) => Promise<T> | T;

/**
 * Function type for transforming an entire object
 *
 * Defines how the source object is transformed into the target object.
 *
 * @typedef {function} ObjectFunction
 * @template FromObj - Source object type
 * @template ToObj - Target object type
 * @template Ctx - Context object type
 * @param {FromObj} fromObj - The source object
 * @param {Ctx} ctx - The context object
 * @param {Partial<ToObj>} toObj - The partially converted target object
 * @returns {Promise<Partial<ToObj> | void> | Partial<ToObj> | void} The transformed object or void
 */
export type ObjectFunction<
  FromObj extends GenericObject = GenericObject,
  ToObj extends GenericObject = GenericObject,
  Ctx extends GenericObject = GenericObject
> = (
  fromObj: FromObj,
  ctx: Ctx,
  toObj: Partial<ToObj>
) => Promise<Partial<ToObj> | void> | Partial<ToObj> | void;

/**
 * Function type for pre/post-processing hooks
 *
 * Hooks can modify the conversion process or add additional objects.
 *
 * @typedef {function} HookFunction
 * @template FromObj - Source object type
 * @template ToObj - Target object type
 * @template Ctx - Context object type
 * @param {Ctx} ctx - The context object
 * @param {FromObj} fromObj - The source object
 * @param {Partial<ToObj>} toObj - The partially converted target object
 * @param {AddFunction} add - Function to add additional objects
 * @returns {Promise<void> | void} A promise or void
 * @example
 * const logHook: HookFunction = (ctx, from, to) => console.log(from);
 */
export type HookFunction<
  FromObj extends GenericObject = GenericObject,
  ToObj extends GenericObject = GenericObject,
  Ctx extends GenericObject = GenericObject
> = (
  ctx: Ctx,
  fromObj: FromObj,
  toObj: Partial<ToObj>,
  add: AddFunction
) => Promise<void> | void;

/**
 * Function type for adding additional objects to the conversion result
 *
 * @typedef {function} AddFunction
 * @param {...GenericObject[]} args - Objects to add
 * @returns {GenericObject[]} The list of additional objects
 */
export type AddFunction = (...args: GenericObject[]) => GenericObject[];

/**
 * Merge strategy function for combining objects
 *
 * Controls how partial objects are merged into the target object.
 *
 * @typedef {function} MergeStrategy
 * @template T - Target object type
 * @param {Partial<T>} target - The target object
 * @param {Partial<T>} source - The source object to merge
 * @returns {T} The merged object
 */
export type MergeStrategy<T extends GenericObject = GenericObject> = <U extends T>(
  target: Partial<U>,
  source: Partial<U>
) => U;

/**
 * Default merge strategy using deepMerge
 *
 * Performs a deep merge of the source into the target object.
 *
 * @constant {MergeStrategy} defaultMergeStrategy
 * @example
 * const merged = defaultMergeStrategy({ a: 1 }, { b: 2 });
 * console.log(merged); // { a: 1, b: 2 }
 */
export const defaultMergeStrategy: MergeStrategy = <T extends GenericObject>(
  target: Partial<T>,
  source: Partial<T>
): T => {
  return deepMerge(target, source) as T;
};

/**
 * Built-in field transformers for common operations
 *
 * Provides utility functions for transforming data during conversion.
 *
 * @namespace transforms
 */
export const transforms = {
  /**
   * Transforms a string to uppercase
   * @param {string} value - The string to transform
   * @returns {string} The uppercase string
   * @example
   * transforms.toUpperCase('hello'); // 'HELLO'
   */
  toUpperCase: (value: string) => value?.toUpperCase?.() ?? value,

  /**
   * Transforms a string to lowercase
   * @param {string} value - The string to transform
   * @returns {string} The lowercase string
   * @example
   * transforms.toLowerCase('HELLO'); // 'hello'
   */
  toLowerCase: (value: string) => value?.toLowerCase?.() ?? value,

  /**
   * Trims whitespace from a string
   * @param {string} value - The string to trim
   * @returns {string} The trimmed string
   * @example
   * transforms.trim('  hello  '); // 'hello'
   */
  trim: (value: string) => value?.trim?.() ?? value,

  /**
   * Parses a string to an integer
   * @param {string | number} value - The value to parse
   * @returns {number | undefined} The parsed integer or undefined if invalid
   * @example
   * transforms.toInteger('123'); // 123
   */
  toInteger: (value: string | number) => {
    if (typeof value === 'number') return Math.floor(value);
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  },

  /**
   * Parses a string to a float
   * @param {string | number} value - The value to parse
   * @returns {number | undefined} The parsed float or undefined if invalid
   * @example
   * transforms.toFloat('123.45'); // 123.45
   */
  toFloat: (value: string | number) => {
    if (typeof value === 'number') return value;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  },

  /**
   * Converts a value to a boolean
   * @param {any} value - The value to convert
   * @returns {boolean} The boolean value
   * @example
   * transforms.toBoolean('true'); // true
   */
  toBoolean: (value: any) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      return lower === 'true' || lower === 'yes' || lower === '1';
    }
    return Boolean(value);
  },

  /**
   * Formats a date to an ISO string
   * @param {Date | string | number} value - The date value to format
   * @returns {string | undefined} The ISO string or undefined if invalid
   * @example
   * transforms.toISODate('2023-01-01'); // '2023-01-01T00:00:00.000Z'
   */
  toISODate: (value: Date | string | number) => {
    if (!value) return undefined;
    try {
      const date = value instanceof Date ? value : new Date(value);
      return date.toISOString();
    } catch (e) {
      return undefined;
    }
  },

  /**
   * Picks specified properties from an object
   * @param {string[]} keys - The keys to pick
   * @returns {function} A function that picks keys from an object
   * @example
   * const pickFn = transforms.pick(['id']);
   * pickFn({ id: 1, name: 'John' }); // { id: 1 }
   */
  pick: (keys: string[]) => (obj: GenericObject) => {
    if (!obj) return undefined;
    return Object.fromEntries(
      keys.filter((key) => key in obj).map((key) => [key, obj[key]])
    );
  },

  /**
   * Omits specified properties from an object
   * @param {string[]} keys - The keys to omit
   * @returns {function} A function that omits keys from an object
   * @example
   * const omitFn = transforms.omit(['name']);
   * omitFn({ id: 1, name: 'John' }); // { id: 1 }
   */
  omit: (keys: string[]) => (obj: GenericObject) => {
    if (!obj) return undefined;
    return Object.fromEntries(
      Object.entries(obj).filter(([key]) => !keys.includes(key))
    );
  },

  /**
   * Provides a default value if the input is undefined or null
   * @template T
   * @param {T} defaultVal - The default value
   * @returns {function} A function returning the default if input is undefined/null
   * @example
   * const defaultFn = transforms.defaultValue('N/A');
   * defaultFn(undefined); // 'N/A'
   */
  defaultValue: <T>(defaultVal: T) => (value: T) =>
    value === undefined || value === null ? defaultVal : value,

  /**
   * Maps an array using a transformation function
   * @template T, R
   * @param {(item: T, index: number) => R} fn - The transformation function
   * @returns {function} A function that maps the array
   * @example
   * const mapFn = transforms.mapArray((x) => x * 2);
   * mapFn([1, 2, 3]); // [2, 4, 6]
   */
  mapArray: <T, R>(fn: (item: T, index: number) => R) => (arr: T[]) =>
    Array.isArray(arr) ? arr.map(fn) : undefined,

  /**
   * Filters an array using a predicate function
   * @template T
   * @param {(item: T, index: number) => boolean} fn - The predicate function
   * @returns {function} A function that filters the array
   * @example
   * const filterFn = transforms.filterArray((x) => x > 1);
   * filterFn([1, 2, 3]); // [2, 3]
   */
  filterArray: <T>(fn: (item: T, index: number) => boolean) => (arr: T[]) =>
    Array.isArray(arr) ? arr.filter(fn) : undefined,

  /**
   * Joins an array into a string with a separator
   * @param {string} [separator=','] - The separator to use
   * @returns {function} A function that joins the array
   * @example
   * const joinFn = transforms.joinArray('-');
   * joinFn(['a', 'b', 'c']); // 'a-b-c'
   */
  joinArray: (separator = ',') => (arr: any[]) =>
    Array.isArray(arr) ? arr.join(separator) : undefined,
};

/**
 * Interface for validating partial objects
 *
 * Defines methods to check for required fields in a partial object.
 *
 * @interface PartialValidator
 * @template T
 */
export interface PartialValidator<T extends GenericObject> {
  /**
   * Validates if all required fields are present
   * @param {Partial<T>} obj - The partial object to validate
   * @param {(keyof T)[]} requiredFields - List of required fields
   * @returns {string[]} List of missing fields
   */
  validateRequired: (obj: Partial<T>, requiredFields: (keyof T)[]) => string[];

  /**
   * Checks if all required fields are present
   * @param {Partial<T>} obj - The partial object to check
   * @param {(keyof T)[]} requiredFields - List of required fields
   * @returns {boolean} True if all fields are present, false otherwise
   */
  isComplete: (obj: Partial<T>, requiredFields: (keyof T)[]) => boolean;
}

/**
 * Creates a validator for partial objects
 *
 * Returns an object with methods to validate required fields.
 *
 * @function createPartialValidator
 * @template T
 * @returns {PartialValidator<T>} The partial validator
 * @example
 * const validator = createPartialValidator<{ id: number; name: string }>();
 * validator.validateRequired({ id: 1 }, ['id', 'name']); // ['name']
 */
export function createPartialValidator<T extends GenericObject>(): PartialValidator<T> {
  return {
    validateRequired: (obj, requiredFields) =>
      requiredFields
        .filter((field) => obj[field] === undefined || obj[field] === null)
        .map((field) => String(field)),
    isComplete: (obj, requiredFields) =>
      requiredFields.every(
        (field) => obj[field] !== undefined && obj[field] !== null
      ),
  };
}

/**
 * Definition function type for configuring a converter
 *
 * Used to register field converters, object transformers, and hooks.
 *
 * @typedef {function} ConverterDefinition
 * @template FromObj - Source object type
 * @template ToObj - Target object type
 * @template Ctx - Context object type
 * @param {function} field - Registers a field converter
 * @param {function} obj - Registers an object transformer
 * @param {function} pre - Registers a pre-hook
 * @param {function} post - Registers a post-hook
 * @param {AddFunction} add - Adds additional objects
 * @param {Partial<ToObj>} toObjDefaults - Default target object values
 * @param {Ctx} ctx - The context object
 */
export type ConverterDefinition<
  FromObj extends GenericObject,
  ToObj extends GenericObject,
  Ctx extends GenericObject
> = (
  field: <K extends keyof ToObj>(
    name: K,
    fn: FieldFunction<FromObj, Ctx, ToObj, ToObj[K]>,
    options?: { required?: boolean }
  ) => void,
  obj: (fn: ObjectFunction<FromObj, ToObj, Ctx>, executeFns?: boolean) => void,
  pre: (fn: HookFunction<FromObj, ToObj, Ctx>, name?: string) => void,
  post: (fn: HookFunction<FromObj, ToObj, Ctx>, name?: string) => void,
  add: AddFunction,
  toObjDefaults: Partial<ToObj>,
  ctx: Ctx
) => void;

/**
 * Options for configuring a converter
 *
 * @interface ConverterOptions
 * @template ToObj - Target object type
 * @template Ctx - Context object type
 */
export interface ConverterOptions<ToObj extends GenericObject, Ctx extends GenericObject> {
  /** @type {Partial<ToObj>} [defaults] Default values for the target object */
  defaults?: Partial<ToObj>;

  /** @type {Ctx} [context] The context object */
  context?: Ctx;

  /** @type {MergeStrategy<ToObj>} [mergeStrategy] Strategy for merging objects */
  mergeStrategy?: MergeStrategy<ToObj>;

  /** @type {Logger} [logger] Logger for logging messages */
  logger?: Logger;

  /** @type {(keyof ToObj)[]} [requiredFields] List of required fields */
  requiredFields?: (keyof ToObj)[];

  /** @type {'throw' | 'warn' | 'ignore'} [errorHandling] Error handling strategy */
  errorHandling?: 'throw' | 'warn' | 'ignore';
}

/**
 * Interface for bidirectional converters
 *
 * Defines methods for converting between two object types in both directions.
 *
 * @interface BidirectionalConverter
 * @template A - First object type
 * @template B - Second object type
 */
export interface BidirectionalConverter<A extends GenericObject, B extends GenericObject> {
  /**
   * Converts from A to B
   * @param {A} fromObj - The source object
   * @returns {Promise<B | Many<B>>} The converted object(s)
   */
  forward: (fromObj: A) => Promise<B | Many<B>>;

  /**
   * Converts from B to A
   * @param {B} fromObj - The source object
   * @returns {Promise<A | Many<A>>} The converted object(s)
   */
  reverse: (fromObj: B) => Promise<A | Many<A>>;
}

/**
 * Creates a reusable converter function
 *
 * Main entry point for defining and using converters with custom logic and options.
 *
 * @function createConverter
 * @template FromObj - Source object type
 * @template ToObj - Target object type
 * @template Ctx - Context object type
 * @param {ConverterDefinition<FromObj, ToObj, Ctx>} [fn] - Converter definition function
 * @param {ConverterOptions<ToObj, Ctx>} [options] - Configuration options
 * @returns {(fromObj: FromObj, additionalCtx?: Partial<Ctx>) => Promise<ToObj | Many<ToObj>>} The converter function
 * @example
 * // Define a simple converter
 * const convert = createConverter<{ name: string }, { name: string }>((field) => {
 *   field('name', (from) => from.name.toUpperCase(), { required: true });
 * }, { requiredFields: ['name'] });
 *
 * // Use the converter
 * async function example() {
 *   const result = await convert({ name: 'john' });
 *   console.log(result); // { name: 'JOHN' }
 * }
 */
export function createConverter<
  FromObj extends GenericObject,
  ToObj extends GenericObject,
  Ctx extends GenericObject = GenericObject
>(
  fn: ConverterDefinition<FromObj, ToObj, Ctx> = () => {},
  options: ConverterOptions<ToObj, Ctx> = {}
): (fromObj: FromObj, additionalCtx?: Partial<Ctx>) => Promise<ToObj | Many<ToObj>> {
  const {
    defaults = {} as Partial<ToObj>,
    context = {} as Ctx,
    mergeStrategy = defaultMergeStrategy,
    logger = noopLogger,
    requiredFields = [],
    errorHandling = 'throw',
  } = options;

  const validator = createPartialValidator<ToObj>();
  const fieldFns: [keyof ToObj, FieldFunction<FromObj, Ctx, ToObj, any>, { required?: boolean }][] = [];
  const objectFns: [ObjectFunction<FromObj, ToObj, Ctx>, boolean][] = [];
  const preHooks: [HookFunction<FromObj, ToObj, Ctx>, string][] = [];
  const postHooks: [HookFunction<FromObj, ToObj, Ctx>, string][] = [];
  const additional: GenericObject[] = [];

  const add = (...args: GenericObject[]): GenericObject[] => {
    additional.push(...args.map((v) => mergeStrategy<ToObj>({ ...defaults } as Partial<ToObj>, v as Partial<ToObj>)));
    return additional;
  };

  const field = <K extends keyof ToObj>(
    name: K,
    _fn: FieldFunction<FromObj, Ctx, ToObj, ToObj[K]>,
    options: { required?: boolean } = {}
  ): void => {
    logger.debug(`Registering field converter: ${String(name)}`);
    if (name === undefined || name === null || name === '') {
      throw new ConverterError(
        'Invalid field name: Field name cannot be empty',
        ConverterErrorType.INVALID_FIELD
      );
    }
    fieldFns.push([name, _fn, options]);
  };

  const obj = (_fn: ObjectFunction<FromObj, ToObj, Ctx>, executeFns = true): void => {
    logger.debug('Registering object converter');
    if (typeof _fn !== 'function') {
      throw new ConverterError(
        'Invalid object function: Must be a function',
        ConverterErrorType.OBJECT_CONVERSION
      );
    }
    objectFns.push([_fn, executeFns]);
  };

  const pre = (_fn: HookFunction<FromObj, ToObj, Ctx>, name = _fn.name || 'anonymous'): void => {
    logger.debug(`Registering pre-hook: ${name}`);
    if (typeof _fn !== 'function') {
      throw new ConverterError(
        'Invalid pre-hook: Must be a function',
        ConverterErrorType.PRE_HOOK
      );
    }
    preHooks.push([_fn, name]);
  };

  const post = (_fn: HookFunction<FromObj, ToObj, Ctx>, name = _fn.name || 'anonymous'): void => {
    logger.debug(`Registering post-hook: ${name}`);
    if (typeof _fn !== 'function') {
      throw new ConverterError(
        'Invalid post-hook: Must be a function',
        ConverterErrorType.POST_HOOK
      );
    }
    postHooks.push([_fn, name]);
  };

  fn(field, obj, pre, post, add, defaults, context);
  logger.info('Converter initialized with configuration', {
    fieldCount: fieldFns.length,
    objectCount: objectFns.length,
    preHookCount: preHooks.length,
    postHookCount: postHooks.length,
    requiredFields,
  });

  return async (fromObj: FromObj, additionalCtx: Partial<Ctx> = {}): Promise<ToObj | Many<ToObj>> => {
    if (typeof fromObj !== 'object' || fromObj === null) {
      const error = new ConverterError(
        'Source object must be a non-null object',
        ConverterErrorType.INVALID_SOURCE,
        { source: fromObj }
      );
      if (errorHandling === 'throw') throw error;
      logger.error(error.message, { source: fromObj });
      return { ...defaults } as ToObj;
    }

    const workingCtx = { ...context, ...additionalCtx } as Ctx;
    additional.length = 0;
    let newObj = { ...defaults } as Partial<ToObj>;

    try {
      for (const [hook, name] of preHooks) {
        logger.debug(`Executing pre-hook: ${name}`);
        try {
          await hook(workingCtx, fromObj, newObj, add);
        } catch (err) {
          const error = new ConverterError(
            `Error in pre-hook '${name}': ${(err as Error).message}`,
            ConverterErrorType.PRE_HOOK,
            { source: fromObj, originalError: err as Error }
          );
          if (errorHandling === 'throw') throw error;
          logger.error(error.message, { hook: name, error: err });
        }
      }

      for (const [name, fn, options] of fieldFns) {
        logger.debug(`Converting field: ${String(name)}`);
        try {
          const result = await fn(fromObj, workingCtx, { ...newObj });
          newObj = mergeStrategy<ToObj>(newObj, { [name]: result } as Partial<ToObj>);
        } catch (err) {
          const error = new ConverterError(
            `Error converting field '${String(name)}': ${(err as Error).message}`,
            ConverterErrorType.FIELD_CONVERSION,
            { source: fromObj, fieldName: String(name), originalError: err as Error }
          );
          if (errorHandling === 'throw') throw error;
          logger.error(error.message, { field: name, error: err });
        }
      }

      for (const [fn, executeFns] of objectFns) {
        logger.debug('Executing object function');
        try {
          const result = await fn(fromObj, workingCtx, { ...newObj });
          if (typeof result === 'object' && result !== null) {
            if (executeFns) {
              // Use Record<string, any> to allow indexing with string keys
              const clone: Record<string, any> = { ...result };
              for (const [key, value] of Object.entries(result)) {
                if (typeof value === 'function')
                  clone[key] = await (value as any)(fromObj, workingCtx, { ...newObj });
              }
              newObj = mergeStrategy<ToObj>(newObj, clone as Partial<ToObj>);
            } else {
              newObj = mergeStrategy<ToObj>(newObj, result as Partial<ToObj>);
            }
          }
        } catch (err) {
          const error = new ConverterError(
            `Error in object function: ${(err as Error).message}`,
            ConverterErrorType.OBJECT_CONVERSION,
            { source: fromObj, originalError: err as Error }
          );
          if (errorHandling === 'throw') throw error;
          logger.error(error.message, { error: err });
        }
      }

      for (const [hook, name] of postHooks) {
        logger.debug(`Executing post-hook: ${name}`);
        try {
          await hook(workingCtx, fromObj, newObj, add);
        } catch (err) {
          const error = new ConverterError(
            `Error in post-hook '${name}': ${(err as Error).message}`,
            ConverterErrorType.POST_HOOK,
            { source: fromObj, originalError: err as Error }
          );
          if (errorHandling === 'throw') throw error;
          logger.error(error.message, { hook: name, error: err });
        }
      }

      if (requiredFields.length > 0) {
        const missingFields = validator.validateRequired(newObj, requiredFields as (keyof ToObj)[]);
        if (missingFields.length > 0) {
          const error = new ConverterError(
            `Missing required fields: ${missingFields.join(', ')}`,
            ConverterErrorType.VALIDATION,
            { source: fromObj }
          );
          if (errorHandling === 'throw') throw error;
          logger.error(error.message, { missingFields });
        }
      }

      if (additional.length > 0) {
        logger.info('Conversion complete with additional objects', { count: additional.length + 1 });
        return new Many<ToObj>(newObj as ToObj, ...(additional as ToObj[]));
      }
      logger.info('Conversion complete');
      return newObj as ToObj;
    } catch (err) {
      logger.error('Conversion failed', { error: err });
      throw err;
    }
  };
}