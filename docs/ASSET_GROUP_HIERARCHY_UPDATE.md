# Asset Group Hierarchy Update

## Overview
Updated the asset group API to properly support hierarchical folder structure with parent-child filtering and include necessary data in responses.

## Changes Made

### 1. API Endpoints

#### **GET /asset-groups**
- **Old behavior**: Returned ALL asset groups for the user
- **New behavior**: Returns only ROOT level groups (where `parentGroupId` is `null`)
- **Use case**: Display top-level folders in file explorer

#### **GET /asset-groups/:parentId/children** (NEW)
- **Behavior**: Returns only groups where `parentGroupId` equals `:parentId`
- **Use case**: Navigate into a folder and see its subfolders

#### **GET /asset-groups/:id** (UPDATED)
- Now includes `parentGroupId` in response
- Now includes `childGroups` count in `_count` object

### 2. Response Structure Updates

All asset group responses now include:

```json
{
  "id": 1,
  "groupName": "Documents",
  "parentGroupId": null,         // ← ADDED: null for root, number for child
  "createdDate": "...",
  "createdAt": "...",
  "updatedAt": "...",
  "userId": 1,
  "totalSize": "1234567",       // ← ADDED: already existed but now shown
  "_count": {
    "assets": 10,
    "childGroups": 3              // ← ADDED: number of subfolders
  }
}
```

### 3. Service Layer Changes

#### `findAll()` method signature
- **Old**: `findAll(userId, page, limit, filters)`
- **New**: `findAll(userId, parentGroupId, page, limit, filters)`
- The `parentGroupId` parameter controls filtering:
  - `null` → returns root level groups
  - `number` → returns groups with that specific parent

#### Selection improvements
- Added `parentGroupId` to all select statements
- Added `childGroups` count to `_count` selections
- Added `totalSize` to appropriate selections

## Migration Guide

### Frontend Updates Required

#### 1. Root Level Navigation
```typescript
// OLD: Get all groups (mixed hierarchy)
GET /asset-groups

// NEW: Get only root level folders
GET /asset-groups
// Response will only contain groups where parentGroupId === null
```

#### 2. Child Folder Navigation
```typescript
// NEW: Navigate into a folder
GET /asset-groups/1/children
// Response contains only groups where parentGroupId === 1
```

#### 3. Breadcrumb Navigation
Use the `parentGroupId` field to build breadcrumbs:
```typescript
const buildBreadcrumb = async (groupId) => {
  const breadcrumb = [];
  let currentGroup = await getAssetGroup(groupId);
  
  while (currentGroup) {
    breadcrumb.unshift(currentGroup);
    if (currentGroup.parentGroupId) {
      currentGroup = await getAssetGroup(currentGroup.parentGroupId);
    } else {
      break;
    }
  }
  
  return breadcrumb;
};
```

#### 4. Tree View Display
Use the `childGroups` count to show folder icons:
```typescript
const FolderItem = ({ group }) => (
  <div>
    {group._count.childGroups > 0 && <FolderIcon />}
    {group.groupName}
    <Badge>{group._count.assets} assets</Badge>
    {group._count.childGroups > 0 && (
      <Badge>{group._count.childGroups} folders</Badge>
    )}
  </div>
);
```

## API Examples

### Example 1: File Explorer Navigation
```http
### Step 1: Show root folders
GET /asset-groups
Response: [
  { id: 1, groupName: "Documents", parentGroupId: null, ... },
  { id: 2, groupName: "Photos", parentGroupId: null, ... }
]

### Step 2: User clicks on "Documents" (id: 1)
GET /asset-groups/1/children
Response: [
  { id: 5, groupName: "Personal", parentGroupId: 1, ... },
  { id: 6, groupName: "Work", parentGroupId: 1, ... }
]

### Step 3: User clicks on "Personal" (id: 5)
GET /asset-groups/5/children
Response: [
  { id: 10, groupName: "2024", parentGroupId: 5, ... }
]

### Step 4: View assets in current folder
GET /asset-groups/5/assets
Response: { data: [...], meta: {...} }
```

### Example 2: Create Nested Structure
```http
### Create root folder
POST /asset-groups
{ "groupName": "Projects" }
Response: { id: 100, parentGroupId: null, ... }

### Create subfolder
POST /asset-groups
{ "groupName": "Website Redesign", "parentGroupId": 100 }
Response: { id: 101, parentGroupId: 100, ... }

### Create sub-subfolder
POST /asset-groups
{ "groupName": "Assets", "parentGroupId": 101 }
Response: { id: 102, parentGroupId: 101, ... }
```

### Example 3: Move Folder
```http
### Move folder ID 102 to root level
PATCH /asset-groups/102
{ "parentGroupId": null }

### Move folder ID 102 under folder ID 50
PATCH /asset-groups/102
{ "parentGroupId": 50 }
```

## Backward Compatibility

⚠️ **BREAKING CHANGE**: The main `GET /asset-groups` endpoint behavior has changed.

**Impact**:
- Frontend code that expects ALL groups from `/asset-groups` will now only receive root level groups
- Any code building a complete folder tree from one call needs to be updated

**Migration Steps**:
1. Update frontend to use `/asset-groups` for root level only
2. Use `/asset-groups/:id/children` for navigation
3. Update any tree-building logic to use the new hierarchical endpoints
4. Use the `parentGroupId` field for breadcrumb navigation
5. Use the `childGroups` count for UI indicators

## Testing

Test the following scenarios:

1. ✅ Create root level folder (no parentGroupId)
2. ✅ Create child folder (with parentGroupId)
3. ✅ Get root folders - should only return folders with parentGroupId = null
4. ✅ Get child folders - should only return folders with specific parentGroupId
5. ✅ Verify parentGroupId is in all responses
6. ✅ Verify childGroups count is in all responses
7. ✅ Move folder between parents
8. ✅ Move folder to root level (parentGroupId = null)
9. ✅ Delete folder with children (children should be updated)
10. ✅ Pagination works with filtered results

## Benefits

1. **Better Performance**: Only fetch the folders you need for current view
2. **Hierarchical Navigation**: Proper folder tree structure
3. **Consistent UX**: Works like file explorers (Windows Explorer, Finder, etc.)
4. **Better Data**: Response includes parent info and child counts
5. **Scalability**: Can handle deep folder structures efficiently

## Files Modified

- `src/asset-group/asset-group.controller.ts`
- `src/asset-group/asset-group.service.ts`
- `api-examples-asset-groups.http` (new file)

## Next Steps

Consider implementing:
1. **GET /asset-groups/:id/tree** - Get entire tree from a point
2. **GET /asset-groups/:id/breadcrumb** - Get breadcrumb path
3. **GET /asset-groups/:id/siblings** - Get folders at same level
4. **POST /asset-groups/:id/move** - Dedicated move endpoint
5. **Maximum depth validation** - Prevent too deep nesting
