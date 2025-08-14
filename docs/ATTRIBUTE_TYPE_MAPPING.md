# Attribute Type Mapping Documentation

## Overview

PixelPim supports user-friendly attribute types that are automatically mapped to appropriate storage types in the backend. This allows users to create attributes using intuitive type names while maintaining efficient storage and validation.

## User-Friendly Types vs Storage Types

| User-Friendly Type | Storage Type | Description | Example Default Value |
|-------------------|--------------|-------------|----------------------|
| **Short Text** | `STRING` | Brief text input (single line) | `"Brand Name"` |
| **Paragraph** | `TEXT` | Multi-line text content | `"Product description..."` |
| **HTML** | `TEXT` | Rich text with HTML formatting | `"<p>HTML content</p>"` |
| **Integer** | `INTEGER` | Whole numbers only | `42` |
| **Decimal** | `NUMBER` | Numbers with decimal places | `99.99` |
| **Dropdown** | `ENUM` | Single selection from predefined options | `"Medium"` |
| **Multiselect** | `ARRAY` | Multiple selections from options | `["Option1", "Option2"]` |
| **Date** | `DATE` | Date values | `"2024-01-01"` |
| **URL** | `URL` | Web addresses with validation | `"https://example.com"` |
| **Boolean** | `BOOLEAN` | True/false values | `true` or `false` |

## API Usage

### Creating Attributes with User-Friendly Types

```json
POST /attributes
{
  "name": "Product Price",
  "type": "Decimal",
  "defaultValue": 29.99
}
```

### Creating Attributes with Storage Types (Backward Compatible)

```json
POST /attributes
{
  "name": "Product Price",
  "type": "NUMBER",
  "defaultValue": 29.99
}
```

### Response Format

When you retrieve attributes, the API returns both the storage type and user-friendly type:

```json
{
  "id": 1,
  "name": "Product Price",
  "type": "NUMBER",
  "userFriendlyType": "Decimal",
  "defaultValue": 29.99,
  "userId": 1,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Getting Available Types

You can fetch all available user-friendly types using:

```http
GET /attributes/types
```

This returns:
```json
{
  "userFriendlyTypes": [
    "Short Text",
    "Paragraph", 
    "HTML",
    "Integer",
    "Decimal",
    "Dropdown",
    "Multiselect",
    "Date",
    "URL",
    "Boolean"
  ],
  "typeMapping": {
    "Short Text": "STRING",
    "Paragraph": "TEXT",
    "HTML": "TEXT",
    "Integer": "INTEGER",
    "Decimal": "NUMBER",
    "Dropdown": "ENUM",
    "Multiselect": "ARRAY",
    "Date": "DATE",
    "URL": "URL",
    "Boolean": "BOOLEAN"
  },
  "description": "Available attribute types for creating attributes. Use the user-friendly types in your frontend."
}
```

## Best Practices

1. **Frontend Usage**: Use user-friendly types in your frontend interfaces
2. **Backend Compatibility**: Both user-friendly and storage types are accepted
3. **Type Validation**: Each type has appropriate validation rules applied
4. **Default Values**: Use appropriate default values matching the expected type

## Example Frontend Implementation

```javascript
// Get available types for a dropdown
const typesResponse = await fetch('/api/attributes/types');
const { userFriendlyTypes } = await typesResponse.json();

// Create attribute with user-friendly type
const createAttribute = async (name, type, defaultValue) => {
  const response = await fetch('/api/attributes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type, defaultValue })
  });
  return response.json();
};

// Usage
await createAttribute('Product Price', 'Decimal', 99.99);
await createAttribute('Description', 'Paragraph', 'Enter description...');
await createAttribute('Is Featured', 'Boolean', false);
```

## Migration Notes

- Existing attributes with storage types continue to work
- New attributes can use either user-friendly or storage types
- The system automatically converts user-friendly types to storage types
- Responses include both types for complete information
