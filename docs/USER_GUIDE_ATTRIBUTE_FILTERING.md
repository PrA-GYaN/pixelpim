# User Guide: Filtering Products by Attributes

## Quick Start

### Step 1: Open the Filter Sidebar
- Click the **Filter** button (🔽) in the products page header
- The filter sidebar will appear on the left side

### Step 2: Expand the Attributes Section
- Look for the "Attributes" panel with the tag icon (🏷️)
- Click to expand the attributes filter section

### Step 3: Select Attributes
- Click the "Select attributes" dropdown
- You'll see a list of all your custom attributes
- Select one or more attributes by clicking on them
- Selected attributes will appear as tags in the dropdown

### Step 4: Apply Filters
- Click the **"Apply Filters"** button at the bottom
- Products containing ANY of the selected attributes will be displayed

### Step 5: View Results
- The product table/grid updates to show filtered products
- Active filter count appears in the filter button badge
- Selected filters appear as tags at the top of the sidebar

## Understanding the Filter

### How It Works
When you select multiple attributes, the filter uses **OR logic**:
- If you select "Color" and "Size" attributes
- Products with Color **OR** Size **OR** both will be shown
- Products without either attribute will be hidden

### What It Filters
The attribute filter checks:
- ✅ Custom attributes added directly to products
- ✅ Attributes from product families
- ✅ Required and optional family attributes

### Examples

#### Example 1: Find Products by Feature
**Scenario**: Find all products that have color information

1. Select "Color" attribute
2. Apply filter
3. **Result**: All products with a Color attribute are shown

#### Example 2: Find Products by Multiple Features
**Scenario**: Find products with color, size, or material information

1. Select "Color", "Size", and "Material" attributes
2. Apply filter
3. **Result**: Products with any of these attributes are shown

#### Example 3: Combine with Other Filters
**Scenario**: Find complete products with size information in a specific family

1. Select "Size" attribute
2. Select "Complete" status
3. Select a family
4. Apply filter
5. **Result**: Complete products from that family with Size attribute

## Managing Filters

### Removing a Single Filter
- Click the **X** on any active filter tag
- That filter is removed immediately
- Results update automatically

### Clearing All Filters
- Click the **Clear all filters** button (trash icon)
- All filters are removed
- Full product list is shown

### Updating Filters
- Change selections in any filter section
- Click **"Apply Filters"** to update results
- No need to clear and reapply

## Tips and Best Practices

### 1. Start Broad, Then Narrow
- Begin with fewer attributes
- Add more filters if needed to narrow results
- This helps you understand what products you have

### 2. Use Search with Attributes
- Combine text search with attribute filters
- Example: Search "shirt" + filter by "Size" attribute
- This finds all shirts with size information

### 3. Check Active Filters
- Look at the filter count badge
- Review active filter tags
- Ensures you know what's being filtered

### 4. Save Common Searches
- Note down filter combinations you use often
- Example: "Color + Size + Material" for clothing products
- Speeds up repetitive searches

### 5. Use Sorting
- After filtering, sort results
- Sort by name, date, status, etc.
- Helps organize filtered results

## Common Use Cases

### Inventory Management
**Goal**: Find products missing key attributes

1. Select important attributes (e.g., "Price", "Stock")
2. View which products appear
3. Products NOT in results lack those attributes

### Product Enrichment
**Goal**: Add values to existing attributes

1. Filter by specific attribute
2. See all products with that attribute
3. Edit products to add values

### Quality Control
**Goal**: Find products meeting criteria

1. Select quality-related attributes
2. Apply filters
3. Review products for completeness

### Catalog Organization
**Goal**: Group products by characteristics

1. Filter by category + attributes
2. See products in each group
3. Organize or tag as needed

## Troubleshooting

### No Results Found
**Problem**: Filter returns no products

**Solutions**:
- Check if any products have those attributes
- Try fewer attributes
- Clear other filters that might conflict

### Too Many Results
**Problem**: Filter returns too many products

**Solutions**:
- Add more attribute filters
- Combine with category or family filters
- Use text search to narrow further

### Attribute Not Listed
**Problem**: Can't find an attribute in the dropdown

**Solutions**:
- Check if the attribute exists (go to Attributes page)
- Create the attribute if needed
- Refresh the page

### Filter Not Applying
**Problem**: Results don't change when applying

**Solutions**:
- Click "Apply Filters" button
- Check if any products have those attributes
- Try clearing all filters and starting fresh

## Advanced Filtering

### Multi-Level Filtering
Combine multiple filter types:

```
Search: "shirt"
Status: Complete
Family: Clothing
Attributes: Color, Size, Material
Category: Men's Wear
```

This finds complete men's shirts in the Clothing family with color, size, or material information.

### Sequential Filtering
Apply filters in stages:

1. First, filter by family
2. Review the results
3. Then add attribute filters
4. Narrow further if needed

### Export Filtered Results
After filtering:

1. Click the Export button
2. Select format (CSV, Excel, etc.)
3. Choose columns to export
4. Download filtered product list

## Keyboard Shortcuts

- **ESC**: Close filter sidebar
- **Enter**: Apply filters (when in filter input)
- **Tab**: Navigate between filter sections

## Mobile Usage

On mobile devices:
- Filter sidebar appears as a drawer from the left
- Swipe left to close
- Same functionality as desktop
- Touch-friendly controls

## Related Features

### Attribute Management
- Create attributes: Go to Attributes page → Add Attribute
- Edit attributes: Click attribute → Edit details
- Delete attributes: Select attribute → Delete

### Product Management
- Add attributes to products: Edit product → Attributes tab
- Set attribute values: Edit product → Enter values
- Remove attributes: Edit product → Uncheck attributes

### Family Management
- Add attributes to families: Edit family → Add attributes
- Set as required/optional: Toggle in family editor
- All family products inherit those attributes

## Need Help?

If you encounter issues:
1. Check this guide for solutions
2. Review the product documentation
3. Contact support with specific details
4. Include screenshots if possible

---

**Last Updated**: October 2025
**Feature Version**: 1.0
