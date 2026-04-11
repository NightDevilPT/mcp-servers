---

## Section 5: Dynamic Form Input Generation

When creating tools that require user input, leverage dynamic form generation based on schema validation rules. This provides a better user experience than asking for raw JSON strings.

### Form Input Types and Constraints

#### Basic Primitive Types

**String Fields**
```typescript
{
  type: "string",
  title: "Display Name",
  description: "Field description",
  minLength: 3,        // Minimum length validation
  maxLength: 50,       // Maximum length validation
  pattern: "^[A-Za-z]+$", // Regex pattern validation
  format: "email",     // Special formats: email, uri, date, date-time
  default: "user@example.com" // Default value
}
```

**Number Fields**
```typescript
{
  type: "number",      // or "integer" for whole numbers
  title: "Age",
  description: "User age",
  minimum: 0,          // Minimum value
  maximum: 150,        // Maximum value
  default: 25          // Default value
}
```

**Boolean Fields**
```typescript
{
  type: "boolean",
  title: "Active Status",
  description: "Whether the user is active",
  default: false       // Default value
}
```

#### Enum Fields (Single Selection)

**Without Titles**
```typescript
{
  type: "string",
  title: "Color Selection",
  description: "Choose your favorite color",
  enum: ["Red", "Green", "Blue"],
  default: "Red"
}
```

**With Titles**
```typescript
{
  type: "string",
  title: "Color Selection",
  description: "Choose your favorite color",
  oneOf: [
    { const: "#FF0000", title: "Red" },
    { const: "#00FF00", title: "Green" },
    { const: "#0000FF", title: "Blue" }
  ],
  default: "#FF0000"
}
```

#### Array Fields

**Array of Primitives**
```typescript
{
  type: "array",
  title: "Tags",
  description: "Add tags for the item",
  items: {
    type: "string",
    enum: ["urgent", "important", "review"] // Optional enum for array items
  },
  minItems: 1,        // Minimum number of items
  maxItems: 5,        // Maximum number of items
  default: ["urgent"] // Default array value
}
```

**Array of Objects**
```typescript
{
  type: "array",
  title: "Addresses",
  description: "List of addresses",
  items: {
    type: "object",
    properties: {
      street: { type: "string", description: "Street address" },
      city: { type: "string", description: "City name" },
      zipCode: { type: "string", pattern: "^\\d{5}$", description: "5-digit zip code" }
    },
    required: ["street", "city"]
  },
  minItems: 1,
  maxItems: 3
}
```

#### Object Fields

**Simple Object**
```typescript
{
  type: "object",
  title: "Contact Information",
  description: "User contact details",
  properties: {
    email: { 
      type: "string", 
      format: "email", 
      description: "Email address" 
    },
    phone: { 
      type: "string", 
      pattern: "^\\d{10}$", 
      description: "10-digit phone number" 
    },
    preferred: {
      type: "boolean",
      description: "Preferred contact method",
      default: false
    }
  },
  required: ["email"] // Required properties
}
```

**Nested Object**
```typescript
{
  type: "object",
  title: "User Profile",
  description: "Complete user profile",
  properties: {
    personal: {
      type: "object",
      properties: {
        firstName: { type: "string", description: "First name" },
        lastName: { type: "string", description: "Last name" },
        age: { type: "number", minimum: 0, maximum: 150 }
      },
      required: ["firstName", "lastName"]
    },
    preferences: {
      type: "object",
      properties: {
        theme: { 
          type: "string", 
          enum: ["light", "dark", "auto"],
          default: "auto"
        },
        notifications: {
          type: "boolean",
          default: true
        }
      }
    }
  },
  required: ["personal"]
}
```

### Universal Type Mapping

When working with different data sources, map types to form types:

