# 🔄 Create Converter
[![npm version](https://img.shields.io/npm/v/@doeixd/createConverter.svg)](https://www.npmjs.com/package/@doeixd/createConverter)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.5%2B-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A flexible and robust TypeScript library for converting objects from one type to another with bidirectional support, hooks, and error handling.



## ⚙️ Features

- **Type-safe conversions**: Full TypeScript support for mapping between different object shapes
- **Bidirectional conversion**: Support for converting objects in both directions
- **Pre and post hooks**: Execute code before or after conversion
- **Field-level and object-level transformations**: Granular control over conversion
- **Comprehensive error handling**: Detailed error types and configurable error strategies
- **Validation**: Support for required fields and custom validation
- **Multiple output objects**: Create related objects during conversion
- **Built-in transformers**: Common transformation operations included
- **Flexible context passing**: Share context between transformations
- **Customizable logging**: Detailed logs of the conversion process
- **Result helpers**: Type-safe utilities for working with converter results


## 🔍 Quick Example
```ts
import { createConverter } from '@doeixd/createConverter';

// Define source and target types
interface ApiUser { user_id: string; user_name: string; }
interface AppUser { id: string; name: string; }

// Create a converter
const converter = createConverter<ApiUser, AppUser>((field) => {
  field('id', from => from.user_id);
  field('name', from => from.user_name);
});

// Use the converter
async function example() {
  const apiUser = { user_id: '123', user_name: 'JohnDoe' };
  const appUser = await converter(apiUser);
  console.log(appUser); // { id: '123', name: 'JohnDoe' }
}

```

## 📦 Installation

```bash
npm install @doeixd/createConverter
# or
yarn add @doeixd/createConverter
# or
bun install @doeixd/createConverter
# or
pnpm install @doeixd/createConverter
```

## 🧩 Key Concepts

### Converters

Converters are the core of the library. They define how to transform objects from one shape to another, handling field mappings, validations, and related operations.

### Field Functions

Field functions specify how to transform individual properties of an object, allowing for targeted conversion logic.

### Object Functions

Object functions allow transforming the entire object at once, useful for complex transformations that can't be handled with field-by-field conversion.

### Hooks

Pre-hooks and post-hooks execute before and after conversion, allowing for setup, validation, or creation of additional objects.

### Context

Context objects pass information through the conversion process and can be used to influence how conversion happens.

### Error Handling

Comprehensive error handling with specific error types and configurable strategies (throw, warn, or ignore).

## 🚀 Basic Usage

Here's a simple example of converting between API and domain models:

```typescript
import { createConverter, transforms } from '@doeixd/createConverter';

// API model from an external source
interface UserApiModel {
  id: string;
  first_name: string;
  last_name: string;
  email_address: string;
  created_at: string;
}

// Domain model used in application
interface UserDomainModel {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: Date;
  fullName: string; // Derived field
}

// Create a converter from API to domain model
const apiToDomain = createConverter<UserApiModel, UserDomainModel>((field, obj, pre, post) => {
  // Field mappings
  field('id', from => from.id);
  field('firstName', from => from.first_name);
  field('lastName', from => from.last_name);
  field('email', from => from.email_address);
  field('createdAt', from => new Date(from.created_at));
  
  // Calculate derived field
  field('fullName', from => `${from.first_name} ${from.last_name}`);
  
  // Add a post-hook for logging
  post((ctx, from, to) => {
    console.log(`Converted user: ${to.fullName}`);
  });
}, {
  // Required fields
  requiredFields: ['id', 'email'],
  
  // Default values
  defaults: {
    fullName: ''
  }
});

// Usage:
async function convertUser() {
  const apiUser = {
    id: '12345',
    first_name: 'John',
    last_name: 'Doe',
    email_address: 'john.doe@example.com',
    created_at: '2023-01-15T12:00:00Z'
  };
  
  try {
    const domainUser = await apiToDomain(apiUser);
    console.log(domainUser);
    // {
    //   id: '12345',
    //   firstName: 'John',
    //   lastName: 'Doe',
    //   email: 'john.doe@example.com',
    //   createdAt: 2023-01-15T12:00:00.000Z,
    //   fullName: 'John Doe'
    // }
  } catch (error) {
    console.error('Conversion failed:', error);
  }
}
```

## 🛠️ Advanced Usage

### Bidirectional Converters

Create converters that can transform in both directions:

```typescript
import { createConverter, BidirectionalConverter } from '@doeixd/createConverter';

// Create a bidirectional converter
function createUserConverter(): BidirectionalConverter<UserApiModel, UserDomainModel> {
  // API to Domain
  const forward = createConverter<UserApiModel, UserDomainModel>((field) => {
    field('id', from => from.id);
    field('firstName', from => from.first_name);
    field('lastName', from => from.last_name);
    field('email', from => from.email_address);
    field('createdAt', from => new Date(from.created_at));
    field('fullName', from => `${from.first_name} ${from.last_name}`);
  });
  
  // Domain to API
  const reverse = createConverter<UserDomainModel, UserApiModel>((field) => {
    field('id', from => from.id);
    field('first_name', from => from.firstName);
    field('last_name', from => from.lastName);
    field('email_address', from => from.email);
    field('created_at', from => from.createdAt.toISOString());
  });
  
  return {
    forward,
    reverse
  };
}

const userConverter = createUserConverter();

// Using the bidirectional converter
async function example() {
  // Convert API model to domain
  const apiUser = { /* ... */ };
  const domainUser = await userConverter.forward(apiUser);
  
  // Convert domain model back to API
  const updatedUser = { ...domainUser, firstName: 'Jane' };
  const apiUserUpdated = await userConverter.reverse(updatedUser);
}
```

### Creating Related Objects

Use the `add` function to create multiple related objects during conversion:

```typescript
import { createConverter, Many, getPrimary, getAdditional } from '@doeixd/createConverter';

interface OrderAPI {
  id: string;
  customer_id: string;
  items: Array<{ product_id: string; quantity: number; price: number }>;
}

interface Order {
  id: string;
  customerId: string;
  totalAmount: number;
}

interface OrderItem {
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
}

const orderConverter = createConverter<OrderAPI, Order>((field, obj, pre, post, add) => {
  field('id', from => from.id);
  field('customerId', from => from.customer_id);
  field('totalAmount', from => from.items.reduce((sum, item) => sum + (item.quantity * item.price), 0));
  
  // Create order items as additional objects
  post((ctx, from, to) => {
    const orderItems = from.items.map(item => ({
      orderId: to.id,
      productId: item.product_id,
      quantity: item.quantity,
      price: item.price
    }));
    
    add(...orderItems);
  });
});

async function processOrder(apiOrder: OrderAPI) {
  const result = await orderConverter(apiOrder);
  
  // Using helper functions for type-safe access
  const order = getPrimary(result);
  const orderItems = getAdditional(result);
  
  console.log('Order:', order);
  console.log('Order Items:', orderItems);
}
```

### Custom Error Handling

Configure how errors are handled during conversion:

```typescript
const converter = createConverter<SourceType, TargetType>((field) => {
  field('name', from => {
    if (!from.name) {
      throw new Error('Name is required');
    }
    return from.name.toUpperCase();
  });
}, {
  // Options: 'throw', 'warn', 'ignore'
  errorHandling: 'warn',
  
  // Custom logger
  logger: {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error
  }
});
```

### Using Context

Pass context through the conversion process:

```typescript
interface ConversionContext {
  currentUser: { id: string; roles: string[] };
  tenantId: string;
}

const converter = createConverter<SourceType, TargetType, ConversionContext>((field, obj, pre, post, add, defaults, ctx) => {
  // Use context in field functions
  field('tenantId', (from, ctx) => ctx.tenantId);
  
  // Use context in pre-hooks
  pre((ctx, from, to) => {
    console.log(`Converting with tenant: ${ctx.tenantId}`);
  });
  
  // Check permissions in post-hooks
  post((ctx, from, to) => {
    if (!ctx.currentUser.roles.includes('admin')) {
      delete to.sensitiveField;
    }
  });
}, {
  // Default context values
  context: {
    currentUser: { id: '', roles: [] },
    tenantId: 'default'
  }
});

// Pass additional context at conversion time
const result = await converter(sourceObject, {
  currentUser: { id: 'user123', roles: ['admin'] },
  tenantId: 'tenant456'
});
```

## 🔧 Built-in Transforms

The library provides common transforms to simplify common operations:

```typescript
import { createConverter, transforms } from '@doeixd/createConverter';

const converter = createConverter<SourceType, TargetType>((field) => {
  // String transforms
  field('upperName', from => transforms.toUpperCase(from.name));
  field('lowerEmail', from => transforms.toLowerCase(from.email));
  field('trimmedAddress', from => transforms.trim(from.address));
  
  // Number transforms
  field('quantity', from => transforms.toInteger(from.quantity));
  field('price', from => transforms.toFloat(from.price));
  
  // Boolean transforms
  field('isActive', from => transforms.toBoolean(from.active));
  
  // Date transforms
  field('createdDate', from => transforms.toISODate(from.created));
  
  // Object transforms
  field('userInfo', from => transforms.pick(['id', 'name', 'email'])(from.user));
  field('publicData', from => transforms.omit(['password', 'ssn'])(from.userData));
  
  // Default values
  field('status', from => transforms.defaultValue('pending')(from.status));
  
  // Array transforms
  field('doubledPrices', from => transforms.mapArray((price: number) => price * 2)(from.prices));
  field('inStockItems', from => transforms.filterArray((item: any) => item.stock > 0)(from.items));
  field('tagList', from => transforms.joinArray(', ')(from.tags));
});
```

## 📝 API Documentation

### Core Functions

#### `createConverter`

```typescript
function createConverter<FromObj, ToObj, Ctx = GenericObject>(
  fn?: ConverterDefinition<FromObj, ToObj, Ctx>,
  options?: ConverterOptions<ToObj, Ctx>
): (fromObj: FromObj, additionalCtx?: Partial<Ctx>) => Promise<ToObj | Many<ToObj>>
```

Creates a reusable converter function that transforms objects from one type to another.

**Parameters:**
- `fn`: Configuration function for defining field functions, object functions, and hooks
- `options`: Additional configuration options

**Options:**
- `defaults`: Default values for the target object
- `context`: Default context object
- `mergeStrategy`: Strategy for merging objects (default: deep merge)
- `logger`: Logger for logging messages
- `requiredFields`: List of required fields
- `errorHandling`: Error handling strategy ('throw', 'warn', 'ignore')

**Returns:** A converter function that accepts a source object and optional additional context

### Result Helper Functions

#### `getPrimary`

```typescript
function getPrimary<T>(result: T | Many<T>): T
```

Gets the primary object from a converter result, regardless of return type.

**Parameters:**
- `result`: The converter result (either a single object or Many)

**Returns:** The primary converted object

#### `hasAdditional`

```typescript
function hasAdditional<T>(result: T | Many<T>): boolean
```

Checks if the converter result has additional objects beyond the primary one.

**Parameters:**
- `result`: The converter result

**Returns:** True if the result has additional objects

#### `getAdditional`

```typescript
function getAdditional<T>(result: T | Many<T>): T[]
```

Gets any additional objects from a converter result.

**Parameters:**
- `result`: The converter result

**Returns:** Array of additional objects (empty if none)

### Classes

#### `Many<T>`

A specialized Array class for holding multiple converted objects, ensuring the primary object is valid and allowing additional objects to be stored.

#### `ConverterError`

Custom error class for converter-related errors, providing additional context such as error type and affected field.

**Properties:**
- `type`: The type of error (from ConverterErrorType)
- `source`: The source object that caused the error
- `fieldName`: The field name related to the error
- `originalError`: The original error that triggered this one

### Types and Interfaces

#### `ConverterDefinition<FromObj, ToObj, Ctx>`

Function type used to configure a converter, registering field converters, object transformers, and hooks.

#### `FieldFunction<FromObj, Ctx, ToObj, T>`

Function type for converting a single field from source to target object.

#### `ObjectFunction<FromObj, ToObj, Ctx>`

Function type for transforming an entire object at once.

#### `HookFunction<FromObj, ToObj, Ctx>`

Function type for pre/post-processing hooks.

#### `BidirectionalConverter<A, B>`

Interface for converters that can transform between two object types in both directions.

#### `PartialValidator<T>`

Interface for validating partial objects, with methods to check for required fields.

### Utility Types and Constants

#### `transforms`

Object containing built-in transformers for common operations.

#### `defaultMergeStrategy`

Default strategy for merging objects using deep merge.

#### `noopLogger`

Default no-op logger implementation.

#### `ConverterErrorType`

Enum defining possible error types that may occur during conversion.

## ✨ Common Patterns

### Nested Object Conversion

Handle nested objects by creating separate converters and composing them:

```typescript
// Create a converter for an address
const addressConverter = createConverter<AddressAPI, AddressDomain>((field) => {
  field('street', from => from.street_address);
  field('city', from => from.city);
  field('state', from => from.state_or_province);
  field('postal', from => from.postal_code);
  field('country', from => from.country);
});

// Use the address converter in a user converter
const userConverter = createConverter<UserAPI, UserDomain>((field) => {
  field('id', from => from.id);
  field('name', from => from.name);
  field('email', from => from.email);
  
  // Convert nested address using the address converter
  field('address', async from => {
    if (!from.address) return null;
    
    // Use getPrimary to handle potential Many return
    const result = await addressConverter(from.address);
    return getPrimary(result);
  });
});
```

### Array Field Conversion

Convert arrays of objects:

```typescript
// Create a converter for a single item
const itemConverter = createConverter<ItemAPI, ItemDomain>((field) => {
  field('id', from => from.id);
  field('name', from => from.name);
  field('price', from => from.price);
});

// Use it to convert an array of items
const orderConverter = createConverter<OrderAPI, OrderDomain>((field) => {
  field('id', from => from.id);
  field('date', from => new Date(from.date));
  
  // Convert array of items
  field('items', async from => {
    if (!from.items || !from.items.length) return [];
    
    // Convert each item one by one using getPrimary for type safety
    const items: ItemDomain[] = [];
    for (const item of from.items) {
      const result = await itemConverter(item);
      items.push(getPrimary(result));
    }
    return items;
    
    // Or using Promise.all and getPrimary for parallel conversion
    // return await Promise.all(from.items.map(async item => {
    //   const result = await itemConverter(item);
    //   return getPrimary(result);
    // }));
  });
});
```

### Validation Pattern

Perform validation during conversion:

```typescript
const userConverter = createConverter<UserInput, User>((field, obj, pre) => {
  // Validate in pre-hook
  pre((ctx, from) => {
    if (!from.email || !from.email.includes('@')) {
      throw new ConverterError(
        'Invalid email address',
        ConverterErrorType.VALIDATION,
        { source: from, fieldName: 'email' }
      );
    }
    
    if (from.password && from.password.length < 8) {
      throw new ConverterError(
        'Password must be at least 8 characters',
        ConverterErrorType.VALIDATION,
        { source: from, fieldName: 'password' }
      );
    }
  });
  
  // Fields
  field('email', from => from.email.toLowerCase());
  field('name', from => from.name);
  field('createdAt', from => new Date());
}, {
  requiredFields: ['email', 'name'],
  errorHandling: 'throw'
});
```

## ⚠️ Gotchas & Troubleshooting

### Asynchronous Field Functions

Remember that field functions can be asynchronous, but you need to handle this properly:

```typescript
// This will work
field('user', async from => {
  const user = await userService.findById(from.userId);
  return user;
});

// This will NOT work - missing await
field('user', from => {
  const userPromise = userService.findById(from.userId);
  return userPromise; // Returns Promise<User>, not User
});
```

### TypeScript and Field Types

TypeScript will enforce that field functions return the correct type for each field:

```typescript
interface Target {
  id: number;
  name: string;
}

// This will cause a TypeScript error - returning string for number field
createConverter<Source, Target>((field) => {
  field('id', from => from.id.toString()); // Error: Type 'string' is not assignable to type 'number'
});

// Fix by ensuring correct type returns
createConverter<Source, Target>((field) => {
  field('id', from => parseInt(from.id, 10));
});
```

### Objects vs Many Return Type

When using the `add` function, the converter will return a `Many` instance instead of a single object. The library provides helper functions to make working with these results easier:

```typescript
import { getPrimary, hasAdditional, getAdditional } from '@doeixd/createConverter';

// If add() is called in hooks or functions
const result = await converter(source);

// Type-safe way to get the primary object
const primary = getPrimary(result);

// Check if there are additional objects
if (hasAdditional(result)) {
  // Get all additional objects as an array
  const additionalObjects = getAdditional(result);
  // Process additional objects
}
```

These helper functions make it easier to work with converter results without having to use type assertions or instanceof checks throughout your code.

### Using Helper Functions in Recursive Converters

When using a converter inside another converter (such as for nested objects), use the helper functions to ensure proper type handling:

```typescript
field('nestedObject', async from => {
  if (!from.nested) return null;
  
  const result = await nestedConverter(from.nested);
  // Use getPrimary to handle possible Many return type
  return getPrimary(result);
});
```

### Context Type Inference

To get proper type inference with context objects, specify all generic types:

```typescript
interface MyContext {
  userId: string;
  tenant: string;
}

// Best practice - specify all generics
const converter = createConverter<SourceType, TargetType, MyContext>((field, obj, pre, post, add, defaults, ctx) => {
  // ctx is properly typed as MyContext
  field('tenant', (from, ctx) => ctx.tenant);
});

// This still works but ctx type is inferred as GenericObject
const converter2 = createConverter<SourceType, TargetType>((field, obj, pre, post, add, defaults, ctx) => {
  // ctx is typed as GenericObject, losing specific properties
  field('tenant', (from, ctx) => ctx.tenant); // Error: Property 'tenant' does not exist on type 'GenericObject'
});
```

### Error Handling Strategies

Consider the appropriate error handling strategy for your use case:

- `'throw'`: Stops conversion immediately on error (default)
- `'warn'`: Logs errors but continues conversion
- `'ignore'`: Silently continues conversion

```typescript
// Development environment - throw errors
const devConverter = createConverter<Source, Target>(definitionFn, { errorHandling: 'throw' });

// Production environment - log warnings but continue
const prodConverter = createConverter<Source, Target>(definitionFn, { errorHandling: 'warn' });
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request, and update tests as appropriate.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.