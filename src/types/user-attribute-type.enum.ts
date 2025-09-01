export enum UserAttributeType {
  // User-friendly display names
  SHORT_TEXT = 'Short Text',
  PARAGRAPH = 'Paragraph', 
  HTML = 'HTML',
  INTEGER = 'Integer',
  DECIMAL = 'Decimal',
  DROPDOWN = 'Dropdown',
  MULTISELECT = 'Multiselect',
  DATE = 'Date',
  URL = 'URL',
  BOOLEAN = 'Boolean',
}

// Mapping from user-friendly types to storage types
export const USER_TO_STORAGE_TYPE_MAP = {
  [UserAttributeType.SHORT_TEXT]: 'STRING',
  [UserAttributeType.PARAGRAPH]: 'TEXT',
  [UserAttributeType.HTML]: 'TEXT',
  [UserAttributeType.INTEGER]: 'INTEGER',
  [UserAttributeType.DECIMAL]: 'NUMBER',
  [UserAttributeType.DROPDOWN]: 'ARRAY',
  [UserAttributeType.MULTISELECT]: 'ARRAY',
  [UserAttributeType.DATE]: 'DATE',
  [UserAttributeType.URL]: 'URL',
  [UserAttributeType.BOOLEAN]: 'BOOLEAN',
} as const;

// Reverse mapping for displaying storage types as user-friendly names
export const STORAGE_TO_USER_TYPE_MAP = Object.fromEntries(
  Object.entries(USER_TO_STORAGE_TYPE_MAP).map(([userType, storageType]) => [storageType, userType])
) as Record<string, UserAttributeType>;

// Helper function to convert user type to storage type
export function userTypeToStorageType(userType: UserAttributeType): string {
  return USER_TO_STORAGE_TYPE_MAP[userType];
}

// Helper function to convert storage type to user type
export function storageTypeToUserType(storageType: string): UserAttributeType | undefined {
  return STORAGE_TO_USER_TYPE_MAP[storageType];
}

// Get all available user-friendly types
export function getAvailableUserTypes(): UserAttributeType[] {
  return Object.values(UserAttributeType);
}

export function getUserFriendlyType(type: string): string {
  // If type is TEXT, check if value contains HTML tags
  if (type === 'TEXT') {
    // This function now expects a second argument: value
    // To keep backward compatibility, we use arguments[1] for value
    const value = arguments[1];
    if (typeof value === 'string' && /<[^>]+>/.test(value)) {
      return UserAttributeType.HTML;
    } else {
      return UserAttributeType.PARAGRAPH;
    }
  }
  // Check if the type is a valid storage type
  const userType = storageTypeToUserType(type as keyof typeof STORAGE_TO_USER_TYPE_MAP);
  if (userType) {
    return userType;  // Return the user-friendly type
  }
  // If it's not a valid storage type, return the original type
  return type;
}