| Source Type | Form Type | Constraints | Example |
|------------|-----------|-------------|---------|
| `string/text` | string | minLength, maxLength, pattern, enum, format | Email, name, description |
| `integer/number/decimal` | number | minimum, maximum, enum | Age, price, quantity |
| `boolean/flag` | boolean | - | Active status, flags |
| `date/datetime/timestamp` | string | format: "date-time" | Created date, timestamps |
| `uuid/id` | string | pattern: "^[0-9a-fA-F]{24}$" or UUID pattern | Document IDs, unique identifiers |
| `array/list` | array | minItems, maxItems, items schema | Tags, lists, collections |
| `object/dict` | object | properties, required | Nested data structures |
| `null/optional` | string | description | Optional/nullable fields |
| `binary/data` | string | description | Binary data (base64) |
| `regex/pattern` | string | pattern: "^/.*/$" | Regular expressions |
| `code/script` | string | description | Code snippets, scripts |

### Generic Form Schema Generation Pattern

```typescript
// Generate form schema from any data schema
function generateFormSchema(dataSchema: any): {
  properties: Record<string, any>;
  required: string[];
} {
  const properties: Record<string, any> = {};
  const required: string[] = dataSchema.required || [];

  for (const [fieldName, field] of Object.entries(dataSchema.properties)) {
    properties[fieldName] = {
      type: mapDataTypeToFormType(field.type),
      title: formatFieldName(fieldName),
      description: field.description || `${fieldName} field`,
    };

    // Add constraints based on field type
    if (field.type === 'string') {
      if (field.minLength) properties[fieldName].minLength = field.minLength;
      if (field.maxLength) properties[fieldName].maxLength = field.maxLength;
      if (field.pattern) properties[fieldName].pattern = field.pattern;
      if (field.enum) properties[fieldName].enum = field.enum;
      if (field.format) properties[fieldName].format = field.format;
    }

    if (['integer', 'number', 'decimal', 'float'].includes(field.type)) {
      if (field.minimum !== undefined) properties[fieldName].minimum = field.minimum;
      if (field.maximum !== undefined) properties[fieldName].maximum = field.maximum;
      if (field.enum) properties[fieldName].enum = field.enum;
      properties[fieldName].type = 'number';
    }

    if (field.type === 'boolean') {
      properties[fieldName].type = 'boolean';
    }

    if (['date', 'datetime', 'timestamp'].includes(field.type)) {
      properties[fieldName].type = 'string';
      properties[fieldName].format = 'date-time';
    }

    if (field.type === 'uuid') {
      properties[fieldName].type = 'string';
      properties[fieldName].pattern = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
    }

    if (field.type === 'array') {
      properties[fieldName].type = 'array';
      if (field.items) {
        properties[fieldName].items = convertItemsSchema(field.items);
      }
      if (field.minItems !== undefined) properties[fieldName].minItems = field.minItems;
      if (field.maxItems !== undefined) properties[fieldName].maxItems = field.maxItems;
    }

    if (field.type === 'object') {
      properties[fieldName].type = 'object';
      if (field.properties) {
        const nestedSchema = generateFormSchema(field);
        properties[fieldName].properties = nestedSchema.properties;
        properties[fieldName].required = nestedSchema.required;
      }
    }
  }

  return { properties, required };
}

function mapDataTypeToFormType(dataType: string): string {
  switch (dataType.toLowerCase()) {
    case 'string':
    case 'text':
    case 'uuid':
    case 'id':
    case 'date':
    case 'datetime':
    case 'timestamp':
    case 'null':
    case 'binary':
    case 'regex':
    case 'code':
    case 'script':
      return 'string';
    case 'integer':
    case 'number':
    case 'decimal':
    case 'float':
    case 'double':
      return 'number';
    case 'boolean':
    case 'bool':
    case 'flag':
      return 'boolean';
    case 'array':
    case 'list':
    case 'collection':
      return 'array';
    case 'object':
    case 'dict':
    case 'map':
      return 'object';
    default:
      return 'string';
  }
}
```

### Complete Form Implementation Example

```typescript
// Tool with dynamic form generation
execute: async (args, extra) => {
  // Fetch schema from any data source
  const schema = await getDataSchema(args.source, args.resource);
  
  let formSchema: any;
  let message: string;

  if (schema) {
    // Generate dynamic form from schema
    const { properties, required } = generateFormSchema(schema);
    formSchema = {
      type: "object",
      properties,
      required,
    };

    message = `# Create ${args.resource}\n\n`;
    message += `Source: ${args.source}\n`;
    message += `Resource: ${args.resource}\n`;
    message += `Validation: Schema validation enabled\n\n`;
    message += generateFieldSummary(schema);
  } else {
    // Fallback for resources without schema
    formSchema = {
      type: "object",
      properties: {
        data: {
          type: "string",
          title: "Data JSON",
          description: "The data to create (in JSON format)",
        },
      },
      required: ["data"],
    };

    message = `# Create ${args.resource}\n\n`;
    message += `No schema validation - any data structure allowed.\n\n`;
  }

  // Request user input with dynamic form
  const result = await extra.server.elicitInput({
    mode: "form",
    message: `${message}Please fill in the data fields:`,
    requestedSchema: formSchema,
  });

  if (result.action !== "accept") {
    return {
      content: [{ type: "text", text: "Operation cancelled by user." }],
      isError: false,
    };
  }

  // Process form data
  const data = schema ? result.content : JSON.parse(result.content.data);
  
  // Create resource...
  return { content: [{ type: "text", text: "Resource created successfully" }] };
}
```

### Form Field Best Practices

1. **Clear Titles**: Use human-readable titles (e.g., "Email Address" vs "email")
2. **Helpful Descriptions**: Explain what each field is for
3. **Appropriate Defaults**: Provide sensible default values when possible
4. **Validation Constraints**: Use minLength, maxLength, minimum, maximum for validation
5. **Format Validation**: Use format for email, date, URI fields
6. **Enum Selections**: Use enums for limited choice fields
7. **Required Fields**: Clearly mark required fields in the schema
8. **Optional Fields**: Make truly optional fields not required
9. **Nested Objects**: Use object type for complex nested data
10. **Arrays**: Use array type with proper item validation

### Error Handling for Forms

```typescript
// Validate form data
if (result.action === "accept") {
  try {
    const data = result.content;
    
    // Additional validation if needed
    if (schema && !validateDataAgainstSchema(data, schema)) {
      return {
        content: [{ type: "text", text: "Data validation failed" }],
        isError: true,
      };
    }
    
    // Proceed with resource creation...
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error processing form data: ${error.message}` }],
      isError: true,
    };
  }
}
```

### Use Cases and Examples

#### REST API Form
```typescript
// For creating a user via REST API
const userSchema = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 2, maxLength: 50 },
    email: { type: "string", format: "email" },
    age: { type: "number", minimum: 18, maximum: 120 },
    roles: { 
      type: "array", 
      items: { type: "string", enum: ["admin", "user", "guest"] },
      minItems: 1 
    },
    profile: {
      type: "object",
      properties: {
        bio: { type: "string", maxLength: 500 },
        avatar: { type: "string", format: "uri" }
      }
    }
  },
  required: ["name", "email"]
};
```

#### Database Configuration Form
```typescript
// For database configuration
const configSchema = {
  type: "object",
  properties: {
    host: { type: "string", description: "Database host" },
    port: { type: "number", minimum: 1, maximum: 65535, default: 5432 },
    database: { type: "string", description: "Database name" },
    ssl: { type: "boolean", default: true },
    poolSize: { type: "number", minimum: 1, maximum: 100, default: 10 },
    options: {
      type: "object",
      properties: {
        timeout: { type: "number", minimum: 1000, default: 5000 },
        retries: { type: "number", minimum: 0, maximum: 5, default: 3 }
      }
    }
  },
  required: ["host", "database"]
};
```

#### File Upload Metadata Form
```typescript
// For file upload metadata
const fileSchema = {
  type: "object",
  properties: {
    filename: { type: "string", description: "Original filename" },
    contentType: { 
      type: "string", 
      enum: ["image/jpeg", "image/png", "application/pdf", "text/plain"],
      description: "MIME type"
    },
    size: { type: "number", minimum: 0, description: "File size in bytes" },
    tags: { 
      type: "array", 
      items: { type: "string" },
      description: "File tags"
    },
    metadata: {
      type: "object",
      properties: {
        author: { type: "string" },
        description: { type: "string", maxLength: 1000 },
        category: { type: "string", enum: ["document", "image", "video", "audio"] }
      }
    }
  },
  required: ["filename", "contentType"]
};
```

This generic approach allows you to create forms for any data source, whether it's REST APIs, databases, file systems, or any other structured data source.
